import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface FileUploadItem {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'paused' | 'cancelled';
  error?: string;
  thumbnailUrl?: string;
  uploadedBytes?: number;
  totalBytes?: number;
  isPaused?: boolean;
  selected?: boolean;
  needsConversion?: boolean;
  metadata?: {
    mentions: string[];
    tags: string[];
    folders: string[];
    description: string;
    suggestedPrice: number | null;
  };
}

const FILE_LIMITS = {
  video: 50 * 1024 * 1024, // 50MB - Supabase Free tier limit
  image: 50 * 1024 * 1024, // 50MB
  audio: 10 * 1024 * 1024, // 10MB
};

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024 * 1024; // 10GB total per upload session

const ALLOWED_TYPES = {
  video: ['.mp4', '.mov', '.webm', '.mkv'],
  image: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif'],
  audio: ['.mp3', '.wav', '.aac', '.ogg', '.opus'],
};

// Formats that require conversion but we can handle
const CONVERSION_FORMATS = {
  audio: ['.mp3', '.wav', '.aac', '.ogg', '.opus'], // Convert to WebM/Opus
  image: ['.jpg', '.jpeg', '.png', '.gif', '.heic', '.heif'], // Convert to WebP
  video: ['.mp4', '.mov', '.webm', '.mkv'] // Keep as-is, backend processing
};

const getFileType = (file: File): keyof typeof FILE_LIMITS => {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  
  if (ALLOWED_TYPES.video.includes(extension)) return 'video';
  if (ALLOWED_TYPES.image.includes(extension)) return 'image';
  if (ALLOWED_TYPES.audio.includes(extension)) return 'audio';
  
  throw new Error(`Unsupported file type: ${extension}`);
};

const getUnsupportedFileType = (file: File): 'image' | 'video' | 'audio' | 'unknown' => {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  const mimeType = file.type.toLowerCase();
  
  // Check by extension first
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.avif', '.svg', '.ico'].includes(extension)) return 'image';
  if (['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.m4v', '.3gp'].includes(extension)) return 'video';
  if (['.mp3', '.wav', '.aac', '.flac', '.opus', '.m4a', '.wma'].includes(extension)) return 'audio';
  
  // Check by MIME type
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  
  return 'unknown';
};

const isUnsupportedFormat = (file: File): boolean => {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  console.log(`Checking file: ${file.name} with extension: ${extension}`);
  
  try {
    getFileType(file);
    console.log(`File ${file.name} is SUPPORTED`);
    return false; // If getFileType doesn't throw, it's supported
  } catch (error) {
    console.log(`File ${file.name} is UNSUPPORTED:`, error);
    return true; // If getFileType throws, it's unsupported
  }
};

const needsConversion = (file: File): boolean => {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  const fileType = getFileType(file);
  return CONVERSION_FORMATS[fileType]?.includes(extension) || false;
};

const getStorageFolder = (fileType: keyof typeof FILE_LIMITS): string => {
  const folderMap = {
    video: 'videos',
    image: 'photos', 
    audio: 'audios'
  };
  return folderMap[fileType];
};

