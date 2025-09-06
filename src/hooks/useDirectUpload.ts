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

  // Check if file is HEIC/HEIF
  const isHeicFile = useCallback((file: File): boolean => {
    return /\.(heic|heif)$/i.test(file.name) || 
           file.type === 'image/heic' || 
           file.type === 'image/heif';
  }, []);

  // Try client-side processing with Web Worker
  const tryClientProcessing = useCallback(async (file: File): Promise<{
    success: boolean;
    file?: File;
    path?: string;
    reductionPercent?: number;
    quality?: number;
    error?: string;
  }> => {
    return new Promise((resolve) => {
      // Create worker for this processing session
      const worker = new Worker('/heic-worker.js', { type: 'module' });
      
      const timeout = setTimeout(() => {
        worker.terminate();
        resolve({
          success: false,
          error: 'client_timeout'
        });
      }, 2000); // 2s timeout for client processing

      worker.onmessage = (e) => {
        clearTimeout(timeout);
        worker.terminate();
        resolve(e.data);
      };

      worker.onerror = () => {
        clearTimeout(timeout);
        worker.terminate();
        resolve({
          success: false,
          error: 'worker_error'
        });
      };

      // Send file to worker
      worker.postMessage({
        id: Math.random().toString(36),
        file: file
      });
    });
  }, []);

  // Try server fallback processing with blob
  const tryServerFallback = useCallback(async (file: File, clientError?: string): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      const mediaId = crypto.randomUUID();

      // Create FormData to send file blob directly
      const formData = new FormData();
      formData.append('mediaId', mediaId);
      formData.append('originalFilename', file.name);
      formData.append('heicFile', file);
      if (clientError) {
        formData.append('clientError', clientError);
      }

      // Send blob directly to server for processing
      const { data, error } = await supabase.functions.invoke('heic-transcoder', {
        body: formData
      });

      if (error) {
        throw new Error(`Server processing failed: ${error.message}`);
      }

      return {
        success: true
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'server_processing_failed'
      };
    }
  }, []);

  // Categorize HEIC processing errors
  const categorizeHEICError = useCallback((error: any): string => {
    const message = error?.message || error?.toString() || '';
    
    if (message.includes('timeout') || message.includes('processing_timeout')) {
      return 'processing_timeout';
    }
    if (message.includes('canvas') || message.includes('canvas_limit')) {
      return 'canvas_limit';
    }
    if (message.includes('decode') || message.includes('decode_failure')) {
      return 'decode_failure';
    }
    if (message.includes('budget') || message.includes('client_budget_exceeded')) {
      return 'client_budget_exceeded';
    }
    if (message.includes('memory') || message.includes('oom')) {
      return 'wasm_oom';
    }
    if (message.includes('corrupt')) {
      return 'container_corrupt';
    }
    if (message.includes('unsupported')) {
      return 'decode_unsupported';
    }
    
    return 'unknown_processing_error';
  }, []);

  // Get user-friendly error messages
  const getErrorMessage = useCallback((errorCategory: string): string => {
    switch (errorCategory) {
      case 'processing_timeout':
        return 'Processing took too long and was cancelled';
      case 'canvas_limit':
        return 'Image is too large for browser processing';
      case 'decode_failure':
        return 'Unable to decode HEIC file';
      case 'client_budget_exceeded':
        return 'Image exceeds processing limits';
      case 'wasm_oom':
        return 'Insufficient memory for processing';
      case 'container_corrupt':
        return 'HEIC file appears to be corrupted';
      case 'decode_unsupported':
        return 'HEIC format not supported';
      default:
        return 'An unexpected error occurred during processing';
    }
  }, []);

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
                }
              }
              clearTimeout(timeout);
              cleanup();
            }, 'image/jpeg', 0.8);
          } catch (error) {
            console.warn('Thumbnail generation error:', error);
            cleanup();
          }
        };
        
        video.onerror = cleanup;
        video.src = URL.createObjectURL(file);
        video.load();
      });
    } catch (error) {
      console.warn('Thumbnail generation failed:', error);
    }
  }, []);

  // Upload file in chunks for better performance
  const uploadFileChunked = useCallback(async (file: File, uploadPath: string): Promise<void> => {
    const fileSize = file.size;
    
    if (fileSize <= CHUNK_SIZE) {
      // Small file, upload directly
      const { error } = await supabase.storage
        .from('content')
        .upload(uploadPath, file, {
          contentType: file.type,
          upsert: true
        });
      
      if (error) throw error;
      return;
    }

    // Large file, upload in chunks
    const chunks = Math.ceil(fileSize / CHUNK_SIZE);
    let uploadedBytes = 0;
    const startTime = performance.now();

    for (let i = 0; i < chunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, fileSize);
      const chunk = file.slice(start, end);
      
      const chunkPath = `${uploadPath}.part${i}`;
      
      const { error } = await supabase.storage
        .from('content')
        .upload(chunkPath, chunk, {
          contentType: 'application/octet-stream',
          upsert: true
        });
      
      if (error) throw error;
      
      uploadedBytes += chunk.size;
      const elapsed = performance.now() - startTime;
      const speed = uploadedBytes / (elapsed / 1000);
      const remaining = fileSize - uploadedBytes;
      const eta = remaining / speed;
      
      setUploadProgress(prev => ({
        ...prev,
        phase: 'uploading',
        progress: Math.round((uploadedBytes / fileSize) * 100),
        message: `Uploading... ${Math.round((uploadedBytes / fileSize) * 100)}%`,
        bytesUploaded: uploadedBytes,
        totalBytes: fileSize,
        uploadSpeed: formatSpeed(speed),
        eta: formatTime(eta)
      }));
    }

    // Combine chunks on server (would need an edge function)
    // For now, we'll upload the final file directly
    const { error: finalError } = await supabase.storage
      .from('content')
      .upload(uploadPath, file, {
        contentType: file.type,
        upsert: true
      });
    
    if (finalError) throw finalError;

    // Clean up chunk files
    for (let i = 0; i < chunks; i++) {
      const chunkPath = `${uploadPath}.part${i}`;
      await supabase.storage.from('content').remove([chunkPath]);
    }
  }, []);

  // Main upload function
  const uploadFile = useCallback(async (file: File): Promise<DirectUploadResult> => {
    setUploading(true);
    const startTime = performance.now();
    
    try {
      // Step 1: Authentication check
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Authentication required');
      }

      // Step 2: Generate unique IDs and paths
      const mediaId = crypto.randomUUID();
      const uploadPath = `uploads/${user.id}/${mediaId}_${file.name}`;

      // Step 3: Upload file
      setUploadProgress(prev => ({
        ...prev,
        phase: 'uploading',
        message: 'Uploading file...',
        progress: 80
      }));

      await uploadFileChunked(file, uploadPath);

      // Step 4: Create database record
      const mediaType = file.type.startsWith('image/') ? 'image' : 
                       file.type.startsWith('video/') ? 'video' : 'audio';

      const { data: mediaRecord, error: dbError } = await supabase
        .from('simple_media')
        .insert({
          id: mediaId,
          creator_id: user.id,
          original_filename: file.name,
          original_path: uploadPath,
          mime_type: file.type,
          media_type: mediaType,
          original_size_bytes: file.size,
          processing_status: 'processed'
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Step 6: Generate video thumbnail if needed (async)
      if (mediaType === 'video') {
        generateThumbnailAsync(processedFile, mediaId);
      }

      setUploadProgress(prev => ({
        ...prev,
        phase: 'complete',
        message: 'Upload complete!',
        progress: 100
      }));

      const totalTime = performance.now() - startTime;
      console.log(`Upload completed in ${totalTime.toFixed(0)}ms`);

      return {
        id: mediaId,
        path: uploadPath,
        media_type: mediaType,
        size: processedFile.size,
        compressionRatio: compressionInfo?.compressionRatio,
        processedSize: compressionInfo?.processedSize,
        qualityInfo: compressionInfo
      };

    } catch (error) {
      console.error('Upload failed:', error);
      
      setUploadProgress(prev => ({
        ...prev,
        phase: 'error',
        message: error instanceof Error ? error.message : 'Upload failed'
      }));

      throw error;
    } finally {
      setUploading(false);
    }
  }, [isHeicFile, convertHeicFile, uploadFileChunked, generateThumbnailAsync]);

  // Upload multiple files
  const uploadMultiple = useCallback(async (files: File[]): Promise<DirectUploadResult[]> => {
    const results: DirectUploadResult[] = [];
    
    for (const file of files) {
      try {
        const result = await uploadFile(file);
        results.push(result);
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        // Continue with other files
      }
    }
    
    return results;
  }, [uploadFile]);

  return {
    uploading,
    uploadProgress,
    uploadFile,
    uploadMultiple
  };
};

// Helper functions
const formatSpeed = (bytesPerSecond: number): string => {
  const mbPerSecond = bytesPerSecond / (1024 * 1024);
  return `${mbPerSecond.toFixed(1)} MB/s`;
};

const formatTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
};