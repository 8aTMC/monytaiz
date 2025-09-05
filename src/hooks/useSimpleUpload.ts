import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useClientMediaProcessor, type ProcessedMedia } from './useClientMediaProcessor';
import { useMediaPostProcess } from './useMediaPostProcess';
import { generateVideoThumbnail } from '@/lib/videoThumbnail';

interface QualityProgress {
  resolution: string;
  targetSize?: number;
  actualSize?: number;
  compressionRatio?: number;
  encodingProgress: number;
  status: 'pending' | 'processing' | 'complete' | 'error';
}

interface ProcessingPhase {
  name: string;
  progress: number;
  status: 'pending' | 'active' | 'complete' | 'error';
}

interface DetailedUploadProgress {
  phase: 'processing' | 'uploading' | 'complete';
  progress: number;
  message: string;
  originalSize?: number;
  processedSize?: number;
  compressionRatio?: number;
  bytesUploaded?: number;
  totalBytes?: number;
  uploadSpeed?: string;
  eta?: string;
  qualityProgress?: Record<string, QualityProgress>;
  processingPhases?: ProcessingPhase[];
}

interface UploadProgress extends DetailedUploadProgress {}

export const useSimpleUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    phase: 'processing',
    progress: 0,
    message: 'Starting...'
  });
  const { toast } = useToast();
  const { processFiles, isProcessing, progress: processingProgress, canProcessVideo } = useClientMediaProcessor();
  const { processMedia } = useMediaPostProcess();

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const originalSize = file.size;
      let processedSize = originalSize;
      let compressionRatio = 0;

      setUploadProgress({
        phase: 'processing',
        progress: 0,
        message: 'Processing file...',
        originalSize,
        processedSize,
        compressionRatio
      });

      // Generate unique file ID and paths
      const fileId = crypto.randomUUID();
      
      // Determine media type
      const mediaType = file.type.startsWith('image/') ? 'image' : 
                       file.type.startsWith('video/') ? 'video' : 
                       file.type.startsWith('audio/') ? 'audio' : 'image';

      // Upload directly to processed folder (no processing needed)
      const uploadPath = `processed/${fileId}-${file.name}`;
      
      let thumbnailPath: string | undefined;
      let thumbnailBlob: Blob | undefined;
      let width: number | undefined;
      let height: number | undefined;

      // For videos, generate thumbnail client-side
      if (mediaType === 'video') {
        setUploadProgress({
          phase: 'processing',
          progress: 30,
          message: 'Generating thumbnail...',
          originalSize,
          processedSize: originalSize,
          compressionRatio: 0
        });

        try {
          // Add timeout wrapper for thumbnail generation
          const thumbnailPromise = generateVideoThumbnail(file, {
            width: 320,
            height: 180,
            quality: 0.8,
            timePosition: 1
          });

          // Race between thumbnail generation and timeout
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Thumbnail generation timeout')), 15000);
          });

          const { blob: generatedThumbnail } = await Promise.race([
            thumbnailPromise,
            timeoutPromise
          ]);
          
          // Upload thumbnail to storage
          const thumbnailFilename = `thumbnails/${fileId}-thumbnail.jpg`;
          const thumbnailUpload = await supabase.storage
            .from('content')
            .upload(thumbnailFilename, generatedThumbnail, { 
              contentType: 'image/jpeg',
              upsert: false 
            });

          if (thumbnailUpload.error) {
            console.warn('Thumbnail upload failed:', thumbnailUpload.error);
          } else {
            thumbnailPath = thumbnailFilename;
            console.log('✅ Thumbnail uploaded:', thumbnailPath);
          }

          // Try to get video dimensions using processFiles as fallback
          try {
            const processedFiles = await processFiles([file]);
            if (processedFiles.length > 0) {
              const result = processedFiles[0];
              width = result.metadata.width;
              height = result.metadata.height;
            }
          } catch (error) {
            console.warn('Video analysis failed:', error);
          }
        } catch (error) {
          console.warn('Client-side thumbnail generation failed:', error);
          // Continue without thumbnail - video upload will proceed normally
        }
      }

      setUploadProgress({
        phase: 'uploading',
        progress: 60,
        message: 'Uploading files...',
        originalSize,
        processedSize,
        compressionRatio
      });

      // Upload original file directly to processed folder (skip processing)
      console.log('Uploading original file directly to processed folder...');
      const originalUpload = await supabase.storage.from('content').upload(uploadPath, file, { upsert: false });
      if (originalUpload.error) throw new Error(`Original upload failed: ${originalUpload.error.message}`);

      // Thumbnail already generated and uploaded for videos above

      setUploadProgress({
        phase: 'uploading',
        progress: 80,
        message: 'Creating database record...',
        originalSize,
        processedSize,
        compressionRatio
      });

      // Create database record
      const { data: mediaRecord, error: dbError } = await supabase
        .from('simple_media')
        .insert({
          creator_id: user.id,
          original_filename: file.name,
          title: file.name.split('.')[0],
          mime_type: file.type,
          original_size_bytes: originalSize,
          optimized_size_bytes: processedSize,
          original_path: uploadPath,
          processed_path: uploadPath,
          thumbnail_path: thumbnailPath,
          media_type: mediaType,
          processing_status: mediaType === 'video' ? 'processing' : 'processed',
          width: width,
          height: height,
          tags: []
        })
        .select()
        .single();

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }

      // For videos, trigger background quality processing
      if (mediaType === 'video') {
        setUploadProgress({
          phase: 'processing',
          progress: 90,
          message: 'Starting video quality processing...',
          originalSize,
          processedSize,
          compressionRatio
        });

        try {
          // Trigger video processing in background
          const { error: processingError } = await supabase.functions.invoke('video-processor-v2', {
            body: {
              bucket: 'content',
              path: uploadPath,
              fileName: file.name,
              mediaId: mediaRecord.id,
              targetQualities: ['480p', '720p', '1080p']
            }
          });

          if (processingError) {
            console.warn('Video processing failed:', processingError);
            // Don't throw error - video is still uploaded, just no quality variants
          }
        } catch (error) {
          console.warn('Failed to trigger video processing:', error);
        }
      }

      setUploadProgress({
        phase: 'complete',
        progress: 100,
        message: mediaType === 'video' ? 'Upload complete! Quality processing started in background.' : 'Upload complete!',
        originalSize,
        processedSize,
        compressionRatio
      });

      console.log('✅ File uploaded successfully:', { 
        id: mediaRecord.id, 
        path: uploadPath,
        thumbnailPath: thumbnailPath
      });

      toast({
        title: "Upload successful",
        description: `${file.name} uploaded successfully.`,
        variant: "default"
      });

      return { 
        ...mediaRecord, 
        compressionRatio, 
        processedSize,
        thumbnailPath,
        qualityInfo: file.type.startsWith('video/') ? {
          original: { path: uploadPath, available: true }
        } : null
      };

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      });
      throw error;
    } finally {
      setUploading(false);
    }
  }, [toast, processFiles, canProcessVideo, processMedia]);

  const uploadMultiple = useCallback(async (files: File[]) => {
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
    uploadProgress,
    isProcessing
  };
};