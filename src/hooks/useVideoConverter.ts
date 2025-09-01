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

  const loadFFmpeg = async () => {
    if (isLoaded) return;
    
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
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve(null);
        return;
      }

      video.onloadedmetadata = () => {
        canvas.width = Math.min(1920, video.videoWidth);
        canvas.height = Math.min(1080, video.videoHeight);
        
        const stream = canvas.captureStream(30);
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9,opus',
          videoBitsPerSecond: 2500000
        });
        
        const chunks: Blob[] = [];
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          const webmBlob = new Blob(chunks, { type: 'video/webm' });
          resolve(webmBlob);
        };
        
        mediaRecorder.start(100);
        
        const drawFrame = () => {
          if (video.ended || video.paused) {
            mediaRecorder.stop();
            return;
          }
          
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          requestAnimationFrame(drawFrame);
        };
        
        video.play();
        drawFrame();
        
        // Stop after reasonable time to prevent infinite recording
        setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        }, Math.min(video.duration * 1000, 300000)); // Max 5 minutes
      };
      
      video.onerror = () => resolve(null);
      video.src = URL.createObjectURL(file);
    });
  };

  const convertVideo = async (
    file: File,
    options: VideoConversionOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<ConversionResult> => {
    // Try MediaRecorder first for better performance on smaller files
    if (file.size < 50 * 1024 * 1024) { // Less than 50MB
      try {
        const mediaRecorderBlob = await tryMediaRecorderConversion(file);
        if (mediaRecorderBlob && mediaRecorderBlob.size < file.size * 0.9) {
          return {
            webmBlob: mediaRecorderBlob,
            originalSize: file.size,
            convertedSize: mediaRecorderBlob.size,
            compressionRatio: file.size / mediaRecorderBlob.size
          };
        }
      } catch (error) {
        console.log('MediaRecorder conversion failed, falling back to FFmpeg:', error);
      }
    }

    // Fall back to FFmpeg for larger files or if MediaRecorder fails
    return convertToWebM(file, options, onProgress);
  };

  return {
    convertVideo,
    isConverting,
    isLoaded,
    loadFFmpeg
  };
};