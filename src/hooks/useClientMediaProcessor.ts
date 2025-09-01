import { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useVideoConverter } from '@/hooks/useVideoConverter';

export interface ProcessingProgress {
  phase: 'analyzing' | 'encoding' | 'uploading' | 'finalizing' | 'complete' | 'error';
  progress: number;
  message: string;
}

export interface ProcessedMedia {
  id: string;
  originalFile: File;
  processedBlobs: Map<string, Blob>;
  metadata: {
    width: number;
    height: number;
    duration?: number;
    format: string;
    originalSize: number;
    processedSize: number;
    compressionRatio: number;
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const blobUrlsRef = useRef<Set<string>>(new Set());
  const { toast } = useToast();
  const { convertVideo, checkBrowserSupport, isConverting } = useVideoConverter();

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch (error) {
          console.warn('Failed to revoke blob URL:', error);
        }
      });
      blobUrlsRef.current.clear();
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Track blob URL for cleanup
  const trackBlobUrl = useCallback((url: string) => {
    blobUrlsRef.current.add(url);
    return url;
  }, []);

  // Clean up tracked blob URL
  const cleanupBlobUrl = useCallback((url: string) => {
    if (blobUrlsRef.current.has(url)) {
      try {
        URL.revokeObjectURL(url);
        blobUrlsRef.current.delete(url);
      } catch (error) {
        console.warn('Failed to revoke blob URL:', error);
      }
    }
  }, []);

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
      const videoUrl = trackBlobUrl(URL.createObjectURL(file));
      video.src = videoUrl;
      video.muted = true;
      
      video.onloadedmetadata = () => {
        const info = {
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration
        };
        cleanupBlobUrl(videoUrl);
        resolve(info);
      };
      
      video.onerror = () => {
        cleanupBlobUrl(videoUrl);
        reject(new Error('Failed to load video metadata'));
      };
    });
  }, [trackBlobUrl, cleanupBlobUrl]);

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
          cleanupBlobUrl(img.src);
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
          cleanupBlobUrl(img.src);
        };
        img.src = trackBlobUrl(URL.createObjectURL(file));
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
  }, [getCanvas, trackBlobUrl, cleanupBlobUrl]);

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

          cleanupBlobUrl(img.src);
        };
        img.onerror = () => {
          reject(new Error('Failed to load image'));
          cleanupBlobUrl(img.src);
        };
        img.src = trackBlobUrl(URL.createObjectURL(file));
      });

      const placeholder = await createTinyPlaceholder(file);
      const compressionRatio = Math.round(((file.size - result.blob.size) / file.size) * 100);

      const processedBlobs = new Map<string, Blob>();
      processedBlobs.set('webp', result.blob);

      return {
        id: crypto.randomUUID(),
        originalFile: file,
        processedBlobs,
        metadata: {
          width: result.width,
          height: result.height,
          format: result.blob.type,
          originalSize: file.size,
          processedSize: result.blob.size,
          compressionRatio
        },
        tinyPlaceholder: placeholder
      };
    } catch (error) {
      console.error('Image processing failed:', error);
      return null;
    }
  }, [getCanvas, createTinyPlaceholder, trackBlobUrl, cleanupBlobUrl]);

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

  // Process video with improved error handling and browser compatibility
  const processVideo = useCallback(async (file: File): Promise<ProcessedMedia | null> => {
    console.log('🎬 Processing video:', file.name, 'Size:', (file.size / (1024 * 1024)).toFixed(1), 'MB');
    
    try {
      const metadata = await getVideoInfo(file);
      const placeholder = await createTinyPlaceholder(file);
      
      setProgress({
        phase: 'encoding',
        progress: 20,
        message: 'Checking conversion options...'
      });

      // Try video conversion only if browser fully supports it
      let conversionResult = null;
      
      try {
        if (checkBrowserSupport()) {
          console.log('Attempting video conversion...');
          conversionResult = await convertVideo(file, { quality: 'medium' });
        } else {
          console.log('Browser does not support video conversion - using original format');
        }
      } catch (conversionError) {
        console.log('Video conversion failed:', conversionError);
        conversionResult = null;
      }

      setProgress({
        phase: 'encoding',
        progress: 70,
        message: 'Creating thumbnail...'
      });

      // Create thumbnail and process the video
      const videoElement = document.createElement('video');
      const canvas = getCanvas();
      const processedBlobs = new Map<string, Blob>();
      
      // Add the converted video if successful
      if (conversionResult && conversionResult.webmBlob) {
        processedBlobs.set('webm', conversionResult.webmBlob);
        console.log('Video converted successfully');
      } else {
        console.log('Using original video format');
      }

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          cleanup();
          // Return basic video info even if thumbnail fails
          resolve({
            id: crypto.randomUUID(),
            originalFile: file,
            processedBlobs,
            metadata: {
              width: metadata.width,
              height: metadata.height,
              duration: metadata.duration,
              format: conversionResult ? 'video/webm' : file.type,
              originalSize: file.size,
              processedSize: conversionResult ? conversionResult.convertedSize : file.size,
              compressionRatio: conversionResult ? conversionResult.compressionRatio : 1
            },
            tinyPlaceholder: placeholder
          });
        }, 15000); // Shorter timeout
        
        const cleanup = () => {
          clearTimeout(timeout);
          if (videoElement.src) {
            cleanupBlobUrl(videoElement.src);
          }
        };
        
        videoElement.onloadedmetadata = async () => {
          try {
            // Try to create thumbnail
            const thumbnail = await createVideoThumbnail(videoElement, canvas);
            if (thumbnail) {
              processedBlobs.set('thumbnail', thumbnail);
            }
          } catch (thumbnailError) {
            console.warn('Thumbnail creation failed:', thumbnailError);
            // Continue without thumbnail
          }
          
          setProgress({
            phase: 'complete',
            progress: 100,
            message: conversionResult ? 'Video converted successfully' : 'Video processed (original format)'
          });
          
          cleanup();
          resolve({
            id: crypto.randomUUID(),
            originalFile: file,
            processedBlobs,
            metadata: {
              width: metadata.width,
              height: metadata.height,
              duration: metadata.duration,
              format: conversionResult ? 'video/webm' : file.type,
              originalSize: file.size,
              processedSize: conversionResult ? conversionResult.convertedSize : file.size,
              compressionRatio: conversionResult ? conversionResult.compressionRatio : 1
            },
            tinyPlaceholder: placeholder
          });
        };
        
        videoElement.onerror = () => {
          console.warn('Video metadata loading failed');
          cleanup();
          // Return basic info without thumbnail
          resolve({
            id: crypto.randomUUID(),
            originalFile: file,
            processedBlobs,
            metadata: {
              width: metadata.width,
              height: metadata.height,
              duration: metadata.duration,
              format: conversionResult ? 'video/webm' : file.type,
              originalSize: file.size,
              processedSize: conversionResult ? conversionResult.convertedSize : file.size,
              compressionRatio: conversionResult ? conversionResult.compressionRatio : 1
            },
            tinyPlaceholder: placeholder
          });
        };
        
        // Use the converted video for thumbnail if available, otherwise original
        const videoBlob = conversionResult ? conversionResult.webmBlob : file;
        videoElement.src = trackBlobUrl(URL.createObjectURL(videoBlob));
      });
      
    } catch (error) {
      console.error('Video processing error:', error);
      
      // Return a basic processed media object even if everything fails
      try {
        const placeholder = await createTinyPlaceholder(file);
        return {
          id: crypto.randomUUID(),
          originalFile: file,
          processedBlobs: new Map<string, Blob>(),
          metadata: {
            width: 0,
            height: 0,
            duration: 0,
            format: file.type,
            originalSize: file.size,
            processedSize: file.size,
            compressionRatio: 1
          },
          tinyPlaceholder: placeholder
        };
      } catch (placeholderError) {
        console.error('Even placeholder creation failed:', placeholderError);
        return null;
      }
    }
  }, [getVideoInfo, getCanvas, createTinyPlaceholder, createVideoThumbnail, checkBrowserSupport, convertVideo, trackBlobUrl, cleanupBlobUrl]);

  // Audio fallback processing
  const processAudioFallback = useCallback(async (file: File): Promise<ProcessedMedia | null> => {
    console.log('Processing audio (passthrough)');
    
    try {
      const placeholder = await createTinyPlaceholder(file);

      const processedBlobs = new Map<string, Blob>();

      return {
        id: crypto.randomUUID(),
        originalFile: file,
        processedBlobs,
        metadata: {
          width: 0,
          height: 0,
          duration: 0,
          format: file.type,
          originalSize: file.size,
          processedSize: file.size,
          compressionRatio: 0
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
            processedBlobs: new Map<string, Blob>(),
            metadata: {
              width: 0,
              height: 0,
              format: file.type,
              originalSize: file.size,
              processedSize: file.size,
              compressionRatio: 0
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