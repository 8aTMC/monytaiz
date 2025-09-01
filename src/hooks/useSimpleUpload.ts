import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useClientMediaProcessor, type ProcessedMedia } from './useClientMediaProcessor';
import { useMediaPostProcess } from './useMediaPostProcess';

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

      // For videos, create thumbnail only
      if (mediaType === 'video') {
        setUploadProgress({
          phase: 'processing',
          progress: 30,
          message: 'Creating video thumbnail...',
          originalSize,
          processedSize: originalSize,
          compressionRatio: 0
        });

        try {
          const processedFiles = await processFiles([file]);
          if (processedFiles.length > 0) {
            const result = processedFiles[0];
            const baseName = file.name.split('.')[0];
            
            // Store thumbnail in thumbnails folder
            if (result.thumbnail) {
              thumbnailBlob = result.thumbnail;
              thumbnailPath = `thumbnails/${fileId}-${baseName}_thumb.jpg`;
            }
            
            width = result.metadata.width;
            height = result.metadata.height;
          }
        } catch (error) {
          console.warn('Video thumbnail creation failed:', error);
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
      const processedPath = `processed/${fileId}/${file.name}`;
      console.log('Uploading original file directly to processed folder...');
      const originalUpload = await supabase.storage.from('content').upload(processedPath, file, { upsert: false });
      if (originalUpload.error) throw new Error(`Original upload failed: ${originalUpload.error.message}`);

      // Upload thumbnail if available
      if (thumbnailBlob && thumbnailPath) {
        console.log('Uploading thumbnail...');
        const thumbnailUpload = await supabase.storage.from('content').upload(thumbnailPath, thumbnailBlob, { upsert: false });
        if (thumbnailUpload.error) throw new Error(`Thumbnail upload failed: ${thumbnailUpload.error.message}`);
      }

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
          processing_status: 'pending',
          width: width,
          height: height,
          tags: []
        })
        .select()
        .single();

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }

      setUploadProgress({
        phase: 'complete',
        progress: 100,
        message: 'Upload complete!',
        originalSize,
        processedSize,
        compressionRatio
      });

      console.log('✅ File uploaded successfully:', { 
        id: mediaRecord.id, 
        path: uploadPath,
        thumbnailPath 
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
          original: { path: processedPath, available: true }
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