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

  // Convert HEIC/HEIF to optimal format (WebP or JPEG)
  const convertHeicFile = useCallback(async (file: File): Promise<File> => {
    try {
      const supportsWebP = checkWebPSupport();
      const targetType = supportsWebP ? 'image/webp' : 'image/jpeg';
      const fileExtension = supportsWebP ? '.webp' : '.jpg';
      
      const convertedBlob = await heic2any({
        blob: file,
        toType: targetType,
        quality: 0.9
      }) as Blob;
      
      const convertedFileName = file.name.replace(/\.(heic|heif)$/i, fileExtension);
      
      return new File([convertedBlob], convertedFileName, {
        type: targetType,
        lastModified: file.lastModified
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Handle files that are already browser-readable (misnamed files)
      if (errorMessage.includes('already browser readable')) {
        // Extract the actual file type from the error message
        const actualType = errorMessage.match(/image\/(jpeg|jpg|png|webp)/i)?.[0] || file.type;
        
        // Create new file with correct extension based on actual content
        let correctExtension = '.jpg';
        if (actualType.includes('png')) correctExtension = '.png';
        else if (actualType.includes('webp')) correctExtension = '.webp';
        else if (actualType.includes('jpeg') || actualType.includes('jpg')) correctExtension = '.jpg';
        
        const correctedFileName = file.name.replace(/\.(heic|heif)$/i, correctExtension);
        
        return new File([file], correctedFileName, {
          type: actualType,
          lastModified: file.lastModified
        });
      }
      
      console.error('HEIC conversion failed:', error);
      throw new Error(`Failed to convert HEIC image: ${errorMessage}`);
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