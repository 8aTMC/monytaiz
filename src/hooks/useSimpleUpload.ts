import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useClientMediaProcessor } from './useClientMediaProcessor';

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

      // Determine upload strategy based on file size and type
      const isLargeVideo = mediaType === 'video' && file.size > 50 * 1024 * 1024; // 50MB threshold
      const uploadPath = isLargeVideo ? `raw/${fileId}-${file.name}` : `incoming/${fileId}-${file.name}`;
      
      let processedPaths: { [quality: string]: string } = {};
      let processedBlobs: { [quality: string]: Blob } = {};
      let thumbnailPath: string | undefined;
      let thumbnailBlob: Blob | undefined;
      let width: number | undefined;
      let height: number | undefined;
      let qualityInfo: any = {};

      // Check if we can do client-side video processing (skip for large videos)
      let canClientProcess = true;
      if (mediaType === 'video') {
        if (isLargeVideo) {
          console.log('Large video detected, will use background transcoding service');
          canClientProcess = false;
        } else {
          const validation = await canProcessVideo(file);
          if (!validation.canProcess) {
            console.log('Client-side video processing not available, original format will be used:', validation.reason);
            canClientProcess = false;
          }
        }
      }

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
          console.warn('Client-side image processing failed, will use server-side processing:', error);
          // Continue with original file - server will handle processing
        }

      } else if (mediaType === 'video' && canClientProcess) {
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
            
            // Initialize quality progress tracking
            const qualityProgress: Record<string, QualityProgress> = {
              '480p': { resolution: '480p', encodingProgress: 0, status: 'pending' },
              '720p': { resolution: '720p', encodingProgress: 0, status: 'pending' },
              '1080p': { resolution: '1080p', encodingProgress: 0, status: 'pending' }
            };
            
            // Store all quality variants
            if (result.processedFiles.video_480p) {
              processedBlobs['480p'] = result.processedFiles.video_480p;
              processedPaths['480p'] = `processed/${fileId}-${baseName}_480p.webm`;
              qualityProgress['480p'] = {
                resolution: '480p',
                actualSize: result.processedFiles.video_480p.size,
                compressionRatio: Math.round(((originalSize - result.processedFiles.video_480p.size) / originalSize) * 100),
                encodingProgress: 100,
                status: 'complete'
              };
            }
            if (result.processedFiles.video_720p) {
              processedBlobs['720p'] = result.processedFiles.video_720p;
              processedPaths['720p'] = `processed/${fileId}-${baseName}_720p.webm`;
              qualityProgress['720p'] = {
                resolution: '720p',
                actualSize: result.processedFiles.video_720p.size,
                compressionRatio: Math.round(((originalSize - result.processedFiles.video_720p.size) / originalSize) * 100),
                encodingProgress: 100,
                status: 'complete'
              };
            }
            if (result.processedFiles.video_1080p) {
              processedBlobs['1080p'] = result.processedFiles.video_1080p;
              processedPaths['1080p'] = `processed/${fileId}-${baseName}_1080p.webm`;
              qualityProgress['1080p'] = {
                resolution: '1080p',
                actualSize: result.processedFiles.video_1080p.size,
                compressionRatio: Math.round(((originalSize - result.processedFiles.video_1080p.size) / originalSize) * 100),
                encodingProgress: 100,
                status: 'complete'
              };
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
              compressionRatio,
              qualityProgress
            });
          }
        } catch (error) {
          console.error('Client-side video processing failed:', error);
          console.log('Video will be stored in original format');
          // Continue without client-side processing - original format will be used
        }

      } else if (mediaType === 'video' && !canClientProcess) {
        if (isLargeVideo) {
          setUploadProgress({
            phase: 'processing',
            progress: 30,
            message: 'Large video will be processed in background...',
            originalSize,
            processedSize: originalSize,
            compressionRatio: 0
          });
        } else {
          setUploadProgress({
            phase: 'processing',
            progress: 30,
            message: 'Video will be stored in original format...',
            originalSize,
            processedSize: originalSize,
            compressionRatio: 0
          });
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
          console.warn('Client-side audio processing failed, will use server-side processing:', error);
          // Continue with original file - server will handle processing
          setUploadProgress({
            phase: 'processing',
            progress: 30,
            message: 'Processing audio on server...',
            originalSize,
            processedSize: originalSize,
            compressionRatio: 0
          });
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

      // Calculate total bytes to upload
      const totalUploadBytes = file.size + Object.values(processedBlobs).reduce((sum, blob) => sum + blob.size, 0) + (thumbnailBlob?.size || 0);
      let uploadedBytes = 0;
      const uploadStartTime = Date.now();

      // Helper function to update upload progress
      const updateUploadProgress = (additionalBytes: number) => {
        uploadedBytes += additionalBytes;
        const elapsed = (Date.now() - uploadStartTime) / 1000;
        const speed = elapsed > 0 ? uploadedBytes / elapsed : 0;
        const remaining = totalUploadBytes - uploadedBytes;
        const eta = speed > 0 ? remaining / speed : 0;
        
        setUploadProgress({
          phase: 'uploading',
          progress: 60 + (uploadedBytes / totalUploadBytes) * 20,
          message: `Uploading files... ${Math.round((uploadedBytes / totalUploadBytes) * 100)}%`,
          originalSize,
          processedSize,
          compressionRatio,
          bytesUploaded: uploadedBytes,
          totalBytes: totalUploadBytes,
          uploadSpeed: `${(speed / (1024 * 1024)).toFixed(1)} MB/s`,
          eta: eta > 0 ? `${Math.round(eta)}s remaining` : undefined
        });
      };

      // Upload original file with progress tracking
      console.log('Uploading original file...');
      const originalUpload = await supabase.storage.from('content').upload(uploadPath, file, { upsert: false });
      if (originalUpload.error) throw new Error(`Original upload failed: ${originalUpload.error.message}`);
      updateUploadProgress(file.size);

      // Upload processed files sequentially with progress tracking
      for (const [quality, blob] of Object.entries(processedBlobs)) {
        const path = processedPaths[quality];
        if (path && blob) {
          console.log(`Uploading ${quality} variant...`);
          const upload = await supabase.storage.from('content').upload(path, blob, { upsert: false });
          if (upload.error) throw new Error(`${quality} upload failed: ${upload.error.message}`);
          updateUploadProgress(blob.size);
        }
      }

      // Upload thumbnail if available
      if (thumbnailBlob && thumbnailPath) {
        console.log('Uploading thumbnail...');
        const thumbnailUpload = await supabase.storage.from('content').upload(thumbnailPath, thumbnailBlob, { upsert: false });
        if (thumbnailUpload.error) throw new Error(`Thumbnail upload failed: ${thumbnailUpload.error.message}`);
        updateUploadProgress(thumbnailBlob.size);
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
      const finalMimeType = Object.keys(processedBlobs).length > 0 
        ? (mediaType === 'image' ? 'image/webp' :
           mediaType === 'video' ? 'video/webm' :
           mediaType === 'audio' ? 'audio/webm' : file.type)
        : file.type; // Keep original mime type if no processing occurred

      const defaultProcessedPath = processedPaths['480p'] || processedPaths.image || processedPaths.audio || uploadPath;
      const processingStatus = isLargeVideo ? 'pending' : 'processed';

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
          original_path: uploadPath,
          processed_path: defaultProcessedPath,
          thumbnail_path: thumbnailPath,
          media_type: mediaType,
          processing_status: processingStatus,
          width: width,
          height: height,
          processed_at: processingStatus === 'processed' ? new Date().toISOString() : null,
          tags: []
        })
        .select()
        .single();

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }

      // Enqueue transcoding job for large videos
      if (isLargeVideo) {
        console.log('🎬 Enqueuing background transcoding job for large video...');
        try {
          // Call transcoder service (replace with actual service URL)
          const transcoderUrl = import.meta.env.VITE_TRANSCODER_URL || 'http://localhost:8080';
          const response = await fetch(`${transcoderUrl}/jobs/transcode`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              bucket: 'content',
              path: uploadPath,
              mediaId: mediaRecord.id,
              crf: 30
            })
          });

          if (!response.ok) {
            throw new Error(`Transcoder service error: ${response.status}`);
          }

          console.log('✅ Transcoding job enqueued successfully');
        } catch (transcoderError) {
          console.warn('⚠️ Failed to enqueue transcoding job (non-critical):', transcoderError);
          // Don't fail the upload - the video is still stored
        }
      }

      setUploadProgress({
        phase: 'complete',
        progress: 100,
        message: isLargeVideo 
          ? 'Upload complete! Video processing in background...'
          : `Upload complete! ${compressionRatio > 0 ? `${compressionRatio}% size reduction` : ''}`,
        originalSize,
        processedSize,
        compressionRatio
      });

      // For files with client-side processing, clean up the original
      if (Object.keys(processedBlobs).length > 0 || thumbnailBlob) {
        console.log('🧹 Triggering cleanup of original file after successful client-side processing...');
        
        // Call media-optimizer for cleanup only
        try {
          await supabase.functions.invoke('media-optimizer', {
            body: {
              mediaId: mediaRecord.id,
              originalPath: uploadPath,
              processedPaths,
              thumbnailPath,
              mimeType: finalMimeType,
              mediaType,
              skipProcessing: true, // Just cleanup, no processing
              qualityInfo
            }
          });
          console.log('✅ Original file cleanup completed');
        } catch (cleanupError) {
          console.warn('⚠️ Original file cleanup failed (non-critical):', cleanupError);
          // Don't throw - the upload was successful
        }
        
        toast({
          title: "Upload successful",
          description: `${file.name} uploaded${compressionRatio > 0 ? ` with ${compressionRatio}% size reduction` : ''}.`,
          variant: "default"
        });
      } else if (isLargeVideo) {
        toast({
          title: "Upload successful",
          description: `${file.name} uploaded. Large video processing in background...`,
          variant: "default"
        });
      } else {
        toast({
          title: "Upload successful",
          description: `${file.name} uploaded successfully.`,
          variant: "default"
        });
      }

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
  }, [toast, processFiles, canProcessVideo]);

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