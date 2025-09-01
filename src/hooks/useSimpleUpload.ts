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

      let processedPaths: { [quality: string]: string } = {};
      let processedBlobs: { [quality: string]: Blob } = {};
      let thumbnailPath: string | undefined;
      let thumbnailBlob: Blob | undefined;
      let width: number | undefined;
      let height: number | undefined;
      let qualityInfo: any = {};

      // Process media client-side for format conversion and compression
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
            const result = processedFiles[0];
            processedBlobs.image = result.processedFiles.image;
            processedSize = processedBlobs.image.size;
            compressionRatio = Math.round(((originalSize - processedSize) / originalSize) * 100);
            width = result.metadata.width;
            height = result.metadata.height;
            
            // Update processed path with .webp extension
            const baseName = file.name.split('.')[0];
            processedPaths.image = `processed/${fileId}-${baseName}.webp`;
            
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
          throw new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

      } else if (mediaType === 'video') {
        setUploadProgress({
          phase: 'processing',
          progress: 10,
          message: 'Converting video to WebM (multiple qualities)...',
          originalSize,
          processedSize,
          compressionRatio
        });

        try {
          const processedFiles = await processFiles([file]);
          if (processedFiles.length > 0) {
            const result = processedFiles[0];
            const baseName = file.name.split('.')[0];
            
            // Store all quality variants
            if (result.processedFiles.video_480p) {
              processedBlobs['480p'] = result.processedFiles.video_480p;
              processedPaths['480p'] = `processed/${fileId}-${baseName}_480p.webm`;
            }
            if (result.processedFiles.video_720p) {
              processedBlobs['720p'] = result.processedFiles.video_720p;
              processedPaths['720p'] = `processed/${fileId}-${baseName}_720p.webm`;
            }
            if (result.processedFiles.video_1080p) {
              processedBlobs['1080p'] = result.processedFiles.video_1080p;
              processedPaths['1080p'] = `processed/${fileId}-${baseName}_1080p.webm`;
            }
            
            // Store thumbnail
            if (result.processedFiles.thumbnail) {
              thumbnailBlob = result.processedFiles.thumbnail;
              thumbnailPath = `processed/thumbnails/${fileId}-${baseName}_thumb.jpg`;
            }
            
            // Use 480p size for compression calculation
            processedSize = processedBlobs['480p']?.size || originalSize;
            compressionRatio = result.metadata.compressionRatio || 0;
            width = result.metadata.width;
            height = result.metadata.height;
            qualityInfo = result.metadata.qualityInfo || {};
            
            setUploadProgress({
              phase: 'processing',
              progress: 70,
              message: `Video converted (${compressionRatio}% reduction)`,
              originalSize,
              processedSize,
              compressionRatio
            });
          }
        } catch (error) {
          throw new Error(`Video processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

      } else if (mediaType === 'audio') {
        setUploadProgress({
          phase: 'processing',
          progress: 10,
          message: 'Converting audio to WebM/Opus...',
          originalSize,
          processedSize,
          compressionRatio
        });

        try {
          const processedFiles = await processFiles([file]);
          if (processedFiles.length > 0 && processedFiles[0].processedFiles.audio) {
            const result = processedFiles[0];
            processedBlobs.audio = result.processedFiles.audio;
            processedSize = processedBlobs.audio.size;
            compressionRatio = result.metadata.compressionRatio || 0;
            qualityInfo = result.metadata.qualityInfo || {};
            
            const baseName = file.name.split('.')[0];
            processedPaths.audio = `processed/${fileId}-${baseName}.webm`;
            
            setUploadProgress({
              phase: 'processing',
              progress: 50,
              message: `Audio optimized (${compressionRatio}% reduction)`,
              originalSize,
              processedSize,
              compressionRatio
            });
          }
        } catch (error) {
          throw new Error(`Audio processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

      // Build upload promises for all files
      const uploadPromises = [
        // Always upload original to incoming/
        supabase.storage.from('content').upload(originalPath, file, { upsert: false })
      ];

      // Upload processed files
      Object.entries(processedBlobs).forEach(([quality, blob]) => {
        const path = processedPaths[quality];
        if (path && blob) {
          uploadPromises.push(
            supabase.storage.from('content').upload(path, blob, { upsert: false })
          );
        }
      });

      // Upload thumbnail if available
      if (thumbnailBlob && thumbnailPath) {
        uploadPromises.push(
          supabase.storage.from('content').upload(thumbnailPath, thumbnailBlob, { upsert: false })
        );
      }

      const uploadResults = await Promise.all(uploadPromises);

      // Check for upload errors
      for (let i = 0; i < uploadResults.length; i++) {
        if (uploadResults[i].error) {
          const fileName = i === 0 ? 'original' : 
                         i === uploadResults.length - 1 && thumbnailPath ? 'thumbnail' : 
                         `processed variant ${i}`;
          throw new Error(`${fileName} upload failed: ${uploadResults[i].error.message}`);
        }
      }

      setUploadProgress({
        phase: 'uploading',
        progress: 80,
        message: 'Creating database record...',
        originalSize,
        processedSize,
        compressionRatio
      });

      // Determine final mime type and processed path
      const finalMimeType = mediaType === 'image' ? 'image/webp' :
                           mediaType === 'video' ? 'video/webm' :
                           mediaType === 'audio' ? 'audio/webm' : file.type;

      const defaultProcessedPath = processedPaths['480p'] || processedPaths.image || processedPaths.audio || originalPath;

      // Create database record with comprehensive media info
      const { data: mediaRecord, error: dbError } = await supabase
        .from('simple_media')
        .insert({
          creator_id: user.id,
          original_filename: file.name,
          title: file.name.split('.')[0],
          mime_type: finalMimeType,
          original_size_bytes: originalSize,
          optimized_size_bytes: processedSize,
          original_path: originalPath,
          processed_path: defaultProcessedPath,
          thumbnail_path: thumbnailPath,
          media_type: mediaType,
          processing_status: 'processed',
          width: width,
          height: height,
          processed_at: new Date().toISOString(),
          tags: []
        })
        .select()
        .single();

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }

      // Store quality variants in a separate table or JSON field if needed
      // For now, we'll use the default processed_path for the 480p/main quality

      setUploadProgress({
        phase: 'complete',
        progress: 100,
        message: `Upload complete! ${compressionRatio > 0 ? `${compressionRatio}% size reduction` : ''}`,
        originalSize,
        processedSize,
        compressionRatio
      });

      // Trigger cleanup of original file since processing is complete
      supabase.functions.invoke('media-optimizer', {
        body: {
          mediaId: mediaRecord.id,
          originalPath,
          processedPaths,
          thumbnailPath,
          mimeType: finalMimeType,
          mediaType,
          skipProcessing: true, // Processing already done client-side
          qualityInfo
        }
      }).catch(error => {
        console.error('Background cleanup failed:', error);
      });

      toast({
        title: "Upload successful",
        description: compressionRatio > 0 
          ? `${file.name} uploaded with ${compressionRatio}% size reduction`
          : `${file.name} uploaded successfully`,
      });

      return { 
        ...mediaRecord, 
        compressionRatio, 
        processedSize, 
        qualityInfo,
        processedPaths,
        thumbnailPath 
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