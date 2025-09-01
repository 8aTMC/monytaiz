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

  // Simplified MediaRecorder conversion - just re-encode to WebM
  const tryMediaRecorderConversion = async (file: File): Promise<Blob | null> => {
    return new Promise((resolve) => {
      // Check MediaRecorder support first
      if (!MediaRecorder.isTypeSupported('video/webm')) {
        console.log('WebM not supported by MediaRecorder');
        resolve(null);
        return;
      }

      const video = document.createElement('video');
      let mediaRecorder: MediaRecorder | null = null;
      let timeoutId: NodeJS.Timeout;
      
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (video.src) URL.revokeObjectURL(video.src);
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          try {
            mediaRecorder.stop();
          } catch (e) {
            console.warn('Error stopping MediaRecorder:', e);
          }
        }
      };

      video.onloadedmetadata = () => {
        try {
          // Create a simple canvas to capture the video
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            cleanup();
            resolve(null);
            return;
          }

          // Set reasonable dimensions (max 720p for compatibility)
          const maxWidth = 1280;
          const maxHeight = 720;
          const aspectRatio = video.videoWidth / video.videoHeight;
          
          if (aspectRatio > maxWidth / maxHeight) {
            canvas.width = maxWidth;
            canvas.height = maxWidth / aspectRatio;
          } else {
            canvas.height = maxHeight;
            canvas.width = maxHeight * aspectRatio;
          }

          console.log(`MediaRecorder conversion: ${video.videoWidth}x${video.videoHeight} -> ${canvas.width}x${canvas.height}`);

          const stream = canvas.captureStream(15); // 15 FPS for better compression
          const chunks: Blob[] = [];

          mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm',
            videoBitsPerSecond: 500000 // 500kbps for good compression
          });

          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              chunks.push(event.data);
            }
          };

          mediaRecorder.onstop = () => {
            const webmBlob = new Blob(chunks, { type: 'video/webm' });
            cleanup();
            resolve(webmBlob.size > 0 ? webmBlob : null);
          };

          mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event);
            cleanup();
            resolve(null);
          };

          // Start recording
          mediaRecorder.start();
          video.currentTime = 0;
          video.play();

          // Simple frame drawing loop
          const drawFrame = () => {
            if (video.ended || video.paused) {
              if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
              }
              return;
            }
            
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            requestAnimationFrame(drawFrame);
          };

          video.onended = () => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
            }
          };

          drawFrame();

          // Safety timeout - stop after reasonable time
          const maxTime = Math.min(video.duration * 1200, 30000); // Max 30 seconds
          timeoutId = setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
            }
          }, maxTime);

        } catch (error) {
          console.error('MediaRecorder setup failed:', error);
          cleanup();
          resolve(null);
        }
      };

      video.onerror = () => {
        cleanup();
        resolve(null);
      };

      // Set up video
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.preload = 'metadata';
    });
  };

  const convertVideo = async (
    file: File,
    options: VideoConversionOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<ConversionResult | null> => {
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

    // If both methods fail, return null to indicate no conversion possible
    console.log('All video conversion methods failed - will use original format');
    return null;
  };

  return {
    convertVideo,
    isConverting,
    isLoaded,
    loadFFmpeg,
    checkBrowserSupport
  };
};