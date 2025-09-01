import { useState, useRef, useCallback } from 'react';
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
    video_480p?: Blob;
    video_720p?: Blob;
    video_1080p?: Blob;
    audio?: Blob;
    thumbnail?: Blob;
  };
  metadata: {
    width: number;
    height: number;
    duration?: number;
    format: string;
    compressionRatio?: number;
    qualityInfo?: {
      [key: string]: {
        size: number;
        bitrate?: string;
        compressionRatio: number;
      };
    };
  };
  tinyPlaceholder: string;
}

export const useClientMediaProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingQueue, setProcessingQueue] = useState<ProcessedMedia[]>([]);
  const [progress, setProgress] = useState<ProcessingProgress>({
    phase: 'analyzing',
    progress: 0,
    message: ''
  });
  const canvasRef = useRef<HTMLCanvasElement>();
  const { toast } = useToast();

  // Get canvas for processing
  const getCanvas = useCallback(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    return canvasRef.current;
  }, []);

  // Check if processing is supported (simplified - just needs Canvas)
  const checkFFmpegSupport = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    
    // Check for Canvas support
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.warn('Canvas 2D context not available');
        return false;
      }
      return true;
    } catch (error) {
      console.warn('Canvas not supported');
      return false;
    }
  }, []);

  // Get video metadata
  const getVideoInfo = useCallback((file: File): Promise<{ width: number; height: number; duration: number }> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = true;
      
      video.onloadedmetadata = () => {
        const info = {
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration
        };
        URL.revokeObjectURL(video.src);
        resolve(info);
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error('Failed to load video metadata'));
      };
    });
  }, []);

  // Check if a video can be processed client-side
  const canProcessVideo = useCallback((file: File): { canProcess: boolean; reason?: string } => {
    if (!checkFFmpegSupport()) {
      return { canProcess: false, reason: 'Processing not supported in this browser' };
    }
    
    // Check file size - allow up to 500MB for client-side processing
    const maxSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxSize) {
      return { canProcess: false, reason: 'File too large for client-side processing (>500MB)' };
    }
    
    // Allow all supported videos for processing
    return { canProcess: true };
  }, [checkFFmpegSupport]);

  // Create tiny placeholder
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

  // Process image using Canvas
  const processImage = useCallback(async (file: File): Promise<ProcessedMedia | null> => {
    try {
      const result = await new Promise<{ blob: Blob; width: number; height: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = getCanvas();
          const ctx = canvas.getContext('2d')!;

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

          // Try WebP encoding first
          canvas.toBlob((blob) => {
            if (blob) {
              resolve({ blob, width, height });
            } else {
              // Fallback to JPEG
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

      const placeholder = await createTinyPlaceholder(file);
      const compressionRatio = Math.round(((file.size - result.blob.size) / file.size) * 100);

      return {
        id: crypto.randomUUID(),
        originalFile: file,
        processedFiles: {
          image: result.blob
        },
        metadata: {
          width: result.width,
          height: result.height,
          format: result.blob.type,
          compressionRatio,
          qualityInfo: {
            'compressed': {
              size: result.blob.size,
              compressionRatio
            }
          }
        },
        tinyPlaceholder: placeholder
      };
    } catch (error) {
      console.error('Image processing failed:', error);
      return null;
    }
  }, [getCanvas, createTinyPlaceholder]);

  // Helper function to create video thumbnail with proper error handling
  const createVideoThumbnail = useCallback(async (videoElement: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<Blob> => {
    const ctx = canvas.getContext('2d')!;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Video thumbnail creation timeout'));
      }, 5000);
      
      const captureFrame = () => {
        try {
          // Set canvas size to maintain aspect ratio
          const aspectRatio = videoElement.videoWidth / videoElement.videoHeight;
          canvas.width = Math.min(320, videoElement.videoWidth);
          canvas.height = canvas.width / aspectRatio;
          
          // Draw frame with optimizations
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          
          canvas.toBlob((blob) => {
            clearTimeout(timeout);
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create thumbnail blob'));
            }
          }, 'image/jpeg', 0.8);
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };

      // Try to seek to a good position for thumbnail
      const seekTime = Math.min(1, videoElement.duration * 0.1); // 10% into video or 1 second
      
      if ('requestVideoFrameCallback' in videoElement) {
        // Use modern API when available
        videoElement.currentTime = seekTime;
        (videoElement as any).requestVideoFrameCallback(captureFrame);
      } else {
        // Fallback to seeked event
        const handleSeeked = () => {
          (videoElement as HTMLVideoElement).removeEventListener('seeked', handleSeeked);
          captureFrame();
        };
        
        (videoElement as HTMLVideoElement).addEventListener('seeked', handleSeeked);
        (videoElement as HTMLVideoElement).currentTime = seekTime;
      }
    });
  }, []);

  // Process video with enhanced capabilities for larger files
  const processVideo = useCallback(async (file: File): Promise<ProcessedMedia | null> => {
    console.log('🎬 Processing video with enhanced capabilities:', file.name, 'Size:', (file.size / (1024 * 1024)).toFixed(1), 'MB');
    
    let video: HTMLVideoElement | null = null;
    let objectUrl: string | null = null;
    
    try {
      const metadata = await getVideoInfo(file);
      
      setProgress({
        phase: 'encoding',
        progress: 50,
        message: `Creating thumbnail for ${(file.size / (1024 * 1024)).toFixed(1)}MB video...`
      });

      // Create video element
      video = document.createElement('video');
      objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;
      video.muted = true;
      video.preload = 'metadata';
      
      // Wait for video to load with longer timeout for large files
      const timeout = file.size > 100 * 1024 * 1024 ? 30000 : 10000; // 30s for >100MB files
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Video load timeout')), timeout);
        
        video!.onloadedmetadata = () => {
          clearTimeout(timer);
          resolve();
        };
        video!.onerror = () => {
          clearTimeout(timer);
          reject(new Error('Failed to load video'));
        };
      });

      // Create thumbnail
      const canvas = getCanvas();
      const thumbnailBlob = await createVideoThumbnail(video, canvas);

      // Create placeholder
      const placeholder = await createTinyPlaceholder(file);

      setProgress({
        phase: 'complete',
        progress: 100,
        message: 'Video processing complete'
      });

      return {
        id: crypto.randomUUID(),
        originalFile: file,
        processedFiles: {
          thumbnail: thumbnailBlob
        },
        metadata: {
          width: metadata.width,
          height: metadata.height,
          duration: metadata.duration,
          format: file.type,
          compressionRatio: 0, // No compression, just thumbnail
          qualityInfo: {
            'original': {
              size: file.size,
              compressionRatio: 0
            }
          }
        },
        tinyPlaceholder: placeholder
      };
    } catch (error) {
      console.error('Video processing failed:', error);
      setProgress({
        phase: 'error',
        progress: 0,
        message: 'Video processing failed'
      });
      return null;
    } finally {
      // Cleanup
      if (video) {
        video.src = '';
        video.load();
      }
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    }
  }, [getVideoInfo, getCanvas, createTinyPlaceholder, createVideoThumbnail]);

  // Audio fallback processing
  const processAudioFallback = useCallback(async (file: File): Promise<ProcessedMedia | null> => {
    console.log('Processing audio (passthrough)');
    
    try {
      const placeholder = await createTinyPlaceholder(file);

      return {
        id: crypto.randomUUID(),
        originalFile: file,
        processedFiles: {},
        metadata: {
          width: 0,
          height: 0,
          duration: 0,
          format: file.type,
          compressionRatio: 0,
          qualityInfo: {
            'original': {
              size: file.size,
              compressionRatio: 0
            }
          }
        },
        tinyPlaceholder: placeholder
      };
    } catch (error) {
      console.error('Audio processing failed:', error);
      return null;
    }
  }, [createTinyPlaceholder]);

  // Process audio (simplified - no compression)
  const processAudio = useCallback(async (file: File): Promise<ProcessedMedia | null> => {
    console.log('🎵 Processing audio (passthrough):', file.name);
    
    setProgress({
      phase: 'encoding',
      progress: 50,
      message: 'Processing audio...'
    });

    try {
      const result = await processAudioFallback(file);
      
      setProgress({
        phase: 'complete',
        progress: 100,
        message: 'Audio processing complete'
      });

      return result;
    } catch (error) {
      console.error('Audio processing failed:', error);
      return processAudioFallback(file);
    }
  }, [processAudioFallback]);

  // Main processing function
  const processFiles = useCallback(async (files: File[]): Promise<ProcessedMedia[]> => {
    if (isProcessing) return [];
    
    setIsProcessing(true);
    setProcessingQueue([]);
    
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

        let processedMedia: ProcessedMedia | null = null;

        if (file.type.startsWith('image/')) {
          processedMedia = await processImage(file);
        } else if (file.type.startsWith('video/')) {
          processedMedia = await processVideo(file);
        } else if (file.type.startsWith('audio/')) {
          processedMedia = await processAudio(file);
        }

        if (processedMedia) {
          processedFiles.push(processedMedia);
          setProcessingQueue(prev => [...prev, processedMedia!]);
        } else {
          // Fallback: create basic processed media
          const placeholder = await createTinyPlaceholder(file);
          const fallbackMedia: ProcessedMedia = {
            id: crypto.randomUUID(),
            originalFile: file,
            processedFiles: {},
            metadata: {
              width: 0,
              height: 0,
              format: file.type,
              compressionRatio: 0,
              qualityInfo: {
                'original': {
                  size: file.size,
                  compressionRatio: 0
                }
              }
            },
            tinyPlaceholder: placeholder
          };
          processedFiles.push(fallbackMedia);
          setProcessingQueue(prev => [...prev, fallbackMedia]);
        }
      }

      setProgress({
        phase: 'complete',
        progress: 100,
        message: 'Processing complete!'
      });

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
  }, [isProcessing, processImage, processVideo, processAudio, createTinyPlaceholder, toast]);

  // Cleanup
  const cleanup = useCallback(() => {
    setProcessingQueue([]);
    setProgress({ phase: 'analyzing', progress: 0, message: '' });
  }, []);

  return {
    processFiles,
    isProcessing,
    progress,
    processingQueue,
    checkFFmpegSupport,
    canProcessVideo,
    cleanup
  };
};