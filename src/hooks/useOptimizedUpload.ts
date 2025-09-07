import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useClientMediaProcessor, ProcessedMedia } from './useClientMediaProcessor';

export interface OptimizedUploadItem {
  id: string;
  originalFile: File;
  processed: ProcessedMedia | null;
  status: 'queued' | 'processing' | 'uploading_original' | 'uploading_processed' | 'finalizing' | 'complete' | 'error' | 'needs_retry';
  progress: number;
  error?: string;
  mediaRowId?: string;
  originalPath?: string;
  processedPaths?: {
    image?: string;
    video_1080p?: string;
    video_720p?: string;
    video_480p?: string;
    audio?: string;
    thumbnail?: string;
  };
  retryable?: boolean;
}

export const useOptimizedUpload = () => {
  const [uploadQueue, setUploadQueue] = useState<OptimizedUploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
  
  const { processFiles, isProcessing, progress: processingProgress } = useClientMediaProcessor();
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get file type for storage organization
  const getFileType = useCallback((file: File): 'image' | 'video' | 'audio' | 'document' => {
    // Check MIME type first
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    
    // Fallback to file extension for files with missing/unknown MIME types (e.g., HEIC)
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'].includes(extension)) return 'image';
    if (extension && ['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(extension)) return 'video';
    if (extension && ['mp3', 'wav', 'aac', 'ogg'].includes(extension)) return 'audio';
    
    return 'document';
  }, []);

  // Add files to upload queue
  const addFiles = useCallback(async (files: File[]) => {
    if (isUploading || isProcessing) {
      toast({
        title: "Upload in progress",
        description: "Please wait for current upload to complete",
        variant: "destructive"
      });
      return;
    }

    // Validate files
    const validFiles = files.filter(file => {
      const maxSize = 50 * 1024 * 1024; // 50MB limit
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 50MB limit`,
          variant: "destructive"
        });
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    // Create initial upload items
    const uploadItems: OptimizedUploadItem[] = validFiles.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      originalFile: file,
      processed: null,
      status: 'queued',
      progress: 0
    }));

    setUploadQueue(prev => [...prev, ...uploadItems]);

    // Start client-side processing
    try {
      const processedFiles = await processFiles(validFiles);
      
      // Update queue with processed results
      setUploadQueue(prev => prev.map(item => {
        const processed = processedFiles.find(p => p.originalFile.name === item.originalFile.name);
        if (processed) {
          return {
            ...item,
            processed,
            status: processed.metadata.format === 'needs_processing' ? 'needs_retry' as const : 'queued' as const,
            retryable: processed.metadata.format === 'needs_processing'
          };
        }
        return item;
      }));

      toast({
        title: "Files processed",
        description: `${processedFiles.length} files ready for upload`,
        variant: "success"
      });

    } catch (error) {
      console.error('Processing failed:', error);
      toast({
        title: "Processing failed",
        description: "Files will be uploaded as originals",
        variant: "destructive"
      });
    }
  }, [isUploading, isProcessing, processFiles, toast]);

  // Upload single file (original to content/incoming/)
  const uploadOriginal = useCallback(async (
    file: File, 
    userId: string,
    signal?: AbortSignal
  ): Promise<{ path: string; mediaRowId: string }> => {
    const fileType = getFileType(file);
    const fileName = `${crypto.randomUUID()}.${file.name.split('.').pop()}`;
    const originalPath = `incoming/${fileName}`;

    // Upload to temporary location
    const { data, error } = await supabase.storage
      .from('content')
      .upload(originalPath, file, {
        cacheControl: '31536000', // 1 year cache for safety
        upsert: false,
        contentType: file.type
      });

    if (error) throw error;

    // Create media row with original path
    const { data: mediaRow, error: dbError } = await supabase
      .from('media')
      .insert({
        bucket: 'content',
        creator_id: userId,
        created_by: userId,
        origin: 'upload',
        storage_path: data.path,
        original_path: data.path,
        mime: file.type,
        type: fileType,
        size_bytes: file.size,
        title: file.name.replace(/\.[^/.]+$/, ''),
        processing_status: 'processing'
      })
      .select('id')
      .single();

    if (dbError) throw dbError;

    return { path: data.path, mediaRowId: mediaRow.id };
  }, [getFileType]);

  // Upload processed files to content/processed/
  const uploadProcessed = useCallback(async (
    processed: ProcessedMedia,
    mediaRowId: string,
    signal?: AbortSignal
  ): Promise<{ [key: string]: string }> => {
    const uploadedPaths: { [key: string]: string } = {};
    const baseFolder = `processed/${mediaRowId}`;

    // Upload image
    if (processed.processedBlobs.has('webp')) {
      const webpBlob = processed.processedBlobs.get('webp')!;
      const imagePath = `${baseFolder}/image.webp`;
      const { data, error } = await supabase.storage
        .from('content')
        .upload(imagePath, webpBlob, {
          cacheControl: '31536000',
          upsert: false,
          contentType: 'image/webp'
        });
      
      if (error) throw error;
      uploadedPaths.image = data.path;
    }

    // Upload WebM video
    if (processed.processedBlobs.has('webm')) {
      const webmBlob = processed.processedBlobs.get('webm')!;
      const videoPath = `${baseFolder}/video.webm`;
      const { data, error } = await supabase.storage
        .from('content')
        .upload(videoPath, webmBlob, {
          cacheControl: '31536000',
          upsert: false,
          contentType: 'video/webm'
        });
      
      if (error) throw error;
      uploadedPaths.video = data.path;
    }

    // Upload thumbnail
    if (processed.processedBlobs.has('thumbnail')) {
      const thumbnailBlob = processed.processedBlobs.get('thumbnail')!;
      const thumbnailPath = `${baseFolder}/thumbnail.jpg`;
      const { data, error } = await supabase.storage
        .from('content')
        .upload(thumbnailPath, thumbnailBlob, {
          cacheControl: '31536000',
          upsert: false,
          contentType: 'image/jpeg'
        });
      
      if (error) throw error;
      uploadedPaths.thumbnail = data.path;
    }

    return uploadedPaths;
  }, []);

  // Finalize media (update DB, delete original)
  const finalizeMedia = useCallback(async (
    mediaRowId: string,
    originalPath: string,
    processedPaths: { [key: string]: string },
    metadata: ProcessedMedia['metadata'],
    tinyPlaceholder: string
  ) => {
    const requestBody = {
      id: mediaRowId,
      bucket: 'content',
      original_key: originalPath,
      processed: {
        image_key: processedPaths.image,
        video_1080_key: processedPaths.video_1080p,
        video_720_key: processedPaths.video_720p
      },
      meta: {
        width: metadata.width,
        height: metadata.height,
        duration: metadata.duration,
        tiny_placeholder: tinyPlaceholder
      }
    };

    console.log('Sending finalize-media request:', JSON.stringify(requestBody, null, 2));

    const { data, error } = await supabase.functions.invoke('finalize-media', {
      body: requestBody
    });

    if (error) {
      console.error('finalize-media error:', error);
      // Log server error message for debugging
      if (error.context) {
        try {
          const errorBody = await error.context.clone().text();
          console.error('finalize-media error body:', errorBody);
        } catch (e) {
          console.error('Could not read error body:', e);
        }
      }
      throw error;
    }
    
    console.log('finalize-media success:', data);
    return data;
  }, []);

  // Process single upload item
  const processUploadItem = useCallback(async (
    item: OptimizedUploadItem,
    userId: string,
    index: number
  ): Promise<boolean> => { // Return success status
    const updateStatus = (status: OptimizedUploadItem['status'], progress: number, error?: string) => {
      setUploadQueue(prev => prev.map((queueItem, idx) => 
        idx === index ? { ...queueItem, status, progress, error } : queueItem
      ));
    };

    try {
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      // Step 1: Upload original
      updateStatus('uploading_original', 10, undefined);
      const { path: originalPath, mediaRowId } = await uploadOriginal(
        item.originalFile, 
        userId, 
        signal
      );

      setUploadQueue(prev => prev.map((queueItem, idx) => 
        idx === index ? { ...queueItem, mediaRowId, originalPath } : queueItem
      ));

      // Step 2: Upload processed files (if available)
      if (item.processed && item.processed.processedBlobs.size > 0) {
        updateStatus('uploading_processed', 40);
        
        const processedPaths = await uploadProcessed(item.processed, mediaRowId, signal);
        
        setUploadQueue(prev => prev.map((queueItem, idx) => 
          idx === index ? { ...queueItem, processedPaths } : queueItem
        ));

        // Step 3: Finalize (update DB, delete original)
        updateStatus('finalizing', 80);
        
        await finalizeMedia(
          mediaRowId,
          originalPath,
          processedPaths,
          item.processed.metadata,
          item.processed.tinyPlaceholder
        );
        
        updateStatus('complete', 100);
        return true; // Success
      } else {
        // No processed files - mark as needs retry or complete original upload
        if (item.retryable) {
          updateStatus('needs_retry', 50, 'Processing not supported on this device');
          return false; // Not completed successfully
        } else {
          // Just update the media row to mark as done
          await supabase
            .from('media')
            .update({ 
              processing_status: 'done',
              path: originalPath, // Use original as processed path
              tiny_placeholder: item.processed?.tinyPlaceholder || null,
              width: item.processed?.metadata.width || null,
              height: item.processed?.metadata.height || null
            })
            .eq('id', mediaRowId);
          
          updateStatus('complete', 100);
          return true; // Success
        }
      }

    } catch (error) {
      console.error('Upload error:', error);
      updateStatus('error', 0, error instanceof Error ? error.message : 'Upload failed');
      return false; // Failed
    }
  }, [uploadOriginal, uploadProcessed, finalizeMedia]);

  // Start upload process
  const startUpload = useCallback(async () => {
    const queuedItems = uploadQueue.filter(item => 
      item.status === 'queued' || item.status === 'error'
    );

    if (queuedItems.length === 0) {
      toast({
        title: "No files to upload",
        description: "Add files to the queue first",
        variant: "destructive"
      });
      return;
    }

    // Check authentication
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      toast({
        title: "Authentication required",
        description: "Please log in to upload files",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    setCurrentUploadIndex(0);

    try {
      let completedCount = 0;
      const totalToUpload = queuedItems.length;

      for (let i = 0; i < queuedItems.length; i++) {
        if (abortControllerRef.current?.signal.aborted) break;
        
        setCurrentUploadIndex(i);
        const queueIndex = uploadQueue.findIndex(item => item.id === queuedItems[i].id);
        const success = await processUploadItem(queuedItems[i], userData.user.id, queueIndex);
        
        if (success) {
          completedCount++;
        }
      }

      toast({
        title: "Upload complete!",
        description: `${completedCount} of ${totalToUpload} files uploaded successfully`,
        variant: "success"
      });

      // Auto-clear all completed files after successful upload
      setTimeout(() => {
        setUploadQueue(prev => prev.filter(item => item.status !== 'complete'));
      }, 2000); // Give user time to see the completion status

    } catch (error) {
      console.error('Upload process error:', error);
      toast({
        title: "Upload error",
        description: error instanceof Error ? error.message : 'Upload process failed',
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      setCurrentUploadIndex(0);
      abortControllerRef.current = null;
    }
  }, [uploadQueue, processUploadItem, toast]);

  // Cancel upload
  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsUploading(false);
    setCurrentUploadIndex(0);
  }, []);

  // Remove item from queue
  const removeFile = useCallback((id: string) => {
    setUploadQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  // Clear completed items
  const clearCompleted = useCallback(() => {
    setUploadQueue(prev => prev.filter(item => item.status !== 'complete'));
  }, []);

  // Retry failed/needs_retry items
  const retryProcessing = useCallback(async (id: string) => {
    const item = uploadQueue.find(item => item.id === id);
    if (!item || item.status !== 'needs_retry') return;

    try {
      const processedFiles = await processFiles([item.originalFile]);
      const processed = processedFiles[0];
      
      if (processed && processed.metadata.format !== 'needs_processing') {
        setUploadQueue(prev => prev.map(queueItem => 
          queueItem.id === id 
            ? { ...queueItem, processed, status: 'queued', retryable: false }
            : queueItem
        ));
        
        toast({
          title: "Processing successful",
          description: `${item.originalFile.name} is now ready for upload`,
          variant: "success"
        });
      } else {
        toast({
          title: "Processing still not supported",
          description: "This device cannot process this file type",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Retry failed",
        description: error instanceof Error ? error.message : 'Processing failed again',
        variant: "destructive"
      });
    }
  }, [uploadQueue, processFiles, toast]);

  return {
    uploadQueue,
    isUploading,
    currentUploadIndex,
    isProcessing,
    processingProgress,
    addFiles,
    startUpload,
    cancelUpload,
    removeFile,
    clearCompleted,
    retryProcessing
  };
};