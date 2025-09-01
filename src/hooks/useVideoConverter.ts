import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { useState } from 'react';

interface VideoConversionOptions {
  quality?: 'high' | 'medium' | 'low';
  targetResolution?: string;
  crf?: number;
}

interface ConversionResult {
  webmBlob: Blob;
  originalSize: number;
  convertedSize: number;
  compressionRatio: number;
}

export const useVideoConverter = () => {
  const [ffmpeg] = useState(() => new FFmpeg());
  const [isLoaded, setIsLoaded] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  // Check if the browser supports the features needed for FFmpeg.wasm
  const checkBrowserSupport = () => {
    // Check for SharedArrayBuffer support (required for FFmpeg.wasm)
    if (typeof SharedArrayBuffer === 'undefined') {
      console.warn('SharedArrayBuffer not available - FFmpeg.wasm not supported');
      return false;
    }
    
    // Check for WebAssembly support
    if (typeof WebAssembly === 'undefined') {
      console.warn('WebAssembly not available');
      return false;
    }
    
    // Check for Worker support
    if (typeof Worker === 'undefined') {
      console.warn('Web Workers not available');
      return false;
    }
    
    return true;
  };

  const loadFFmpeg = async () => {
    if (isLoaded) return;
    
    if (!checkBrowserSupport()) {
      throw new Error('Browser does not support FFmpeg.wasm (requires SharedArrayBuffer)');
    }
    
    try {
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      
      ffmpeg.on('log', ({ message }) => {
        console.log('FFmpeg:', message);
      });

      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      
      setIsLoaded(true);
      console.log('FFmpeg loaded successfully');
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      throw error;
    }
  };

  const convertToWebM = async (
    file: File, 
    options: VideoConversionOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<ConversionResult> => {
    if (!isLoaded) {
      await loadFFmpeg();
    }

    setIsConverting(true);
    
    try {
      const { quality = 'medium', targetResolution, crf } = options;
      const inputName = 'input.mp4';
      const outputName = 'output.webm';

      // Write input file
      await ffmpeg.writeFile(inputName, await fetchFile(file));

      // Build FFmpeg command based on quality settings
      const commands = ['-i', inputName];
      
      // Video codec and quality settings
      commands.push('-c:v', 'libvpx-vp9');
      commands.push('-c:a', 'libopus');
      
      // Quality-based settings
      const qualitySettings = {
        high: { crf: crf || 30, preset: 'slow' },
        medium: { crf: crf || 35, preset: 'medium' },
        low: { crf: crf || 40, preset: 'fast' }
      };
      
      const settings = qualitySettings[quality];
      commands.push('-crf', settings.crf.toString());
      commands.push('-preset', settings.preset);
      
      // Resolution scaling if specified
      if (targetResolution) {
        commands.push('-vf', `scale=${targetResolution}`);
      }
      
      // Optimize for web
      commands.push('-row-mt', '1');
      commands.push('-tile-columns', '2');
      commands.push('-frame-parallel', '1');
      
      // Audio settings
      commands.push('-b:a', '128k');
      
      commands.push('-y', outputName);

      // Set up progress tracking
      ffmpeg.on('progress', ({ progress }) => {
        onProgress?.(Math.round(progress * 100));
      });

      // Execute conversion
      await ffmpeg.exec(commands);

      // Read output file
      const outputData = await ffmpeg.readFile(outputName);
      const webmBlob = new Blob([outputData], { type: 'video/webm' });

      // Calculate compression stats
      const originalSize = file.size;
      const convertedSize = webmBlob.size;
      const compressionRatio = originalSize / convertedSize;

      // Cleanup
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);

      return {
        webmBlob,
        originalSize,
        convertedSize,
        compressionRatio
      };
    } catch (error) {
      console.error('Video conversion failed:', error);
      throw error;
    } finally {
      setIsConverting(false);
    }
  };

  const tryMediaRecorderConversion = async (file: File): Promise<Blob | null> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve(null);
        return;
      }

      // Check MediaRecorder support
      if (!MediaRecorder.isTypeSupported('video/webm;codecs=vp9') && 
          !MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
        console.log('WebM codecs not supported by MediaRecorder');
        resolve(null);
        return;
      }

      let timeoutId: NodeJS.Timeout;
      let isComplete = false;
      
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (video.src) URL.revokeObjectURL(video.src);
        isComplete = true;
      };

      video.onloadedmetadata = () => {
        try {
          // Scale down for better compatibility and performance
          const maxDimension = 1280; // 720p max
          const scale = Math.min(maxDimension / video.videoWidth, maxDimension / video.videoHeight, 1);
          
          canvas.width = Math.floor(video.videoWidth * scale);
          canvas.height = Math.floor(video.videoHeight * scale);
          
          console.log(`Converting video: ${video.videoWidth}x${video.videoHeight} -> ${canvas.width}x${canvas.height}`);
          
          const stream = canvas.captureStream(15); // Lower framerate for better compression
          
          // Try VP9 first, fall back to VP8
          let mimeType = 'video/webm;codecs=vp9';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm;codecs=vp8';
          }
          
          const mediaRecorder = new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond: Math.min(1000000, file.size / 10) // Adaptive bitrate
          });
          
          const chunks: Blob[] = [];
          
          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              chunks.push(event.data);
            }
          };
          
          mediaRecorder.onstop = () => {
            if (isComplete) return;
            const webmBlob = new Blob(chunks, { type: 'video/webm' });
            cleanup();
            resolve(webmBlob);
          };
          
          mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event);
            cleanup();
            resolve(null);
          };
          
          mediaRecorder.start(1000); // Collect data every second
          video.currentTime = 0;
          video.play();
          
          const drawFrame = () => {
            if (isComplete || video.ended || video.paused) {
              mediaRecorder.stop();
              return;
            }
            
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            requestAnimationFrame(drawFrame);
          };
          
          drawFrame();
          
          // Safety timeout based on video duration
          const maxDuration = Math.min(video.duration * 1000 + 5000, 60000); // Max 1 minute
          timeoutId = setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
            }
          }, maxDuration);
          
        } catch (error) {
          console.error('MediaRecorder setup error:', error);
          cleanup();
          resolve(null);
        }
      };
      
      video.onerror = (error) => {
        console.error('Video load error:', error);
        cleanup();
        resolve(null);
      };
      
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.preload = 'metadata';
    });
  };

  const convertVideo = async (
    file: File,
    options: VideoConversionOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<ConversionResult> => {
    // Always try MediaRecorder first (simpler and more compatible)
    try {
      console.log('Attempting MediaRecorder conversion...');
      const mediaRecorderBlob = await tryMediaRecorderConversion(file);
      if (mediaRecorderBlob && mediaRecorderBlob.size > 0) {
        const compressionRatio = file.size / mediaRecorderBlob.size;
        console.log(`MediaRecorder conversion successful: ${compressionRatio.toFixed(2)}x compression`);
        return {
          webmBlob: mediaRecorderBlob,
          originalSize: file.size,
          convertedSize: mediaRecorderBlob.size,
          compressionRatio
        };
      }
    } catch (error) {
      console.log('MediaRecorder conversion failed:', error);
    }

    // Try FFmpeg.wasm only if browser supports it
    if (checkBrowserSupport()) {
      try {
        console.log('Attempting FFmpeg.wasm conversion...');
        return await convertToWebM(file, options, onProgress);
      } catch (error) {
        console.error('FFmpeg.wasm conversion failed:', error);
      }
    }

    // If both methods fail, throw an error
    throw new Error('Video conversion not supported in this browser. Please try a different file or browser.');
  };

  return {
    convertVideo,
    isConverting,
    isLoaded,
    loadFFmpeg,
    checkBrowserSupport
  };
};