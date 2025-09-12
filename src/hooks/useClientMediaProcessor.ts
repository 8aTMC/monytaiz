import { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useVideoConverter } from '@/hooks/useVideoConverter';
import heic2any from 'heic2any';

export interface ProcessingProgress {
  phase: 'analyzing' | 'encoding' | 'uploading' | 'finalizing' | 'complete' | 'error';
  progress: number;
  message: string;
}

export interface ProcessedMedia {
  id: string;
  original: File;
  originalFile: File; // Alias for compatibility  
  processed?: File;
  thumbnail: Blob | null;
  processedBlobs: Map<string, Blob>;
  tinyPlaceholder: string | null;
  metadata: {
    width: number;
    height: number;
    duration: number;
    format: string;
    originalSize: number;
    processedSize: number;
    compressionRatio: number;
  };
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

  // Check if file has HEIC/HEIF extension
  const hasHeicExtension = useCallback((file: File): boolean => {
    return /\.(heic|heif)$/i.test(file.name) || 
           file.type === 'image/heic' || 
           file.type === 'image/heif';
  }, []);

  // Check if file is actually in HEIC format by validating file signature
  const validateHeicFormat = useCallback(async (file: File): Promise<boolean> => {
    try {
      const arrayBuffer = await file.slice(0, 32).arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Check for HEIC/HEIF file signatures
      // HEIC files typically start with specific byte patterns
      const signature = Array.from(uint8Array.slice(4, 12))
        .map(byte => String.fromCharCode(byte))
        .join('');
      
      const isHeicFormat = signature.includes('ftyp') && 
                          (signature.includes('heic') || 
                           signature.includes('heix') || 
                           signature.includes('hevc') || 
                           signature.includes('hevx'));
      
      console.log(`File signature validation for ${file.name}:`, {
        signature: signature,
        isActualHeic: isHeicFormat,
        fileType: file.type
      });
      
      return isHeicFormat;
    } catch (error) {
      console.warn('Could not validate HEIC format:', error);
      return false;
    }
  }, []);

  // Check if file is HEIC/HEIF (extension-based check for initial detection)
  const isHeicFile = useCallback((file: File): boolean => {
    return hasHeicExtension(file);
  }, [hasHeicExtension]);

  // Convert HEIC to WebP with smart fallback handling
  const convertHeicToWebP = useCallback(async (file: File): Promise<File> => {
    console.log(`Processing HEIC file: ${file.name} (${file.size} bytes)`);
    
    setProgress({
      phase: 'analyzing',
      progress: 15,
      message: 'Validating HEIC format...'
    });

    // First, validate if this is actually a HEIC file
    const isActualHeic = await validateHeicFormat(file);
    
    if (!isActualHeic) {
      console.log(`File ${file.name} has HEIC extension but is not in HEIC format - treating as regular image`);
      setProgress({
        phase: 'analyzing',
        progress: 30,
        message: 'Processing as regular image...'
      });
      
      // Return the original file with corrected type - it will be processed as a regular image
      const correctedType = file.type.startsWith('image/') ? file.type : 'image/jpeg';
      const newFileName = file.name.replace(/\.(heic|heif)$/i, correctedType.includes('png') ? '.png' : '.jpg');
      return new File([file], newFileName, { type: correctedType });
    }
    
    setProgress({
      phase: 'analyzing',
      progress: 30,
      message: 'Converting HEIC to WebP...'
    });
    
    try {
      // Configure heic2any with proper options for true HEIC files
      const convertedBlobOrArray = await heic2any({
        blob: file,
        toType: 'image/webp',
        quality: 0.85
      });
      
      // Handle the Blob | Blob[] return type
      const convertedBlob = Array.isArray(convertedBlobOrArray) 
        ? convertedBlobOrArray[0] 
        : convertedBlobOrArray;
      
      if (!convertedBlob || !(convertedBlob instanceof Blob)) {
        throw new Error('Invalid conversion result from heic2any');
      }
      
      const newFileName = file.name.replace(/\.(heic|heif)$/i, '.webp');
      const convertedFile = new File([convertedBlob], newFileName, { type: 'image/webp' });
      
      console.log(`HEIC conversion successful: ${newFileName} (${convertedBlob.size} bytes)`);
      return convertedFile;
    } catch (error) {
      console.error('HEIC conversion failed:', error);
      
      // Check if it's the "already readable" error - indicates pseudo-HEIC file
      const errorMessage = error instanceof Error ? error.message : 'Unknown conversion error';
      if (errorMessage.includes('already browser readable') || errorMessage.includes('already readable')) {
        console.log(`File ${file.name} appears to be pseudo-HEIC (already readable) - processing as regular image`);
        
        // Return the file as a regular image with corrected extension and type
        const correctedType = 'image/jpeg'; // Default to JPEG for pseudo-HEIC files
        const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
        return new File([file], newFileName, { type: correctedType });
      }
      
      // For other errors, re-throw with more specific information
      throw new Error(`Failed to convert HEIC file "${file.name}": ${errorMessage}`);
    }
  }, [validateHeicFormat]);

