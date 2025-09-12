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
      
      // Detect GIF early to preserve animation
      const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name);

      // Determine media type
      const mediaType = isGif ? 'gif' : 
                       file.type.startsWith('image/') ? 'image' : 
                       file.type.startsWith('video/') ? 'video' : 
                       file.type.startsWith('audio/') ? 'audio' : 'image';

      // Check if image needs processing (WebP conversion)
      const isHeicFile = (file: File): boolean => {
        return /\.(heic|heif)$/i.test(file.name) || 
               file.type === 'image/heic' || 
               file.type === 'image/heif';
      };

      // Process images but NOT GIFs (to preserve animation)
      const shouldProcessImage = mediaType === 'image' && !isGif;
      
      let fileToUpload = file;
      let uploadFileName = file.name;
      let thumbnailPath: string | undefined;
      let thumbnailBlob: Blob | undefined;
      let width: number | undefined;
      let height: number | undefined;

      // Process images to WebP (excluding GIFs to preserve animation)
      if (shouldProcessImage) {
        setUploadProgress({
          phase: 'processing',
          progress: 20,
          message: 'Converting image to WebP...',
          originalSize,
          processedSize: originalSize,
          compressionRatio: 0
        });

        try {
          const processedFiles = await processFiles([file]);
          if (processedFiles.length > 0) {
            const processedMedia = processedFiles[0];
            
            // Get the processed WebP blob
            const webpBlob = processedMedia.processedBlobs.get('webp') || processedMedia.thumbnail;
            if (webpBlob) {
              fileToUpload = new File([webpBlob], file.name.replace(/\.[^.]+$/, '.webp'), { 
                type: webpBlob.type 
              });
              uploadFileName = file.name.replace(/\.[^.]+$/, '.webp');
              
              // Update progress with compression info
              processedSize = webpBlob.size;
              compressionRatio = Math.round(((originalSize - processedSize) / originalSize) * 100);
              
              width = processedMedia.metadata.width;
              height = processedMedia.metadata.height;

              console.log(`✅ Image processed: ${file.name} → ${uploadFileName} (${compressionRatio}% smaller)`);

              setUploadProgress({
                phase: 'processing',
                progress: 50,
                message: `WebP conversion complete (${compressionRatio}% smaller)`,
                originalSize,
                processedSize,
                compressionRatio
              });
            }
          }
        } catch (error) {
          console.warn('Image processing failed, uploading original:', error);
          // Continue with original file if processing fails
        }
      }

      // For GIFs, use uploads folder to preserve original format and animation
      const uploadPath = isGif ? `uploads/${fileId}-${file.name}` : `processed/${fileId}-${uploadFileName}`;

      // For videos, generate thumbnail client-side
      if (mediaType === 'video') {
        setUploadProgress({
          phase: 'processing',
          progress: shouldProcessImage ? 60 : 30,
          message: 'Generating thumbnail...',
          originalSize,
          processedSize,
          compressionRatio
        });

        try {
          // Add timeout wrapper for thumbnail generation
          const thumbnailPromise = generateVideoThumbnail(fileToUpload, {
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

          // Skip video dimension analysis to avoid processing errors
        } catch (error) {
          console.warn('Client-side thumbnail generation failed:', error);
          // Continue without thumbnail - video upload will proceed normally
        }
      }

      setUploadProgress({
        phase: 'uploading',
        progress: shouldProcessImage ? 80 : 60,
        message: 'Uploading files...',
        originalSize,
        processedSize,
        compressionRatio
      });

      // Upload file: GIFs to uploads folder (preserve animation), processed images to processed folder
      console.log(`Uploading ${isGif ? 'GIF' : 'processed'} file:`, uploadFileName);
      const originalUpload = await supabase.storage.from('content').upload(uploadPath, fileToUpload, { upsert: false });
      if (originalUpload.error) throw new Error(`Upload failed: ${originalUpload.error.message}`);

      // Thumbnail already generated and uploaded for videos above

      setUploadProgress({
        phase: 'uploading',
        progress: shouldProcessImage ? 90 : 80,
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
          mime_type: isGif ? 'image/gif' : fileToUpload.type,
          original_size_bytes: originalSize,
          optimized_size_bytes: processedSize,
          original_path: uploadPath,
          processed_path: uploadPath,
          thumbnail_path: thumbnailPath,
          media_type: mediaType,
          processing_status: 'processed',
          width: width,
          height: height,
          tags: []
        })
        .select()
        .single();

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }

      // Skip video processing - upload raw videos directly as requested

      setUploadProgress({
        phase: 'complete',
        progress: 100,
        message: shouldProcessImage && compressionRatio > 0 
          ? `Upload complete! Image converted to WebP (${compressionRatio}% smaller)` 
          : mediaType === 'video' 
            ? 'Upload complete! Raw video uploaded without processing.' 
            : 'Upload complete!',
        originalSize,
        processedSize,
        compressionRatio
      });

      console.log('✅ File uploaded successfully:', { 
        id: mediaRecord.id, 
        path: uploadPath,
        thumbnailPath: thumbnailPath,
        processed: shouldProcessImage,
        compressionRatio: shouldProcessImage ? compressionRatio : 0
      });

      toast({
        title: "Upload successful",
        description: shouldProcessImage && compressionRatio > 0
          ? `${file.name} converted to WebP and uploaded (${compressionRatio}% smaller).`
          : mediaType === 'video'
            ? `${file.name} uploaded as raw video without processing.`
            : `${file.name} uploaded successfully.`,
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