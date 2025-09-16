import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useClientMediaProcessor, type ProcessedMedia } from './useClientMediaProcessor';
import { useMediaPostProcess } from './useMediaPostProcess';
import { uploadWithProgress } from '@/lib/uploadWithProgress';
import { logger } from '@/utils/logging';

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
  phase: 'processing' | 'uploading' | 'complete' | 'queued_for_processing' | 'paused' | 'cancelled';
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

interface FileUploadState {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error' | 'cancelled';
  progress: number;
  message: string;
  abortController?: AbortController;
  result?: any;
  error?: string;
}

export const useSimpleUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    phase: 'processing',
    progress: 0,
    message: 'Starting...'
  });
  const [fileStates, setFileStates] = useState<Map<string, FileUploadState>>(new Map());
  const [isPaused, setIsPaused] = useState(false);
  const { toast } = useToast();
  const { processFiles, isProcessing, progress: processingProgress, canProcessVideo } = useClientMediaProcessor();
  const { processMedia } = useMediaPostProcess();
  const uploadQueueRef = useRef<string[]>([]);
  const cancelledRef = useRef(false);
  const pausedRef = useRef(false);

  const uploadFile = useCallback(async (file: File, onProgress?: (progress: UploadProgress) => void) => {
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

      const updateProgress = (progress: UploadProgress) => {
        setUploadProgress(progress);
        onProgress?.(progress);
      };

      updateProgress({
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
        updateProgress({
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

              // logger.debug(`Image processed: ${file.name} → ${uploadFileName} (${compressionRatio}% smaller)`);

              updateProgress({
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
          logger.error('[UploadError] Image processing failed, uploading original', error);
          // Continue with original file if processing fails
        }
      }

      // For GIFs, use uploads folder to preserve original format and animation
      const uploadPath = isGif ? `uploads/${fileId}-${file.name}` : `processed/${fileId}-${uploadFileName}`;

      // Generate video thumbnail client-side before upload
      let videoThumbnailPath: string | undefined;
      if (mediaType === 'video') {
        try {
          console.log(`📹 Generating client-side thumbnail for video: ${file.name}`);
          const { generateVideoThumbnail } = await import('@/lib/videoThumbnail');
          const { blob } = await generateVideoThumbnail(file, {
            width: 320,
            height: 180,
            quality: 0.8,
            timePosition: 1
          });
          
          // Upload thumbnail to storage
          const thumbnailFilename = `${fileId}-${file.name.replace(/\.[^/.]+$/, '')}-thumbnail.jpg`;
          const thumbnailStoragePath = `content/thumbnails/${thumbnailFilename}`;
          
          const { error: thumbnailUploadError } = await supabase.storage
            .from('content')
            .upload(thumbnailStoragePath, blob, {
              contentType: 'image/jpeg',
              cacheControl: '3600'
            });
          
          if (!thumbnailUploadError) {
            videoThumbnailPath = thumbnailStoragePath;
            console.log(`✅ Video thumbnail uploaded successfully: ${videoThumbnailPath}`);
          } else {
            console.error('❌ Video thumbnail upload failed:', thumbnailUploadError);
          }
        } catch (thumbnailError) {
          console.error('❌ Client-side video thumbnail generation failed:', thumbnailError);
          // Continue with upload even if thumbnail fails
        }
      }

      updateProgress({
        phase: 'uploading',
        progress: shouldProcessImage ? 80 : 60,
        message: 'Uploading files...',
        originalSize,
        processedSize,
        compressionRatio
      });

      // Upload file with real progress tracking
      const { data: uploadData, error: uploadError } = await uploadWithProgress(
        'content',
        uploadPath,
        fileToUpload,
        (progressEvent) => {
          const progressPercent = Math.min(95, progressEvent.progress);
          updateProgress({
            phase: 'uploading',
            progress: progressPercent,
            message: `Uploading... ${(progressEvent.bytesUploaded / (1024 * 1024)).toFixed(1)}MB / ${(progressEvent.totalBytes / (1024 * 1024)).toFixed(1)}MB`,
            originalSize,
            processedSize,
            compressionRatio
          });
        },
        new AbortController()
      );
      
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      // Thumbnail already generated and uploaded for videos above

      updateProgress({
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
          thumbnail_path: videoThumbnailPath || thumbnailPath,
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

      updateProgress({
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

      // logger.debug('File uploaded successfully', { id: mediaRecord.id, path: uploadPath, thumbnailPath, processed: shouldProcessImage, compressionRatio: shouldProcessImage ? compressionRatio : 0 });


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
      logger.error('[UploadError] Upload error', error);
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
        logger.error('[UploadError] Failed to upload file', { name: file.name, error });
      }
    }
    
    return results;
  }, [uploadFile]);

  const uploadMultipleWithControls = useCallback(async (
    files: Array<{ file: File; id: string; metadata?: any }>,
    onProgress?: (fileId: string, progress: UploadProgress) => void,
    onComplete?: (fileId: string, result: any) => void,
    onError?: (fileId: string, error: string) => void
  ) => {
    setUploading(true);
    setIsPaused(false);
    pausedRef.current = false;
    cancelledRef.current = false;
    
    const newFileStates = new Map<string, FileUploadState>();
    files.forEach(({ file, id }) => {
      newFileStates.set(id, {
        file,
        id,
        status: 'pending',
        progress: 0,
        message: 'Waiting to start...',
        abortController: new AbortController()
      });
    });
    setFileStates(newFileStates);
    uploadQueueRef.current = files.map(f => f.id);

    try {
      for (const { file, id } of files) {
        if (cancelledRef.current) break;
        let currentState = newFileStates.get(id);
        if (!currentState || currentState.status === 'cancelled') continue;

        while (pausedRef.current && !cancelledRef.current) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (cancelledRef.current) break;

        // Update file state to uploading
        newFileStates.set(id, { ...currentState, status: 'uploading', message: 'Starting upload...' });
        setFileStates(new Map(newFileStates));
        onProgress?.(id, { phase: 'processing', progress: 0, message: 'Starting upload...' });

        try {
          const result = await uploadFile(file, (progress) => onProgress?.(id, progress));
          newFileStates.set(id, { ...currentState, status: 'completed', progress: 100, message: 'Upload completed', result });
          setFileStates(new Map(newFileStates));
          onComplete?.(id, result);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Upload failed';
          newFileStates.set(id, { ...currentState, status: 'error', message: errorMessage, error: errorMessage });
          setFileStates(new Map(newFileStates));
          onError?.(id, errorMessage);
        }
      }
    } finally {
      setUploading(false);
      setIsPaused(false);
      pausedRef.current = false;
    }
  }, [uploadFile]);

  const pauseAllUploads = useCallback(() => {
    pausedRef.current = true;
    setIsPaused(true);
    setFileStates(prev => {
      const newStates = new Map(prev);
      newStates.forEach((state) => {
        if (state.status === 'uploading') {
          newStates.set(state.id, { ...state, status: 'paused', message: 'Upload paused' });
        }
      });
      return newStates;
    });
  }, []);

  const resumeAllUploads = useCallback(() => {
    pausedRef.current = false;
    setIsPaused(false);
    setFileStates(prev => {
      const newStates = new Map(prev);
      newStates.forEach((state) => {
        if (state.status === 'paused') {
          newStates.set(state.id, { ...state, status: 'pending', message: 'Resuming upload...' });
        }
      });
      return newStates;
    });
  }, []);

  const cancelAllUploads = useCallback(() => {
    cancelledRef.current = true;
    setUploading(false);
    setIsPaused(false);
    setFileStates(prev => {
      const newStates = new Map(prev);
      newStates.forEach((state) => {
        if (state.status === 'uploading' || state.status === 'pending' || state.status === 'paused') {
          state.abortController?.abort();
          newStates.set(state.id, { ...state, status: 'cancelled', message: 'Upload cancelled' });
        }
      });
      return newStates;
    });
  }, []);

  const cancelFileUpload = useCallback((fileId: string) => {
    setFileStates(prev => {
      const newStates = new Map(prev);
      const state = newStates.get(fileId);
      if (state && (state.status === 'uploading' || state.status === 'pending' || state.status === 'paused')) {
        state.abortController?.abort();
        newStates.set(fileId, { ...state, status: 'cancelled', message: 'Upload cancelled' });
      }
      return newStates;
    });
  }, []);

  const pauseFileUpload = useCallback((fileId: string) => {
    setFileStates(prev => {
      const newStates = new Map(prev);
      const state = newStates.get(fileId);
      if (state && state.status === 'uploading') {
        newStates.set(fileId, { ...state, status: 'paused', message: 'Upload paused' });
      }
      return newStates;
    });
  }, []);

  const resumeFileUpload = useCallback((fileId: string) => {
    setFileStates(prev => {
      const newStates = new Map(prev);
      const state = newStates.get(fileId);
      if (state && state.status === 'paused') {
        newStates.set(fileId, { ...state, status: 'pending', message: 'Resuming upload...' });
      }
      return newStates;
    });
  }, []);

  return {
    uploading,
    uploadFile,
    uploadMultiple,
    uploadMultipleWithControls,
    uploadProgress,
    isProcessing,
    fileStates,
    isPaused,
    pauseAllUploads,
    resumeAllUploads,
    cancelAllUploads,
    cancelFileUpload,
    pauseFileUpload,
    resumeFileUpload
  };
};