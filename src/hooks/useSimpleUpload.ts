import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useClientMediaProcessor } from './useClientMediaProcessor';

interface UploadProgress {
  phase: 'processing' | 'uploading' | 'complete';
  progress: number;
  message: string;
  originalSize?: number;
  processedSize?: number;
  compressionRatio?: number;
}

export const useSimpleUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    phase: 'processing',
    progress: 0,
    message: 'Starting...'
  });
  const { toast } = useToast();
  const { processFiles, isProcessing, progress: processingProgress } = useClientMediaProcessor();

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
      const originalPath = `incoming/${fileId}-${file.name}`;
      
      // Determine media type
      const mediaType = file.type.startsWith('image/') ? 'image' : 
                       file.type.startsWith('video/') ? 'video' : 
                       file.type.startsWith('audio/') ? 'audio' : 'image';

      let processedPath = originalPath;
      let processedBlob: Blob = file;
      let width: number | undefined;
      let height: number | undefined;

      // Process images client-side for WebP conversion and compression
      if (mediaType === 'image') {
        setUploadProgress({
          phase: 'processing',
          progress: 10,
          message: 'Converting image to WebP...',
          originalSize,
          processedSize,
          compressionRatio
        });

        try {
          const processedFiles = await processFiles([file]);
          if (processedFiles.length > 0 && processedFiles[0].processedFiles.image) {
            processedBlob = processedFiles[0].processedFiles.image;
            processedSize = processedBlob.size;
            compressionRatio = Math.round(((originalSize - processedSize) / originalSize) * 100);
            width = processedFiles[0].metadata.width;
            height = processedFiles[0].metadata.height;
            
            // Update processed path with .webp extension
            const baseName = file.name.split('.')[0];
            processedPath = `processed/${fileId}-${baseName}.webp`;
            
            setUploadProgress({
              phase: 'processing',
              progress: 50,
              message: `Image optimized (${compressionRatio}% reduction)`,
              originalSize,
              processedSize,
              compressionRatio
            });
          }
        } catch (error) {
          console.warn('Client-side image processing failed, using original:', error);
          // Continue with original file
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

      // Upload both original and processed files
      const uploadPromises = [
        // Upload original to incoming/
        supabase.storage
          .from('content')
          .upload(originalPath, file, { upsert: false }),
        
        // Upload processed version to processed/ (or same as original if not processed)
        processedBlob !== file 
          ? supabase.storage
              .from('content')
              .upload(processedPath, processedBlob, { upsert: false })
          : Promise.resolve({ error: null })
      ];

      const [originalUpload, processedUpload] = await Promise.all(uploadPromises);

      if (originalUpload.error) {
        throw new Error(`Original upload failed: ${originalUpload.error.message}`);
      }

      if (processedBlob !== file && processedUpload?.error) {
        throw new Error(`Processed upload failed: ${processedUpload.error.message}`);
      }

      setUploadProgress({
        phase: 'uploading',
        progress: 80,
        message: 'Creating database record...',
        originalSize,
        processedSize,
        compressionRatio
      });

      // Create database record with both original and processed info
      const { data: mediaRecord, error: dbError } = await supabase
        .from('simple_media')
        .insert({
          creator_id: user.id,
          original_filename: file.name,
          title: file.name.split('.')[0],
          mime_type: processedBlob !== file ? 'image/webp' : file.type,
          original_size_bytes: originalSize,
          optimized_size_bytes: processedSize,
          original_path: originalPath,
          processed_path: processedBlob !== file ? processedPath : originalPath,
          media_type: mediaType,
          processing_status: processedBlob !== file ? 'processed' : 'pending',
          width: width,
          height: height,
          processed_at: processedBlob !== file ? new Date().toISOString() : undefined
        })
        .select()
        .single();

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }

      setUploadProgress({
        phase: 'complete',
        progress: 100,
        message: `Upload complete! ${compressionRatio > 0 ? `${compressionRatio}% size reduction` : ''}`,
        originalSize,
        processedSize,
        compressionRatio
      });

      // Only trigger optimizer for non-image files or failed image processing
      if (mediaType !== 'image' || processedBlob === file) {
        supabase.functions.invoke('media-optimizer', {
          body: {
            mediaId: mediaRecord.id,
            originalPath,
            mimeType: file.type,
            mediaType
          }
        }).catch(error => {
          console.error('Background optimization failed:', error);
        });
      } else {
        // For successfully processed images, trigger cleanup of original
        supabase.functions.invoke('media-optimizer', {
          body: {
            mediaId: mediaRecord.id,
            originalPath,
            processedPath,
            mimeType: 'image/webp',
            mediaType: 'image',
            skipProcessing: true // Flag to skip processing and just cleanup
          }
        }).catch(error => {
          console.error('Background cleanup failed:', error);
        });
      }

      toast({
        title: "Upload successful",
        description: compressionRatio > 0 
          ? `${file.name} uploaded with ${compressionRatio}% size reduction`
          : `${file.name} uploaded successfully`,
      });

      return { ...mediaRecord, compressionRatio, processedSize };

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
  }, [toast, processFiles]);

  const uploadMultiple = useCallback(async (files: File[]) => {
    const results = [];
    
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
    uploadFile,
    uploadMultiple,
    uploadProgress,
    isProcessing
  };
};