  // Process image using Canvas  
  const processImage = useCallback(async (file: File): Promise<ProcessedMedia | null> => {
    try {
      // Early bailout for GIF files to preserve animation
      const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name);
      if (isGif) {
        console.log(`Skipping processing for GIF file to preserve animation: ${file.name}`);
        return null;
      }

      // Convert HEIC files to WebP first
      let processedFile = file;
      if (isHeicFile(file)) {
        processedFile = await convertHeicToWebP(file);
      }
      
      const result = await new Promise<{ blob: Blob; width: number; height: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = getCanvas();
          const ctx = canvas.getContext('2d')!;

          // Calculate optimal size with 4000px dimension cap
          const maxSize = 4000;
          const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1); // Don't upscale
          const width = Math.round(img.width * ratio);
          const height = Math.round(img.height * ratio);
          
          if (ratio < 1) {
            console.log(`📏 Downscaling ${file.name}: ${img.width}x${img.height} → ${width}x${height}`);
          }

          canvas.width = width;
          canvas.height = height;

          // Draw with quality optimizations
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Adaptive quality encoding - try WebP with different quality levels
          const tryWebPEncoding = (quality: number): Promise<Blob | null> => {
            return new Promise(resolve => {
              canvas.toBlob(resolve, 'image/webp', quality);
            });
          };
          
          const tryJPEGEncoding = (quality: number): Promise<Blob | null> => {
            return new Promise(resolve => {
              canvas.toBlob(resolve, 'image/jpeg', quality);
            });
          };
          
          // Adaptive quality system
          const encodeImage = async () => {
            const qualityLevels = [0.82, 0.76, 0.70];
            let bestBlob: Blob | null = null;
            
            // Try WebP first with adaptive quality
            const checkWebPSupport = () => {
              const canvas = document.createElement('canvas');
              canvas.width = canvas.height = 1;
              return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
            };
            
            if (checkWebPSupport()) {
              for (const quality of qualityLevels) {
                const blob = await tryWebPEncoding(quality);
                if (blob) {
                  const reduction = (file.size - blob.size) / file.size;
                  bestBlob = blob;
                  if (reduction >= 0.4) break; // Stop if we achieve 40% reduction
                }
              }
            }
            
            // Fallback to JPEG if WebP failed or not supported
            if (!bestBlob) {
              for (const quality of [0.85, 0.78, 0.72]) {
                const blob = await tryJPEGEncoding(quality);
                if (blob) {
                  bestBlob = blob;
                  break;
                }
              }
            }
            
            if (bestBlob) {
              resolve({ blob: bestBlob, width, height });
            } else {
              reject(new Error('Failed to encode image with any format'));
            }
          };
          
          encodeImage();

          cleanupBlobUrl(img.src);
        };
        img.onerror = () => {
          reject(new Error('Failed to load image'));
          cleanupBlobUrl(img.src);
        };
        img.src = trackBlobUrl(URL.createObjectURL(processedFile));
      });

      const placeholder = await createTinyPlaceholder(processedFile);
      const compressionRatio = Math.round(((file.size - result.blob.size) / file.size) * 100);

      const processedBlobs = new Map<string, Blob>();
      processedBlobs.set('webp', result.blob);

      return {
        id: crypto.randomUUID(),
        original: file, // Keep original file reference
        originalFile: file, // Alias for compatibility
        thumbnail: result.blob, // Use the actual blob instead of canvas data URL
        processedBlobs: processedBlobs,
        tinyPlaceholder: placeholder,
        metadata: {
          width: result.width,
          height: result.height,
          duration: 0,
          format: result.blob.type.includes('webp') ? 'webp' : 'jpeg',
          originalSize: file.size,
          processedSize: result.blob.size,
          compressionRatio: Math.round(((file.size - result.blob.size) / file.size) * 100)
        }
      };
    } catch (error) {
      console.error('Image processing failed:', error);
      return null;
    }
  }, [getCanvas, createTinyPlaceholder, trackBlobUrl, cleanupBlobUrl, isHeicFile, convertHeicToWebP]);

  // Helper function to create video thumbnail
  const createVideoThumbnail = useCallback(async (file: File): Promise<Blob | null> => {
    try {
      const video = document.createElement('video');
      const canvas = getCanvas();
      const ctx = canvas.getContext('2d')!;
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Video thumbnail creation timeout'));
        }, 5000);
        
        const captureFrame = () => {
          try {
            // Set canvas size to maintain aspect ratio
            const aspectRatio = video.videoWidth / video.videoHeight;
            canvas.width = Math.min(320, video.videoWidth);
            canvas.height = canvas.width / aspectRatio;
            
            // Draw frame with optimizations
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
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

        video.onloadedmetadata = () => {
          const seekTime = Math.min(1, video.duration * 0.1);
          
          if ('requestVideoFrameCallback' in video) {
            video.currentTime = seekTime;
            (video as HTMLVideoElement & { requestVideoFrameCallback: any }).requestVideoFrameCallback(captureFrame);
          } else {
            const handleSeeked = () => {
              (video as HTMLVideoElement).removeEventListener('seeked', handleSeeked);
              captureFrame();
            };
            
            (video as HTMLVideoElement).addEventListener('seeked', handleSeeked);
            (video as HTMLVideoElement).currentTime = seekTime;
          }
        };
        
        video.onerror = () => {
          clearTimeout(timeout);
          resolve(null);
        };
        
        video.src = trackBlobUrl(URL.createObjectURL(file));
      });
    } catch (error) {
      console.error('Thumbnail creation failed:', error);
      return null;
    }
  }, [getCanvas, trackBlobUrl]);

  const processVideo = useCallback(async (file: File): Promise<ProcessedMedia> => {
    console.log('🎬 Starting video processing (upload original):', file.name, file.size);
    
    setProgress({
      phase: 'analyzing',
      message: 'Preparing video for upload...',
      progress: 50
    });

    try {
      // Create thumbnail only - backend will handle compression
      const thumbnail = await createVideoThumbnail(file);
      
      // Get video metadata
      const video = document.createElement('video');
      const videoUrl = trackBlobUrl(URL.createObjectURL(file));
      video.src = videoUrl;
      
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });

      const metadata = {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration
      };

      cleanupBlobUrl(videoUrl);

      setProgress({
        phase: 'complete',
        message: 'Video ready for upload!',
        progress: 100
      });

      return {
        id: crypto.randomUUID(),
        original: file,
        originalFile: file, // Alias for compatibility
        processed: file,
        thumbnail,
        processedBlobs: new Map(),
        tinyPlaceholder: null,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          duration: metadata.duration,
          format: 'mp4',
          originalSize: file.size,
          processedSize: file.size,
          compressionRatio: 1
        }
      };

    } catch (error) {
      console.error('❌ Video processing failed:', error);
      
      return {
        id: crypto.randomUUID(),
        original: file,
        originalFile: file, // Alias for compatibility
        processed: file,
        thumbnail: null,
        processedBlobs: new Map(),
        tinyPlaceholder: null,
        metadata: {
          width: 0,
          height: 0,
          duration: 0,
          format: 'mp4',
          originalSize: file.size,
          processedSize: file.size,
          compressionRatio: 1
        }
      };
    }
  }, [createVideoThumbnail, trackBlobUrl, cleanupBlobUrl]);

  // Audio fallback processing
  const processAudioFallback = useCallback(async (file: File): Promise<ProcessedMedia | null> => {
    console.log('Processing audio (passthrough)');
    
    try {
      const placeholder = await createTinyPlaceholder(file);

      const processedBlobs = new Map<string, Blob>();

      return {
        id: crypto.randomUUID(),
        original: file,
        originalFile: file, // Alias for compatibility
        thumbnail: null,
        processedBlobs,
        tinyPlaceholder: placeholder,
        metadata: {
          width: 0,
          height: 0,
          duration: 0,
          format: file.type.split('/')[1] || 'audio',
          originalSize: file.size,
          processedSize: file.size,
          compressionRatio: 0
        }
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
            original: file,
            originalFile: file, // Alias for compatibility
            thumbnail: null,
            processedBlobs: new Map<string, Blob>(),
            tinyPlaceholder: placeholder,
            metadata: {
              width: 0,
              height: 0,
              duration: 0,
              format: file.type,
              originalSize: file.size,
              processedSize: file.size,
              compressionRatio: 0
            }
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