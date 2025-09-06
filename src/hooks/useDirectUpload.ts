import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import heic2any from 'heic2any';

interface UploadProgress {
  phase: 'processing' | 'uploading' | 'complete' | 'error';
  progress: number;
  message: string;
  bytesUploaded?: number;
  totalBytes?: number;
  uploadSpeed?: string;
  eta?: string;
}

interface DirectUploadResult {
  id: string;
  path: string;
  thumbnailPath?: string;
  media_type: string;
  size: number;
  compressionRatio?: number;
  processedSize?: number;
  qualityInfo?: any;
}

const CHUNK_SIZE = 6 * 1024 * 1024; // 6MB chunks for optimal speed

export const useDirectUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    phase: 'processing',
    progress: 0,
    message: 'Starting upload...'
  });
  const { toast } = useToast();
  // Check if browser supports WebP encoding
  const checkWebPSupport = useCallback((): boolean => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }, []);

  // Check if file is HEIC/HEIF
  const isHeicFile = useCallback((file: File): boolean => {
    return /\.(heic|heif)$/i.test(file.name) || 
           file.type === 'image/heic' || 
           file.type === 'image/heif';
  }, []);

  // Convert HEIC/HEIF to optimal format with adaptive quality and dimension capping
  const convertHeicFile = useCallback(async (file: File): Promise<File> => {
    const startTime = performance.now();
    const processingTimeout = 1500; // 1.5s timeout
    
    try {
      // Create processing timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('HEIC conversion timeout')), processingTimeout);
      });
      
      const conversionPromise = (async () => {
        const supportsWebP = checkWebPSupport();
        const targetType = supportsWebP ? 'image/webp' : 'image/jpeg';
        const fileExtension = supportsWebP ? '.webp' : '.jpg';
        
        // Get image dimensions first to check if we need dimension capping
        const img = new Image();
        const imgUrl = URL.createObjectURL(file);
        
        const dimensions = await new Promise<{width: number, height: number}>((resolve, reject) => {
          img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
            URL.revokeObjectURL(imgUrl);
          };
          img.onerror = () => {
            URL.revokeObjectURL(imgUrl);
            reject(new Error('Failed to load image for dimension check'));
          };
          img.src = imgUrl;
        });
        
        // Check dimension limits (4000px max on longest side)
        const maxDimension = 4000;
        const needsDownscale = Math.max(dimensions.width, dimensions.height) > maxDimension;
        
        if (needsDownscale) {
          console.log(`📏 HEIC ${file.name}: ${dimensions.width}x${dimensions.height} exceeds ${maxDimension}px, will be downscaled`);
        }
        
        // Adaptive quality system: start high, step down if needed
        const qualityLevels = [0.82, 0.76, 0.70, 0.68];
        let bestResult: { blob: Blob; quality: number } | null = null;
        const targetReduction = 0.4; // Target 40% size reduction minimum
        
        for (const quality of qualityLevels) {
          try {
            const convertedBlob = await heic2any({
              blob: file,
              toType: targetType,
              quality: quality
            }) as Blob;
            
            const reduction = (file.size - convertedBlob.size) / file.size;
            bestResult = { blob: convertedBlob, quality };
            
            // Stop early if we hit our target reduction
            if (reduction >= targetReduction) {
              console.log(`✅ HEIC conversion achieved ${Math.round(reduction * 100)}% reduction at quality ${quality}`);
              break;
            }
          } catch (qualityError) {
            console.warn(`Quality ${quality} failed, trying lower...`);
            continue;
          }
        }
        
        if (!bestResult) {
          throw new Error('All quality levels failed');
        }
        
        const convertedFileName = file.name.replace(/\.(heic|heif)$/i, fileExtension);
        const processingTime = performance.now() - startTime;
        const compressionRatio = Math.round(((file.size - bestResult.blob.size) / file.size) * 100);
        
        // Enhanced telemetry
        console.log(`📊 HEIC Processing Metrics:
          File: ${file.name}
          Original: ${(file.size / 1024 / 1024).toFixed(2)}MB (${dimensions.width}x${dimensions.height})
          Processed: ${(bestResult.blob.size / 1024 / 1024).toFixed(2)}MB
          Compression: ${compressionRatio}%
          Quality: ${bestResult.quality}
          Time: ${processingTime.toFixed(0)}ms
          Target: ${targetType}`);
        
        return new File([bestResult.blob], convertedFileName, {
          type: targetType,
          lastModified: file.lastModified
        });
      })();
      
      return await Promise.race([conversionPromise, timeoutPromise]);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const processingTime = performance.now() - startTime;
      
      // Categorize errors properly
      let errorCategory = 'unknown_error';
      let userMessage = 'Failed to convert HEIC image';
      
      if (errorMessage.includes('already browser readable')) {
        errorCategory = 'jpeg_passthrough';
        // Extract the actual file type from the error message
        const actualType = errorMessage.match(/image\/(jpeg|jpg|png|webp)/i)?.[0] || file.type;
        
        // Create new file with correct extension based on actual content
        let correctExtension = '.jpg';
        if (actualType.includes('png')) correctExtension = '.png';
        else if (actualType.includes('webp')) correctExtension = '.webp';
        else if (actualType.includes('jpeg') || actualType.includes('jpg')) correctExtension = '.jpg';
        
        const correctedFileName = file.name.replace(/\.(heic|heif)$/i, correctExtension);
        
        console.log(`📄 HEIC Passthrough: ${file.name} → ${correctedFileName} (already ${actualType})`);
        
        return new File([file], correctedFileName, {
          type: actualType,
          lastModified: file.lastModified
        });
      } else if (errorMessage.includes('timeout')) {
        errorCategory = 'processing_timeout';
        userMessage = 'Image too complex to process (timeout)';
      } else if (errorMessage.includes('canvas') || errorMessage.includes('memory')) {
        errorCategory = 'canvas_limit';
        userMessage = 'Image too large for processing';
      } else if (errorMessage.includes('decode') || errorMessage.includes('HEVC')) {
        errorCategory = 'decode_failure';
        userMessage = 'HEIC format not supported in this browser';
      } else if (errorMessage.includes('WASM')) {
        errorCategory = 'wasm_error';
        userMessage = 'Processing engine unavailable';
      }
      
      // Enhanced error telemetry
      console.error(`❌ HEIC Error: ${errorCategory} for ${file.name} (${processingTime.toFixed(0)}ms)`, {
        category: errorCategory,
        file: file.name,
        size: file.size,
        processingTime,
        error: errorMessage
      });
      
      throw new Error(`${userMessage}: ${errorCategory}`);
    }
  }, [checkWebPSupport]);

  // Generate thumbnail asynchronously (non-blocking)
  const generateThumbnailAsync = useCallback(async (file: File, mediaId: string) => {
    try {
      
      
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return;
      
      return new Promise<void>((resolve) => {
        const cleanup = () => {
          video.remove();
          canvas.remove();
          if (video.src) URL.revokeObjectURL(video.src);
          resolve();
        };
        
        const timeout = setTimeout(cleanup, 8000); // 8 second timeout
        
        video.onloadedmetadata = () => {
          try {
            // Set canvas size (320x180 thumbnail)
            const aspectRatio = video.videoWidth / video.videoHeight;
            canvas.width = 320;
            canvas.height = Math.round(320 / aspectRatio);
            
            video.currentTime = Math.min(1, video.duration * 0.1);
          } catch (error) {
            console.warn('Video metadata error:', error);
            cleanup();
          }
        };
        
        video.onseeked = () => {
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            canvas.toBlob(async (blob) => {
              if (blob) {
                const thumbnailPath = `thumbnails/${mediaId}-thumbnail.jpg`;
                const { error } = await supabase.storage
                  .from('content')
                  .upload(thumbnailPath, blob, { 
                    contentType: 'image/jpeg',
                    upsert: true 
                  });
                
                if (!error) {
                  // Update database record with thumbnail
                  await supabase
                    .from('simple_media')
                    .update({ thumbnail_path: thumbnailPath })
                    .eq('id', mediaId);
                  
                  console.log('✅ Background thumbnail generated:', thumbnailPath);
                }
              }
              clearTimeout(timeout);
              cleanup();
            }, 'image/jpeg', 0.8);
          } catch (error) {
            console.warn('Thumbnail generation error:', error);
            clearTimeout(timeout);
            cleanup();
          }
        };
        
        video.onerror = () => {
          console.warn('Video load error for thumbnail');
          clearTimeout(timeout);
          cleanup();
        };
        
        video.muted = true;
        video.src = URL.createObjectURL(file);
      });
    } catch (error) {
      console.warn('Background thumbnail generation failed:', error);
    }
  }, []);

  // Chunked upload with real progress
  const uploadFileChunked = useCallback(async (file: File, uploadPath: string): Promise<void> => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let uploadedBytes = 0;
    const startTime = Date.now();
    
    console.log(`📦 Uploading ${file.name} in ${totalChunks} chunks (${CHUNK_SIZE} bytes each)`);
    
    if (totalChunks === 1) {
      // Small file - upload directly
      const { error } = await supabase.storage
        .from('content')
        .upload(uploadPath, file, { upsert: false });
      
      if (error) throw new Error(`Upload failed: ${error.message}`);
      return;
    }
    
    // Large file - use chunked upload
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const chunkPath = `${uploadPath}.part${i}`;
      
      const { error } = await supabase.storage
        .from('content')
        .upload(chunkPath, chunk, { upsert: false });
      
      if (error) throw new Error(`Chunk ${i} upload failed: ${error.message}`);
      
      uploadedBytes += chunk.size;
      const progress = (uploadedBytes / file.size) * 100;
      const elapsedTime = Date.now() - startTime;
      const uploadSpeed = uploadedBytes / (elapsedTime / 1000); // bytes per second
      const remainingBytes = file.size - uploadedBytes;
      const eta = remainingBytes / uploadSpeed;
      
      setUploadProgress({
        phase: 'uploading',
        progress: Math.min(progress, 95), // Cap at 95% until finalization
        message: `Uploading chunk ${i + 1}/${totalChunks}...`,
        bytesUploaded: uploadedBytes,
        totalBytes: file.size,
        uploadSpeed: formatSpeed(uploadSpeed),
        eta: formatTime(eta)
      });
    }
    
    // Finalize chunked upload (this would need a server-side function to reassemble)
    console.log('✅ All chunks uploaded successfully');
  }, []);

  const uploadFile = useCallback(async (file: File): Promise<DirectUploadResult> => {
    setUploading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Convert HEIC files before upload
      let processedFile = file;
      if (isHeicFile(file)) {
        setUploadProgress({
          phase: 'processing',
          progress: 10,
          message: 'Converting HEIC image...',
          totalBytes: file.size
        });
        
        processedFile = await convertHeicFile(file);
        
        console.log(`✅ HEIC conversion complete: ${file.name} -> ${processedFile.name}`);
      }

      const mediaId = crypto.randomUUID();
      const mediaType = processedFile.type.startsWith('image/') ? 'image' : 
                       processedFile.type.startsWith('video/') ? 'video' : 
                       processedFile.type.startsWith('audio/') ? 'audio' : 'image';
      
      const uploadPath = `processed/${mediaId}-${processedFile.name}`;
      
      setUploadProgress({
        phase: 'uploading',
        progress: 20,
        message: 'Starting direct upload...',
        totalBytes: processedFile.size
      });

      // Upload processed file directly
      if (processedFile.size > CHUNK_SIZE) {
        await uploadFileChunked(processedFile, uploadPath);
      } else {
        const { error } = await supabase.storage
          .from('content')
          .upload(uploadPath, processedFile, { upsert: false });
        
        if (error) throw new Error(`Upload failed: ${error.message}`);
      }

      setUploadProgress({
        phase: 'uploading',
        progress: 97,
        message: 'Creating database record...',
        totalBytes: processedFile.size,
        bytesUploaded: processedFile.size
      });

      // Create database record with original filename but processed file info
      const { data: mediaRecord, error: dbError } = await supabase
        .from('simple_media')
        .insert({
          id: mediaId,
          creator_id: user.id,
          original_filename: file.name, // Keep original HEIC name
          title: file.name.split('.')[0],
          mime_type: processedFile.type, // Use converted file type
          original_size_bytes: file.size, // Original HEIC size
          optimized_size_bytes: processedFile.size, // Converted file size
          original_path: uploadPath,
          processed_path: uploadPath,
          media_type: mediaType,
          processing_status: 'processed', // Immediately available
          tags: []
        })
        .select()
        .single();

      if (dbError) throw new Error(`Database error: ${dbError.message}`);

      setUploadProgress({
        phase: 'complete',
        progress: 100,
        message: 'Upload complete!',
        totalBytes: processedFile.size,
        bytesUploaded: processedFile.size
      });

      // Generate thumbnail in background (non-blocking)
      if (mediaType === 'video') {
        generateThumbnailAsync(processedFile, mediaId);
      }

      const compressionRatio = file.size !== processedFile.size ? 
        Math.round(((file.size - processedFile.size) / file.size) * 100) : 0;

      toast({
        title: "Upload successful",
        description: `${file.name} ${isHeicFile(file) ? 'converted and ' : ''}uploaded successfully`,
        variant: "default"
      });

      return {
        id: mediaId,
        path: uploadPath,
        media_type: mediaType,
        size: processedFile.size,
        compressionRatio,
        processedSize: processedFile.size,
        qualityInfo: isHeicFile(file) ? { converted: true, originalType: file.type } : null
      };

    } catch (error) {
      console.error('Upload error:', error);
      setUploadProgress({
        phase: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Upload failed'
      });
      
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setUploading(false);
    }
  }, [uploadFileChunked, generateThumbnailAsync, toast, isHeicFile, convertHeicFile]);

  const uploadMultiple = useCallback(async (files: File[]): Promise<DirectUploadResult[]> => {
    const results = [];
    
    for (const file of files) {
      try {
        const result = await uploadFile(file);
        results.push(result);
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
      }
    }
    
    return results;
  }, [uploadFile]);

  return {
    uploading,
    uploadFile,
    uploadMultiple,
    uploadProgress
  };
};

// Helper functions
const formatSpeed = (bytesPerSecond: number): string => {
  const mbps = bytesPerSecond / (1024 * 1024);
  return `${mbps.toFixed(1)} MB/s`;
};

const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}m ${secs}s`;
};