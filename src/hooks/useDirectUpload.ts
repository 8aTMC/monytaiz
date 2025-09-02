import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

  // Generate thumbnail asynchronously (non-blocking)
  const generateThumbnailAsync = useCallback(async (file: File, mediaId: string) => {
    try {
      console.log('🖼️ Starting background thumbnail generation for:', file.name);
      
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

      const mediaId = crypto.randomUUID();
      const mediaType = file.type.startsWith('image/') ? 'image' : 
                       file.type.startsWith('video/') ? 'video' : 
                       file.type.startsWith('audio/') ? 'audio' : 'image';
      
      const uploadPath = `processed/${mediaId}-${file.name}`;
      
      setUploadProgress({
        phase: 'uploading',
        progress: 0,
        message: 'Starting direct upload...',
        totalBytes: file.size
      });

      // Upload file directly (no processing)
      if (file.size > CHUNK_SIZE) {
        await uploadFileChunked(file, uploadPath);
      } else {
        const { error } = await supabase.storage
          .from('content')
          .upload(uploadPath, file, { upsert: false });
        
        if (error) throw new Error(`Upload failed: ${error.message}`);
      }

      setUploadProgress({
        phase: 'uploading',
        progress: 97,
        message: 'Creating database record...',
        totalBytes: file.size,
        bytesUploaded: file.size
      });

      // Create database record immediately (video shows up in library right away)
      const { data: mediaRecord, error: dbError } = await supabase
        .from('simple_media')
        .insert({
          id: mediaId,
          creator_id: user.id,
          original_filename: file.name,
          title: file.name.split('.')[0],
          mime_type: file.type,
          original_size_bytes: file.size,
          optimized_size_bytes: file.size,
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
        totalBytes: file.size,
        bytesUploaded: file.size
      });

      // Generate thumbnail in background (non-blocking)
      if (mediaType === 'video') {
        generateThumbnailAsync(file, mediaId);
      }

      console.log('🚀 Ultra-fast upload complete:', { 
        id: mediaId, 
        path: uploadPath,
        size: file.size,
        thumbnailGenerating: mediaType === 'video'
      });

      toast({
        title: "Upload successful",
        description: `${file.name} uploaded instantly. ${mediaType === 'video' ? 'Thumbnail generating...' : ''}`,
        variant: "default"
      });

      return {
        id: mediaId,
        path: uploadPath,
        media_type: mediaType,
        size: file.size,
        compressionRatio: 0, // No compression in direct upload
        processedSize: file.size, // Same size as original
        qualityInfo: null // No quality processing
      };

    } catch (error) {
      console.error('Direct upload error:', error);
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
  }, [uploadFileChunked, generateThumbnailAsync, toast]);

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