export const useFileUpload = () => {
  const [uploadQueue, setUploadQueue] = useState<FileUploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
  const [pausedUploads, setPausedUploads] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  
  // Use ref to get current queue state in async operations
  const queueRef = useRef<FileUploadItem[]>([]);
  
  useEffect(() => {
    queueRef.current = uploadQueue;
  }, [uploadQueue]);

  // Clear any potentially cached files that don't match current restrictions
  useEffect(() => {
    setUploadQueue(currentQueue => {
      const validFiles = currentQueue.filter(item => {
        try {
          const fileType = getFileType(item.file);
          return !isUnsupportedFormat(item.file);
        } catch {
          return false; // Remove files that can't be validated
        }
      });
      
      if (validFiles.length !== currentQueue.length) {
        console.log(`Removed ${currentQueue.length - validFiles.length} cached files that no longer match file restrictions`);
      }
      
      return validFiles;
    });
  }, []); // Run once on mount

  const validateFile = useCallback((file: File) => {
    try {
      // Check for unsupported formats first
      if (isUnsupportedFormat(file)) {
        throw new Error(`Unsupported format. File type not supported by the platform.`);
      }
      
      const fileType = getFileType(file);
      const maxSize = FILE_LIMITS[fileType];
      
      if (file.size > maxSize) {
        const sizeLabel = fileType === 'video' 
          ? `${(maxSize / (1024 * 1024 * 1024)).toFixed(0)}GB`
          : `${(maxSize / (1024 * 1024)).toFixed(0)}MB`;
        throw new Error(`File too large. Max size for ${fileType}: ${sizeLabel}`);
      }
      
      return { fileType, valid: true, needsConversion: needsConversion(file) };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Invalid file' };
    }
  }, []);

  const addFiles = useCallback((files: File[], showDuplicateDialog?: (duplicates: { id: string; name: string; size: number; type: string; existingFile: File; newFile: File }[]) => void, showUnsupportedDialog?: (unsupportedFiles: { id: string; name: string; size: number; type: 'image' | 'video' | 'audio' | 'unknown'; file: File }[]) => void, suppressDialogs?: boolean) => {
    if (uploadQueue.length + files.length > 100) {
      toast({
        title: "Too many files",
        description: "Maximum 100 files allowed per batch",
        variant: "destructive",
      });
      return;
    }

    const validFiles: FileUploadItem[] = [];
    const errors: string[] = [];
    const unsupportedFiles: { id: string; name: string; size: number; type: 'image' | 'video' | 'audio' | 'unknown'; file: File }[] = [];
    const duplicateFiles: { name: string; size: number; type: string; existingFile: File; newFile: File }[] = [];
    
    // Calculate current upload size from existing queue
    const currentUploadSize = uploadQueue.reduce((total, item) => total + item.file.size, 0);
    let cumulativeSize = currentUploadSize;
    let filesAdded = 0;
    let totalFiles = files.length;

    files.forEach((file, index) => {
      console.log(`Processing file: ${file.name}`);
      
      // Check for unsupported formats first
      if (isUnsupportedFormat(file)) {
        console.log(`Adding ${file.name} to unsupported files list`);
        const unsupportedType = getUnsupportedFileType(file);
        unsupportedFiles.push({
          id: `unsupported-${Date.now()}-${index}`,
          name: file.name,
          size: file.size,
          type: unsupportedType,
          file: file
        });
        return;
      }
      
      // Check for duplicates (same name and size)
      const existingItem = uploadQueue.find(existingItem => 
        existingItem.file.name === file.name && existingItem.file.size === file.size
      );
      
      if (existingItem) {
        const fileType = getFileType(file);
        duplicateFiles.push({
          name: file.name,
          size: file.size,
          type: fileType,
          existingFile: existingItem.file,
          newFile: file
        });
        return;
      }
      
      const validation = validateFile(file);
      
      if (validation.valid) {
        // Check if adding this file would exceed the upload limit
        if (cumulativeSize + file.size > MAX_UPLOAD_SIZE) {
          // Stop adding files - we've reached the limit
          return;
        }
        
        validFiles.push({
          file,
          id: `${Date.now()}-${index}`,
          progress: 0,
          status: 'pending',
          uploadedBytes: 0,
          totalBytes: file.size,
          selected: false,
          needsConversion: validation.needsConversion || false,
          metadata: {
            mentions: [],
            tags: [],
            folders: [],
            description: '',
            suggestedPrice: null,
          },
        });
        
        cumulativeSize += file.size;
        filesAdded++;
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    });

    // Batch all state updates and defer dialogs to prevent re-render issues
    if (validFiles.length > 0) {
      // Final safety check: Filter out any unsupported files that somehow made it through
      const safeFiles = validFiles.filter(item => {
        try {
          getFileType(item.file);
          return true;
        } catch (error) {
          console.error(`Blocking unsupported file from queue: ${item.file.name}`, error);
          return false;
        }
      });
      
      if (safeFiles.length !== validFiles.length) {
        console.warn(`Filtered out ${validFiles.length - safeFiles.length} unsupported files from upload queue`);
      }
      
      // Update queue first, then handle dialogs
      setUploadQueue(prev => [...prev, ...safeFiles]);
      
      // Defer dialogs to next tick to prevent interrupting queue updates
      setTimeout(() => {
        const totalSizeGB = (cumulativeSize / (1024 * 1024 * 1024)).toFixed(2);
        toast({
          title: "Files added",
          description: `${safeFiles.length} file(s) ready for upload (${totalSizeGB}GB total)`,
          variant: "success",
        });
      }, 0);
    }

    // Defer all dialogs to prevent interrupting queue updates (unless suppressed)
    if (!suppressDialogs) {
      setTimeout(() => {
        // Show dialog for duplicate files if callback provided
        if (duplicateFiles.length > 0 && showDuplicateDialog) {
          showDuplicateDialog(duplicateFiles.map(df => ({
            id: `${df.name}-${df.size}-${Date.now()}`,
            name: df.name,
            size: df.size,
            type: df.type,
            existingFile: df.existingFile,
            newFile: df.newFile
          })));
        }

        // Show dialog for unsupported files if callback provided
        if (unsupportedFiles.length > 0 && showUnsupportedDialog) {
          console.log(`Showing unsupported files dialog for ${unsupportedFiles.length} files`);
          showUnsupportedDialog(unsupportedFiles);
        }

        // Show error messages for other rejected files
        if (errors.length > 0) {
          toast({
            title: "Some files were rejected",
            description: errors.slice(0, 3).join(', ') + (errors.length > 3 ? '...' : ''),
            variant: "destructive",
          });
        }

        // Show warning if upload limit was reached
        if (filesAdded < totalFiles - errors.length - duplicateFiles.length) {
          const skippedCount = totalFiles - errors.length - filesAdded - duplicateFiles.length;
          toast({
            title: "Upload size limit reached",
            description: `Only ${filesAdded} of ${totalFiles} files have been set for upload due to the maximum upload size (10GB) being reached. ${skippedCount} files were excluded.`,
            variant: "destructive",
          });
        }
      }, 0);
    }

    // Return results for manual handling when dialogs are suppressed
    return {
      duplicateFiles: duplicateFiles.map(df => ({
        id: `${df.name}-${df.size}-${Date.now()}`,
        name: df.name,
        size: df.size,
        type: df.type,
        existingFile: df.existingFile,
        newFile: df.newFile
      })),
      unsupportedFiles,
      errors
    };
  }, [uploadQueue, validateFile, toast]);

  const removeFile = useCallback((id: string) => {
    const wasUploading = uploadQueue.find(item => item.id === id)?.status === 'uploading';
    
    setUploadQueue(prev => prev.filter(item => item.id !== id));
    setPausedUploads(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });

    // If we removed the currently uploading file and there are still pending files, continue upload
    if (wasUploading && isUploading) {
      const remainingFiles = uploadQueue.filter(item => item.id !== id && item.status === 'pending');
      if (remainingFiles.length === 0) {
        // No more files to upload, stop uploading state
        setIsUploading(false);
      }
    }
    
    // If no files left at all, stop uploading state
    const remainingCount = uploadQueue.filter(item => item.id !== id).length;
    if (remainingCount === 0) {
      setIsUploading(false);
    }
  }, [uploadQueue, isUploading]);

  const pauseUpload = useCallback((id: string) => {
    setPausedUploads(prev => new Set(prev).add(id));
    setUploadQueue(prev => prev.map(item => 
      item.id === id ? { ...item, status: 'paused' as const, isPaused: true } : item
    ));
  }, []);

  const resumeUpload = useCallback((id: string) => {
    setPausedUploads(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    setUploadQueue(prev => prev.map(item => 
      item.id === id ? { ...item, status: 'pending' as const, isPaused: false } : item
    ));
  }, []);

  const cancelUpload = useCallback((id: string) => {
    const wasCurrent = uploadQueue.find(item => item.id === id)?.status === 'uploading';
    
    setUploadQueue(prev => prev.map(item => 
      item.id === id ? { ...item, status: 'cancelled' as const } : item
    ));
    setPausedUploads(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    
    // Remove cancelled file after short delay
    setTimeout(() => {
      setUploadQueue(prev => {
        const newQueue = prev.filter(item => item.id !== id);
        
        // If this was the current uploading file and there are still pending files
        if (wasCurrent && isUploading) {
          const remainingPending = newQueue.filter(item => item.status === 'pending');
          if (remainingPending.length === 0) {
            setIsUploading(false);
          }
        }
        
        // If no files left at all, stop uploading state
        if (newQueue.length === 0) {
          setIsUploading(false);
        }
        
        return newQueue;
      });
    }, 1000);
  }, [uploadQueue, isUploading]);

  const uploadFile = useCallback(async (item: FileUploadItem) => {
    const { file } = item;
    const fileType = getFileType(file);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const storageFolder = getStorageFolder(fileType);
    
    let progressInterval: NodeJS.Timeout | null = null;
    let simulatedUploadedBytes = 0;
    
    // Different timeouts for different file types - much longer for large videos
    const timeoutDuration = fileType === 'video' ? 1200000 : 180000; // 20min for video, 3min for others
    const maxRetries = fileType === 'video' ? 8 : 3; // More retries for large video files

    try {
      // Check if paused
      if (pausedUploads.has(item.id)) {
        return;
      }

      // Update status to uploading
      setUploadQueue(prev => prev.map(f => 
        f.id === item.id ? { ...f, status: 'uploading' as const } : f
      ));

      console.log('Starting upload for file:', file.name);
      
      // Get current user first to ensure we have the ID
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        console.error('User authentication error:', userError);
        throw new Error('User not authenticated - please log in again');
      }
      
      console.log('User authenticated:', userData.user.id);

      // Organize files by user ID in storage (required for RLS policies)
      const filePath = `${userData.user.id}/${storageFolder}/${fileName}`;

      // Verify user has required role for content upload
      const { data: userRoles, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userData.user.id);

      if (roleError) {
        console.error('Error checking user roles:', roleError);
        throw new Error('Unable to verify user permissions');
      }

      if (!userRoles || userRoles.length === 0) {
        throw new Error('User does not have required permissions to upload content');
      }

      // Check if user profile exists and is active
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, deletion_status')
        .eq('id', userData.user.id)
        .single();

      if (profileError || !profile) {
        throw new Error('User profile not found - please complete your profile setup');
      }

      if (profile.deletion_status !== 'active') {
        throw new Error('User account is not active');
      }

      // Start progress tracking after validation
      const chunkSize = Math.max(1024 * 1024, file.size / 100);
      progressInterval = setInterval(() => {
        if (pausedUploads.has(item.id)) {
          if (progressInterval) clearInterval(progressInterval);
          progressInterval = null;
          return;
        }

        // More realistic progress simulation for large files
        simulatedUploadedBytes = Math.min(simulatedUploadedBytes + chunkSize, file.size * 0.90);
        const progress = Math.round((simulatedUploadedBytes / file.size) * 100);
        
        setUploadQueue(prev => prev.map(f => 
          f.id === item.id ? { 
            ...f, 
            progress: Math.min(progress, 90), // Allow progress up to 90% during simulation
            uploadedBytes: simulatedUploadedBytes 
          } : f
        ));

        if (simulatedUploadedBytes >= file.size * 0.90) {
          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
          }
        }
      }, fileType === 'video' ? 500 : 200); // Slower progress updates for video

      console.log('Uploading to storage path:', filePath);
      
      // Upload with retry logic
      let data, error;
      let attempts = 0;
      
      while (attempts < maxRetries) {
        attempts++;
        
        try {
          // For large video files, use chunked upload approach
          let uploadPromise;
          
          if (fileType === 'video' && file.size > 500 * 1024 * 1024) { // 500MB+
            // For very large videos, use different options to improve reliability
            uploadPromise = supabase.storage
              .from('content')
              .upload(filePath, file, {
                upsert: false,
                cacheControl: '3600',
                duplex: 'half' // Allow for better streaming
              });
          } else {
            uploadPromise = supabase.storage
              .from('content')
              .upload(filePath, file, {
                upsert: false,
                cacheControl: '3600'
              });
          }

          // Race between upload and timeout
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Upload timeout')), timeoutDuration);
          });

          const result = await Promise.race([uploadPromise, timeoutPromise]) as any;
          data = result.data;
          error = result.error;
          
          if (!error) break; // Success, exit retry loop
          
        } catch (timeoutError) {
          console.log(`Upload attempt ${attempts} timed out, retrying...`);
          
          // Show timeout message to user
          setUploadQueue(prev => prev.map(f => 
            f.id === item.id ? { 
              ...f, 
              status: 'uploading' as const,
              progress: 10, // Reset progress for retry
              error: `Upload attempt ${attempts} timed out, retrying...`
            } : f
          ));
          
          if (attempts === maxRetries) {
            throw new Error(`Upload timeout after ${attempts} attempts - please try a smaller file or check your connection`);
          }
          continue;
        }

        if (error && attempts < maxRetries) {
          console.log(`Upload attempt ${attempts} failed:`, error.message, 'Retrying...');
          // Brief delay before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }

      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      
      console.log('Storage upload completed:', { 
        success: !error, 
        data: data?.path, 
        error: error?.message 
      });
      
      if (error) {
        console.error('Storage upload failed:', error);
        // Handle specific upload errors
        if (error.message.includes('already exists')) {
          // Retry with different filename
          const retryFileName = `${Date.now()}_${Math.random()}.${fileExt}`;
          const retryFilePath = `${userData.user.id}/${storageFolder}/${retryFileName}`;
          
          console.log('Retrying upload with new filename:', retryFilePath);
          
          const { data: retryData, error: retryError } = await supabase.storage
            .from('content')
            .upload(retryFilePath, file);
          
          if (retryError) {
            console.error('Retry upload failed:', retryError);
            throw new Error(`Upload failed after retry: ${retryError.message}`);
          }
          data = retryData;
          console.log('Retry upload successful:', retryData?.path);
        } else {
          throw new Error(`Storage upload failed: ${error.message}`);
        }
      }

      // Save to database with proper user ID and additional debugging
      console.log('Inserting content file:', {
        creator_id: userData.user.id,
        auth_uid: userData.user.id,
        file_path: data!.path,
        content_type: fileType
      });

      const insertPayload = {
        title: item.metadata?.description || file.name.replace(/\.[^/.]+$/, ""), // Use description or remove extension
        description: item.metadata?.description || null,
        tags: item.metadata?.tags || [],
        mentions: item.metadata?.mentions || [],
        suggested_price_cents: item.metadata?.suggestedPrice ? Math.round(item.metadata.suggestedPrice * 100) : 0,
        original_filename: file.name,
        original_path: data!.path,
        mime_type: file.type,
        media_type: fileType,
        original_size_bytes: file.size,
        creator_id: userData.user.id,
      };
      
      console.log('Insert payload:', insertPayload);
      
      const { data: insertData, error: dbError } = await supabase
        .from('simple_media')
        .insert(insertPayload)
        .select();

      if (dbError) {
        console.error('Database insert error:', {
          error: dbError,
          code: dbError.code,
          message: dbError.message,
          details: dbError.details,
          hint: dbError.hint,
          payload: insertPayload
        });
        throw new Error(`Failed to save file metadata: ${dbError.message} (Code: ${dbError.code})`);
      }
      
      console.log('Database insert successful:', insertData);

      // Add to folders if specified
      if (item.metadata?.folders && item.metadata.folders.length > 0 && insertData?.[0]?.id) {
        try {
          const folderAssignments = item.metadata.folders.map(folderId => ({
            media_id: insertData[0].id,
            collection_id: folderId,
            added_by: userData.user.id,
          }));

          const { error: folderError } = await supabase
            .from('collection_items')
            .insert(folderAssignments);

          if (folderError) {
            console.warn('Folder assignment failed:', folderError);
          } else {
            console.log('Folder assignments successful');
          }
        } catch (folderAssignError) {
          console.warn('Folder assignment error:', folderAssignError);
        }
      }

      // Post-process media for fast loading with timeout and better error handling
      try {
        console.log('Starting media post-processing...');
        
        // Set progress to 95% during post-processing
        setUploadQueue(prev => prev.map(f => 
          f.id === item.id ? { 
            ...f, 
            progress: 95,
            error: undefined // Clear any previous errors
          } : f
        ));

        const postProcessPromise = supabase.functions.invoke('media-postprocess', {
          body: { 
            bucket: 'content', 
            path: data!.path, 
            isPublic: true 
          },
          headers: { 'Content-Type': 'application/json' },
        });

        // Different timeouts based on file type
        const timeoutMs = fileType === 'video' ? 60000 : fileType === 'audio' ? 30000 : 15000;
        
        const { data: postProcessData, error: postProcessError } = await Promise.race([
          postProcessPromise,
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Post-processing timeout (${timeoutMs/1000}s)`)), timeoutMs);
          })
        ]) as any;

        if (postProcessError) {
          console.warn('Media post-processing failed:', postProcessError);
        } else if (postProcessData?.ok) {
          console.log('Media post-processing successful:', postProcessData);
          
          // Insert into media table for fast loading
          const mediaInsertPayload = {
            bucket: 'content',
            path: data!.path,
            storage_path: data!.path, // Keep for compatibility
            mime: file.type,
            type: fileType,
            size_bytes: file.size,
            width: postProcessData.width,
            height: postProcessData.height,
            tiny_placeholder: postProcessData.tiny_placeholder,
            title: file.name.replace(/\.[^/.]+$/, ""),
            notes: null,
            tags: [],
            suggested_price_cents: 0,
            creator_id: userData.user.id,
            created_by: userData.user.id,
            origin: 'upload'
          };

          const { error: mediaDbError } = await supabase
            .from('media')
            .upsert(mediaInsertPayload, { onConflict: 'bucket,path' });

          if (mediaDbError) {
            console.warn('Media table insert failed:', mediaDbError);
          } else {
            console.log('Media table insert successful');
          }
        }
      } catch (postProcessError) {
        console.warn('Media post-processing error:', postProcessError);
      }

      // Mark as completed
      setUploadQueue(prev => prev.map(f => 
        f.id === item.id ? { 
          ...f, 
          status: 'completed' as const, 
          progress: 100,
          uploadedBytes: file.size 
        } : f
      ));

      // Remove from queue after a short delay
      setTimeout(() => {
        setUploadQueue(prev => prev.filter(f => f.id !== item.id));
      }, 2000);

      return { success: true, data };

    } catch (error) {
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      
      let errorMessage = 'Upload failed';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Upload timeout - file too large or connection slow';
        } else {
          errorMessage = error.message;
        }
      }
      
      setUploadQueue(prev => prev.map(f => 
        f.id === item.id ? { 
          ...f, 
          status: 'error' as const, 
          error: errorMessage
        } : f
      ));

      toast({
        title: "Upload failed",
        description: `${file.name}: ${errorMessage}`,
        variant: "destructive",
      });

      return { success: false, error: errorMessage };
    }
  }, [pausedUploads, toast]);

  const startUpload = useCallback(async (skipDuplicateCheck = false) => {
    if (queueRef.current.length === 0 || isUploading) return;

    // Return duplicate check results if not skipping
    if (!skipDuplicateCheck) {
      return { requiresDuplicateCheck: true };
    }

    setIsUploading(true);
    setCurrentUploadIndex(0);

    let successCount = 0;
    let errorCount = 0;

    // Keep processing files until none are left
    while (true) {
      // Always get fresh queue state to handle removed files
      const currentQueue = queueRef.current.filter(item => item.status === 'pending');
      
      if (currentQueue.length === 0) {
        break; // No more pending files
      }

      const nextFile = currentQueue[0];
      if (!nextFile) {
        break;
      }

      // Check if this file still exists in the queue (wasn't removed)
      const fileStillExists = queueRef.current.some(item => item.id === nextFile.id);
      if (!fileStillExists) {
        continue; // File was removed, check for next one
      }

      if (!pausedUploads.has(nextFile.id)) {
        const result = await uploadFile(nextFile);
        
        if (result?.success) {
          successCount++;
        } else {
          errorCount++;
        }
      }
      
      // Small delay to allow UI updates and queue changes
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsUploading(false);
    
    // Show completion toast with results
    if (successCount > 0 || errorCount > 0) {
      toast({
        title: "Upload complete",
        description: `${successCount} file${successCount !== 1 ? 's' : ''} uploaded successfully${errorCount > 0 ? `. ${errorCount} failed.` : ''}`,
        variant: successCount > errorCount ? "success" : "destructive",
      });
    }
  }, [isUploading, uploadFile, pausedUploads, toast]);

  const clearQueue = useCallback(() => {
    setUploadQueue([]);
    setCurrentUploadIndex(0);
    setIsUploading(false); // Stop uploading state when queue is cleared
    setPausedUploads(new Set()); // Clear paused uploads set
  }, []);

  const cancelAllUploads = useCallback(() => {
    if (!isUploading) return;
    
    // Cancel all pending/uploading files
    uploadQueue.forEach(item => {
      if (item.status === 'uploading' || item.status === 'pending') {
        cancelUpload(item.id);
      }
    });
    
    // Reset state
    setIsUploading(false);
    setCurrentUploadIndex(0);
    
    toast({
      title: "Upload cancelled",
      description: "All uploads have been cancelled",
    });
  }, [isUploading, uploadQueue, cancelUpload, toast]);

  const updateFileMetadata = useCallback((id: string, metadata: Partial<FileUploadItem['metadata']>) => {
    setUploadQueue(prev => prev.map(item => 
      item.id === id ? { 
        ...item, 
        metadata: { ...item.metadata, ...metadata } 
      } : item
    ));
  }, []);

  // Selection management functions
  const toggleFileSelection = useCallback((id: string) => {
    setUploadQueue(prev => prev.map(item => 
      item.id === id ? { ...item, selected: !item.selected } : item
    ));
  }, []);

  const selectAllFiles = useCallback(() => {
    const allSelected = uploadQueue.every(item => item.selected);
    setUploadQueue(prev => prev.map(item => ({ ...item, selected: !allSelected })));
  }, [uploadQueue]);

  const clearSelection = useCallback(() => {
    setUploadQueue(prev => prev.map(item => ({ ...item, selected: false })));
  }, []);

  const updateSelectedFilesMetadata = useCallback((metadata: Partial<FileUploadItem['metadata']>) => {
    setUploadQueue(prev => prev.map(item => {
      if (!item.selected) return item;
      
      const currentMetadata = item.metadata || {
        mentions: [],
        tags: [],
        folders: [],
        description: '',
        suggestedPrice: null,
      };
      
      // Merge arrays for mentions, tags, and folders (no duplicates)
      const mergedMetadata = { ...currentMetadata };
      
      if (metadata.mentions) {
        const existingMentions = currentMetadata.mentions || [];
        mergedMetadata.mentions = [...new Set([...existingMentions, ...metadata.mentions])];
      }
      
      if (metadata.tags) {
        const existingTags = currentMetadata.tags || [];
        mergedMetadata.tags = [...new Set([...existingTags, ...metadata.tags])];
      }
      
      if (metadata.folders) {
        const existingFolders = currentMetadata.folders || [];
        mergedMetadata.folders = [...new Set([...existingFolders, ...metadata.folders])];
      }
      
      return {
        ...item,
        metadata: mergedMetadata
      };
    }));
  }, []);

  // Computed selection properties
  const selectedFiles = uploadQueue.filter(item => item.selected);
  const hasSelection = selectedFiles.length > 0;
  const allSelected = uploadQueue.length > 0 && uploadQueue.every(item => item.selected);

  return {
    uploadQueue,
    isUploading,
    currentUploadIndex,
    addFiles,
    removeFile,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    startUpload,
    clearQueue,
    cancelAllUploads,
    updateFileMetadata,
    toggleFileSelection,
    selectAllFiles,
    clearSelection,
    updateSelectedFilesMetadata,
    selectedFiles,
    hasSelection,
    allSelected,
    processedCount: uploadQueue.filter(f => f.status === 'completed').length,
    totalCount: uploadQueue.length,
    getUnsupportedFileType,
  };
};