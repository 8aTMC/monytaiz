import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface ProcessingProgress {
  phase: 'analyzing' | 'encoding' | 'uploading' | 'finalizing' | 'complete' | 'error';
  progress: number;
  message: string;
}

export interface ProcessedMedia {
  id: string;
  originalFile: File;
  processedFiles: {
    image?: Blob;
    video_1080?: Blob;
    video_720?: Blob;
  };
  metadata: {
    width: number;
    height: number;
    duration?: number;
    format: string;
  };
  tinyPlaceholder: string;
}

interface FFmpegWorkerMessage {
  type: 'ready' | 'progress' | 'complete' | 'error';
  data?: any;
  progress?: number;
  error?: string;
}

export const useClientMediaProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingQueue, setProcessingQueue] = useState<ProcessedMedia[]>([]);
  const [progress, setProgress] = useState<ProcessingProgress>({
    phase: 'analyzing',
    progress: 0,
    message: 'Starting...'
  });
  
  const { toast } = useToast();
  const ffmpegWorkerRef = useRef<Worker | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize canvas for image processing
  const getCanvas = useCallback(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    return canvasRef.current;
  }, []);

  // Check if ffmpeg.wasm is supported
  const checkFFmpegSupport = useCallback(() => {
    try {
      return typeof Worker !== 'undefined' && 
             typeof SharedArrayBuffer !== 'undefined' && 
             crossOriginIsolated;
    } catch {
      return false;
    }
  }, []);

  // Create tiny base64 placeholder
  const createTinyPlaceholder = useCallback((file: File): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = getCanvas();
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==');
        return;
      }

      if (file.type.startsWith('image/')) {
        const img = new Image();
        img.onload = () => {
          canvas.width = 8;
          canvas.height = 8;
          ctx.drawImage(img, 0, 0, 8, 8);
          resolve(canvas.toDataURL('image/png'));
          URL.revokeObjectURL(img.src);
        };
        img.onerror = () => {
          // Generate colored placeholder based on filename
          canvas.width = 8;
          canvas.height = 8;
          const hash = file.name.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
          }, 0);
          const hue = Math.abs(hash) % 360;
          ctx.fillStyle = `hsl(${hue}, 30%, 80%)`;
          ctx.fillRect(0, 0, 8, 8);
          resolve(canvas.toDataURL('image/png'));
        };
        img.src = URL.createObjectURL(file);
      } else {
        // Non-image files get a simple colored square
        canvas.width = 8;
        canvas.height = 8;
        const hash = file.name.split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a;
        }, 0);
        const hue = Math.abs(hash) % 360;
        ctx.fillStyle = `hsl(${hue}, 50%, 60%)`;
        ctx.fillRect(0, 0, 8, 8);
        resolve(canvas.toDataURL('image/png'));
      }
    });
  }, [getCanvas]);

  // Process image using Canvas/WebCodecs with WebP fallback
  const processImage = useCallback(async (file: File): Promise<{ blob: Blob; width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = getCanvas();
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported'));
          return;
        }

        // Calculate optimal size (max 1920px on longest side)
        const maxSize = 1920;
        const ratio = Math.min(maxSize / img.width, maxSize / img.height);
        const width = Math.round(img.width * ratio);
        const height = Math.round(img.height * ratio);

        canvas.width = width;
        canvas.height = height;

        // Draw with quality optimizations
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP encoding first (best compression)
        canvas.toBlob((blob) => {
          if (blob) {
            resolve({ blob, width, height });
          } else {
            // Fallback to high-quality JPEG
            canvas.toBlob((jpegBlob) => {
              if (jpegBlob) {
                resolve({ blob: jpegBlob, width, height });
              } else {
                reject(new Error('Failed to encode image'));
              }
            }, 'image/jpeg', 0.85);
          }
        }, 'image/webp', 0.80);

        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => {
        reject(new Error('Failed to load image'));
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    });
  }, [getCanvas]);

  // Initialize FFmpeg worker
  const initFFmpegWorker = useCallback((): Promise<Worker> => {
    return new Promise((resolve, reject) => {
      if (ffmpegWorkerRef.current) {
        resolve(ffmpegWorkerRef.current);
        return;
      }

      try {
        // Create worker with ffmpeg.wasm
        const workerCode = `
          import { FFmpeg } from 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.7/dist/esm/index.js';
          import { toBlobURL } from 'https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js';

          let ffmpeg = null;
          let initialized = false;

          self.onmessage = async function(e) {
            const { type, data } = e.data;
            
            try {
              if (type === 'init') {
                if (!initialized) {
                  ffmpeg = new FFmpeg();
                  ffmpeg.on('progress', ({ progress }) => {
                    self.postMessage({ type: 'progress', progress: Math.round(progress * 100) });
                  });

                  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/esm';
                  await ffmpeg.load({
                    coreURL: await toBlobURL(baseURL + '/ffmpeg-core.js', 'text/javascript'),
                    wasmURL: await toBlobURL(baseURL + '/ffmpeg-core.wasm', 'application/wasm'),
                  });
                  initialized = true;
                }
                self.postMessage({ type: 'ready' });
                
              } else if (type === 'process_video') {
                const { fileData, fileName, options } = data;
                
                // Write input file
                await ffmpeg.writeFile('input.mp4', new Uint8Array(fileData));
                
                const outputs = [];
                
                // 1080p encoding
                await ffmpeg.exec([
                  '-i', 'input.mp4',
                  '-c:v', 'libx264',
                  '-preset', 'slow',
                  '-crf', '23',
                  '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
                  '-c:a', 'aac',
                  '-b:a', '128k',
                  '-movflags', '+faststart',
                  'output_1080p.mp4'
                ]);
                
                const output1080p = await ffmpeg.readFile('output_1080p.mp4');
                outputs.push({ quality: '1080p', data: output1080p });
                
                // 720p encoding (optional)
                if (options.include720p) {
                  await ffmpeg.exec([
                    '-i', 'input.mp4',
                    '-c:v', 'libx264',
                    '-preset', 'slow',
                    '-crf', '24',
                    '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
                    '-c:a', 'aac',
                    '-b:a', '128k',
                    '-movflags', '+faststart',
                    'output_720p.mp4'
                  ]);
                  
                  const output720p = await ffmpeg.readFile('output_720p.mp4');
                  outputs.push({ quality: '720p', data: output720p });
                }
                
                // Get video metadata
                await ffmpeg.exec(['-i', 'input.mp4', '-f', 'null', '-']);
                
                self.postMessage({ 
                  type: 'complete', 
                  data: { 
                    outputs,
                    metadata: { width: 1920, height: 1080 } // Simplified for now
                  }
                });
                
              } else if (type === 'process_audio') {
                const { fileData, fileName } = data;
                
                await ffmpeg.writeFile('input.audio', new Uint8Array(fileData));
                
                // Convert to AAC 128kbps
                await ffmpeg.exec([
                  '-i', 'input.audio',
                  '-c:a', 'aac',
                  '-b:a', '128k',
                  'output.aac'
                ]);
                
                const outputData = await ffmpeg.readFile('output.aac');
                
                self.postMessage({ 
                  type: 'complete', 
                  data: { 
                    output: outputData,
                    metadata: { width: 800, height: 800 }
                  }
                });
              }
              
            } catch (error) {
              self.postMessage({ type: 'error', error: error.message });
            }
          };
        `;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob), { type: 'module' });
        
        worker.onmessage = (e: MessageEvent<FFmpegWorkerMessage>) => {
          if (e.data.type === 'ready') {
            ffmpegWorkerRef.current = worker;
            resolve(worker);
          } else if (e.data.type === 'error') {
            reject(new Error(e.data.error || 'FFmpeg initialization failed'));
          }
        };

        worker.onerror = (error) => {
          reject(new Error(`Worker error: ${error.message}`));
        };

        // Initialize FFmpeg
        worker.postMessage({ type: 'init' });
        
      } catch (error) {
        reject(error);
      }
    });
  }, []);

  // Process video using FFmpeg worker
  const processVideo = useCallback(async (file: File): Promise<{
    video_1080?: Blob;
    video_720?: Blob;
    width: number;
    height: number;
    duration?: number;
  }> => {
    const worker = await initFFmpegWorker();
    
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = () => {
        const fileData = fileReader.result as ArrayBuffer;
        
        const onMessage = (e: MessageEvent<FFmpegWorkerMessage>) => {
          if (e.data.type === 'progress') {
            setProgress(prev => ({
              ...prev,
              progress: Math.min(e.data.progress || 0, 90),
              message: `Encoding video... ${e.data.progress || 0}%`
            }));
          } else if (e.data.type === 'complete') {
            worker.removeEventListener('message', onMessage);
            const { outputs, metadata } = e.data.data;
            
            const result: any = {
              width: metadata.width,
              height: metadata.height,
              duration: metadata.duration
            };
            
            outputs.forEach((output: any) => {
              const blob = new Blob([output.data], { type: 'video/mp4' });
              if (output.quality === '1080p') {
                result.video_1080 = blob;
              } else if (output.quality === '720p') {
                result.video_720 = blob;
              }
            });
            
            resolve(result);
          } else if (e.data.type === 'error') {
            worker.removeEventListener('message', onMessage);
            reject(new Error(e.data.error || 'Video processing failed'));
          }
        };
        
        worker.addEventListener('message', onMessage);
        worker.postMessage({
          type: 'process_video',
          data: {
            fileData,
            fileName: file.name,
            options: {
              include720p: file.size > 100 * 1024 * 1024 // Only create 720p for files > 100MB
            }
          }
        });
      };
      
      fileReader.onerror = () => reject(new Error('Failed to read file'));
      fileReader.readAsArrayBuffer(file);
    });
  }, [initFFmpegWorker]);

  // Main processing function
  const processFiles = useCallback(async (files: File[]): Promise<ProcessedMedia[]> => {
    if (isProcessing) return [];
    
    setIsProcessing(true);
    const processedFiles: ProcessedMedia[] = [];
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileProgress = (i / files.length) * 100;
        
        setProgress({
          phase: 'analyzing',
          progress: fileProgress,
          message: `Processing ${file.name} (${i + 1}/${files.length})`
        });

        // Create tiny placeholder first
        const tinyPlaceholder = await createTinyPlaceholder(file);
        
        const processedMedia: ProcessedMedia = {
          id: `${Date.now()}-${i}`,
          originalFile: file,
          processedFiles: {},
          metadata: { width: 0, height: 0, format: '' },
          tinyPlaceholder
        };

        if (file.type.startsWith('image/')) {
          setProgress({
            phase: 'encoding',
            progress: fileProgress + 10,
            message: `Encoding image ${file.name}...`
          });

          try {
            const { blob, width, height } = await processImage(file);
            processedMedia.processedFiles.image = blob;
            processedMedia.metadata = { width, height, format: 'webp' };
          } catch (error) {
            console.warn('Image processing failed, using original:', error);
            processedMedia.processedFiles.image = file;
            processedMedia.metadata = { width: 1920, height: 1080, format: 'original' };
          }
          
        } else if (file.type.startsWith('video/')) {
          const ffmpegSupported = checkFFmpegSupport();
          
          if (ffmpegSupported) {
            setProgress({
              phase: 'encoding',
              progress: fileProgress + 10,
              message: `Encoding video ${file.name}...`
            });

            try {
              const videoResult = await processVideo(file);
              processedMedia.processedFiles.video_1080 = videoResult.video_1080;
              processedMedia.processedFiles.video_720 = videoResult.video_720;
              processedMedia.metadata = {
                width: videoResult.width,
                height: videoResult.height,
                duration: videoResult.duration,
                format: 'h264'
              };
            } catch (error) {
              console.warn('Video processing failed, marking for later processing:', error);
              processedMedia.metadata = { 
                width: 1920, 
                height: 1080, 
                format: 'needs_processing' 
              };
            }
          } else {
            console.warn('FFmpeg not supported, marking video for later processing');
            processedMedia.metadata = { 
              width: 1920, 
              height: 1080, 
              format: 'needs_processing' 
            };
          }
          
        } else if (file.type.startsWith('audio/')) {
          // For now, keep audio files as-is
          processedMedia.metadata = { width: 800, height: 800, format: 'original' };
        }

        processedFiles.push(processedMedia);
      }

      setProgress({
        phase: 'complete',
        progress: 100,
        message: 'Processing complete!'
      });

      setProcessingQueue(processedFiles);
      return processedFiles;
      
    } catch (error) {
      console.error('File processing error:', error);
      setProgress({
        phase: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Processing failed'
      });
      
      toast({
        title: "Processing Error",
        description: "Some files couldn't be processed. They'll be uploaded as originals.",
        variant: "destructive"
      });
      
      return [];
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, createTinyPlaceholder, processImage, checkFFmpegSupport, processVideo, toast]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (ffmpegWorkerRef.current) {
      ffmpegWorkerRef.current.terminate();
      ffmpegWorkerRef.current = null;
    }
    setProcessingQueue([]);
  }, []);

  return {
    processFiles,
    isProcessing,
    progress,
    processingQueue,
    checkFFmpegSupport,
    cleanup
  };
};
