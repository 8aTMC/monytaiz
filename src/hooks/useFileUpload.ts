import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { uploadWithProgress } from '@/lib/uploadWithProgress';
import { validateVideoFile } from '@/lib/videoValidation';

export interface FileUploadItem {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'paused' | 'cancelled' | 'processing';
  error?: string;
  thumbnailUrl?: string;
  uploadedBytes?: number;
  totalBytes?: number;
  uploadSpeed?: number; // bytes per second
  isPaused?: boolean;
  selected?: boolean;
  needsConversion?: boolean;
  optimizationInfo?: {
    originalSize: number;
    optimizedSize: number;
    percentSaved: number;
  };
  metadata?: {
    mentions: string[];
    tags: string[];
    folders: string[];
    description: string;
    suggestedPrice: number | null;
  };
}

const FILE_LIMITS = {
  video: 500 * 1024 * 1024, // 500MB - Support for 4K videos
  image: 50 * 1024 * 1024, // 50MB
  audio: 10 * 1024 * 1024, // 10MB
};

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024 * 1024; // 10GB total per upload session

const ALLOWED_TYPES = {
  video: ['.mp4', '.mov', '.webm', '.mkv'],
  image: ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'],
  audio: ['.mp3', '.wav', '.aac', '.ogg', '.opus'],
};

// Formats that require conversion but we can handle
const CONVERSION_FORMATS = {
  audio: ['.mp3', '.wav', '.aac', '.ogg', '.opus'], // Convert to WebM/Opus
  image: ['.jpg', '.jpeg', '.png', '.heic', '.heif'], // Convert to WebP (excluding .gif to preserve animation)
  video: ['.mp4', '.mov', '.webm', '.mkv'] // Keep as-is, backend processing
};

const getFileType = (file: File): keyof typeof FILE_LIMITS => {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  
  if (ALLOWED_TYPES.video.includes(extension)) return 'video';
  if (ALLOWED_TYPES.image.includes(extension)) return 'image';
  if (ALLOWED_TYPES.audio.includes(extension)) return 'audio';
  
  throw new Error(`Unsupported file type: ${extension}`);
};

const getUnsupportedFileType = (file: File): 'image' | 'video' | 'audio' | 'gif' | 'unknown' => {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  const mimeType = file.type.toLowerCase();
  
  // Check for GIF specifically first
  if (extension === '.gif') return 'gif';
  
  // Check by extension first
  if (['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif', '.avif', '.svg', '.ico'].includes(extension)) return 'image';
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
  const [abortControllers, setAbortControllers] = useState<Map<string, AbortController>>(new Map());
  const { toast } = useToast();
  
  // Use refs to get current state in async operations without stale closures
  const queueRef = useRef<FileUploadItem[]>([]);
  const isUploadingRef = useRef(false);
  const pausedUploadsRef = useRef(new Set<string>());
  
  useEffect(() => {
    queueRef.current = uploadQueue;
  }, [uploadQueue]);

  useEffect(() => {
    isUploadingRef.current = isUploading;
  }, [isUploading]);

  useEffect(() => {
    pausedUploadsRef.current = pausedUploads;
  }, [pausedUploads]);

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

  const addFiles = useCallback(async (
    files: File[], 
    showDuplicateDialog?: (duplicates: { id: string; name: string; size: number; type: string; existingFile: File; newFile: File }[]) => void, 
    showUnsupportedDialog?: (unsupportedFiles: { id: string; name: string; size: number; type: 'image' | 'video' | 'audio' | 'gif' | 'unknown'; file: File }[]) => void,
    showCorruptedDialog?: (corruptedFiles: { id: string; name: string; size: number; file: File; error: string; errorType?: 'corruption' | 'format' | 'timeout' | 'metadata' }[]) => void,
    suppressDialogs?: boolean
  ) => {
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
    const unsupportedFiles: { id: string; name: string; size: number; type: 'image' | 'video' | 'audio' | 'gif' | 'unknown'; file: File }[] = [];
    const duplicateFiles: { name: string; size: number; type: string; existingFile: File; newFile: File }[] = [];
    const corruptedFiles: { id: string; name: string; size: number; file: File; error: string; errorType?: 'corruption' | 'format' | 'timeout' | 'metadata' }[] = [];
    
    // Calculate current upload size from existing queue
    const currentUploadSize = uploadQueue.reduce((total, item) => total + item.file.size, 0);
    let cumulativeSize = currentUploadSize;
    let filesAdded = 0;
    let totalFiles = files.length;

    // Separate supported video files for corruption checking
    const supportedFiles: File[] = [];
    const videoFiles: File[] = [];

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

      // File is supported, add to processing queue
      supportedFiles.push(file);
      
      // If it's a video file, add to video files for corruption checking
      try {
        const fileType = getFileType(file);
        if (fileType === 'video') {
          videoFiles.push(file);
        }
      } catch (error) {
        // File type error already handled above
      }
    });

    // Check video files for corruption
    if (videoFiles.length > 0) {
      console.log(`Checking ${videoFiles.length} video files for corruption...`);
      
      for (const videoFile of videoFiles) {
        try {
          const validationResult = await validateVideoFile(videoFile, { timeoutMs: 5000 });
          
          if (validationResult.isCorrupted) {
            console.log(`Video file ${videoFile.name} is corrupted:`, validationResult.error);
            
            const fileIndex = supportedFiles.indexOf(videoFile);
            corruptedFiles.push({
              id: `corrupted-${Date.now()}-${fileIndex}`,
              name: videoFile.name,
              size: videoFile.size,
              file: videoFile,
              error: validationResult.error || 'File appears to be corrupted',
              errorType: validationResult.errorType
            });
            
            // Remove from supported files to prevent further processing
            const supportedIndex = supportedFiles.indexOf(videoFile);
            if (supportedIndex > -1) {
              supportedFiles.splice(supportedIndex, 1);
            }
          }
        } catch (error) {
          console.warn(`Error validating video file ${videoFile.name}:`, error);
          // If validation fails unexpectedly, continue with the file
        }
      }
    }

    // Process remaining supported files
    supportedFiles.forEach((file, index) => {
      
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

        // Show dialog for corrupted files if callback provided
        if (corruptedFiles.length > 0 && showCorruptedDialog) {
          console.log(`Showing corrupted files dialog for ${corruptedFiles.length} files`);
          showCorruptedDialog(corruptedFiles);
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
      corruptedFiles,
      errors
    };
  }, [uploadQueue, validateFile, toast]);

  // Validation-only function that doesn't modify the queue
  const validateFilesOnly = useCallback((files: File[]) => {
    const validFiles: FileUploadItem[] = [];
    const errors: string[] = [];
    const unsupportedFiles: { id: string; name: string; size: number; type: 'image' | 'video' | 'audio' | 'gif' | 'unknown'; file: File }[] = [];
    const duplicateFiles: { name: string; size: number; type: string; existingFile: File; newFile: File }[] = [];
    
    files.forEach((file, index) => {
      // Check for unsupported formats first
      if (isUnsupportedFormat(file)) {
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
        validFiles.push({
          file,
          id: `validation-${Date.now()}-${index}`,
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
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    });

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
  }, [uploadQueue, validateFile]);

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
    // Abort the upload if it's currently uploading
    const controller = abortControllers.get(id);
    if (controller) {
      controller.abort();
    }
    
    setPausedUploads(prev => new Set(prev).add(id));
    setUploadQueue(prev => prev.map(item => 
      item.id === id ? { ...item, status: 'paused' as const, isPaused: true } : item
    ));
  }, [abortControllers]);

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

  // Cancel upload function  
  const cancelUpload = useCallback((id: string) => {
    const wasCurrent = uploadQueue.find(item => item.id === id)?.status === 'uploading';
    
    // Abort the upload if it's currently uploading
    const controller = abortControllers.get(id);
    if (controller) {
      controller.abort();
    }
    
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
  }, [uploadQueue, isUploading, abortControllers]);

  const uploadFile = useCallback(async (item: FileUploadItem) => {
    const { file } = item;
    const fileType = getFileType(file);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const storageFolder = getStorageFolder(fileType);
    
    let progressInterval: NodeJS.Timeout | null = null;
    const abortController = new AbortController();
    
    // Store abort controller for this upload
    setAbortControllers(prev => new Map(prev).set(item.id, abortController));
    
    // Different timeouts for different file types - much longer for large videos
    const timeoutDuration = fileType === 'video' ? 1200000 : 180000; // 20min for video, 3min for others
    const maxRetries = fileType === 'video' ? 8 : 3; // More retries for large video files

    try {
      // Check if paused
      if (pausedUploadsRef.current.has(item.id)) {
        console.log('Upload paused for file:', file.name);
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
      progressInterval = setInterval(() => {
        if (pausedUploadsRef.current.has(item.id)) {
          if (progressInterval) clearInterval(progressInterval);
          progressInterval = null;
          return;
        }

        // Progress is now handled by XMLHttpRequest onprogress
        // This interval just ensures the UI updates if needed
      }, 1000);

      // Check if paused before starting upload
      if (pausedUploadsRef.current.has(item.id)) {
        console.log('Upload paused before starting for file:', file.name);
        return;
      }

      // Update status to uploading
      setUploadQueue(prev => prev.map(f => 
        f.id === item.id ? { ...f, status: 'uploading' as const } : f
      ));

      console.log('Uploading to storage path:', filePath);
      
      // Upload with retry logic using XMLHttpRequest for better control
      let data, error;
      let attempts = 0;
      
      while (attempts < maxRetries) {
        attempts++;
        
        try {
          // Get signed URL for upload
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error('No auth session');

          // Use uploadWithProgress for real progress tracking
          const uploadResult = await uploadWithProgress(
            'content',
            filePath,
            file,
            (progressEvent) => {
              setUploadQueue(prev => prev.map(f => 
                f.id === item.id ? { 
                  ...f, 
                  progress: Math.min(Math.round(progressEvent.progress), 95),
                  uploadedBytes: progressEvent.bytesUploaded,
                  totalBytes: progressEvent.totalBytes,
                  uploadSpeed: progressEvent.uploadSpeed
                } : f
              ));
            },
            abortController
          );
          
          data = uploadResult.data;
          error = uploadResult.error;
          
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

      // Save to database with proper user ID and metadata
      console.log('Inserting content file:', {
        creator_id: userData.user.id,
        auth_uid: userData.user.id,
        file_path: data!.path,
        content_type: fileType
      });

      const insertPayload = {
        title: item.metadata?.description || file.name.replace(/\.[^/.]+$/, ""), // Clean title
        description: item.metadata?.description || null,
        tags: item.metadata?.tags || [],
        mentions: item.metadata?.mentions || [],
        suggested_price_cents: item.metadata?.suggestedPrice ? Math.round(item.metadata.suggestedPrice * 100) : 0,
        original_filename: file.name,
        original_path: data!.path,
        processed_path: data!.path, // Same as original for now
        mime_type: file.type,
        media_type: fileType,
        original_size_bytes: file.size,
        creator_id: userData.user.id,
        processing_status: 'processed', // Mark as processed since we're uploading directly
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

      // Post-process media for metadata extraction only (no video processing)
      try {
        console.log('Starting media metadata extraction...');
        
        // Set progress to 95% during post-processing
        setUploadQueue(prev => prev.map(f => 
          f.id === item.id ? { 
            ...f, 
            progress: 95,
            error: undefined // Clear any previous errors
          } : f
        ));

        // Only call post-processing for images and non-video files
        if (fileType !== 'video') {
          const postProcessPromise = supabase.functions.invoke('media-postprocess', {
            body: { 
              bucket: 'content', 
              path: data!.path, 
              isPublic: true 
            },
            headers: { 'Content-Type': 'application/json' },
          });

          // Shorter timeout since we're not processing videos
          const timeoutMs = 15000;
          
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
      
      // Clean up abort controller
      setAbortControllers(prev => {
        const newMap = new Map(prev);
        newMap.delete(item.id);
        return newMap;
      });
      
      let errorMessage = 'Upload failed';
      if (error instanceof Error) {
        if (error.message === 'Upload cancelled') {
          errorMessage = 'Upload was cancelled';
        } else if (error.name === 'AbortError') {
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
    } finally {
      // Clean up abort controller on completion
      setAbortControllers(prev => {
        const newMap = new Map(prev);
        newMap.delete(item.id);
        return newMap;
      });
    }
  }, [pausedUploads, toast]);

  const startUpload = useCallback(async (skipDuplicateCheck = false) => {
    if (queueRef.current.length === 0 || isUploadingRef.current) {
      console.log('Upload blocked:', { 
        queueLength: queueRef.current.length, 
        isUploading: isUploadingRef.current 
      });
      return;
    }

    // Return duplicate check results if not skipping
    if (!skipDuplicateCheck) {
      return { requiresDuplicateCheck: true };
    }

    // Get pending files for upload
    const pendingFiles = queueRef.current.filter(item => item.status === 'pending');
    console.log('🚀 Starting upload for', pendingFiles.length, 'pending files');
    
    if (pendingFiles.length === 0) {
      toast({
        title: "No files to upload",
        description: "Please add files to the queue before starting upload.",
        variant: "default",
      });
      return;
    }

    console.log('📤 Setting isUploading to true');
    setIsUploading(true);
    setCurrentUploadIndex(0);

    let successCount = 0;
    let errorCount = 0;

    try {
      // Parallel upload with concurrency limit
      const CONCURRENCY_LIMIT = 3;

      // Process files in batches to avoid overwhelming the connection
      for (let i = 0; i < pendingFiles.length; i += CONCURRENCY_LIMIT) {
        const batch = pendingFiles.slice(i, i + CONCURRENCY_LIMIT);
        
        // Update current upload index
        setCurrentUploadIndex(i);
        
        // Wait for current batch to complete before starting next batch
        const batchPromises = batch.map(async (item, batchIndex) => {
          try {
            // Set initial progress to 1% to show upload started
            setUploadQueue(prev => prev.map(f => 
              f.id === item.id ? { ...f, progress: 1 } : f
            ));
            
            const result = await uploadFile(item);
            if (result?.success) {
              successCount++;
            } else {
              errorCount++;
            }
            return result;
          } catch (error) {
            errorCount++;
            console.error('Upload error:', error);
            return { success: false, error };
          }
        });

        // Wait for all files in this batch to complete
        await Promise.allSettled(batchPromises);
        
        // Small delay between batches to prevent overwhelming the server
        if (i + CONCURRENCY_LIMIT < pendingFiles.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      // Show completion toast with results
      if (successCount > 0 || errorCount > 0) {
        toast({
          title: "Upload complete",
          description: `${successCount} file${successCount !== 1 ? 's' : ''} uploaded successfully${errorCount > 0 ? `. ${errorCount} failed.` : ''}`,
          variant: successCount > errorCount ? "success" : "destructive",
        });
      }
      
    } catch (error) {
      console.error('Upload process error:', error);
      toast({
        title: "Upload failed",
        description: "An error occurred during the upload process. Please try again.",
        variant: "destructive",
      });
    } finally {
      console.log('📤 Setting isUploading to false - upload complete');
      setIsUploading(false);
      setCurrentUploadIndex(0);
    }
  }, [uploadFile, toast]);

  const clearQueue = useCallback(() => {
    setUploadQueue([]);
    setCurrentUploadIndex(0);
    setIsUploading(false); // Stop uploading state when queue is cleared
    setPausedUploads(new Set()); // Clear paused uploads set
  }, []);

  // Pause all uploads
  const pauseAllUploads = useCallback(() => {
    uploadQueue.forEach(item => {
      if (item.status === 'uploading' || item.status === 'pending') {
        pauseUpload(item.id);
      }
    });
    
    toast({
      title: "Uploads paused",
      description: "All uploads have been paused",
    });
  }, [uploadQueue, pauseUpload, toast]);

  // Resume all uploads
  const resumeAllUploads = useCallback(() => {
    uploadQueue.forEach(item => {
      if (item.status === 'paused') {
        resumeUpload(item.id);
      }
    });
    
    toast({
      title: "Uploads resumed", 
      description: "All uploads have been resumed",
    });
  }, [uploadQueue, resumeUpload, toast]);

  const cancelAllUploads = useCallback(() => {
    // Abort all active uploads using stored abort controllers
    abortControllers.forEach((controller, itemId) => {
      controller.abort();
    });
    
    // Cancel all pending/uploading files
    uploadQueue.forEach(item => {
      if (item.status === 'uploading' || item.status === 'pending' || item.status === 'paused') {
        cancelUpload(item.id);
      }
    });
    
    // Clear abort controllers
    setAbortControllers(new Map());
    
    // Reset state
    setIsUploading(false);
    setCurrentUploadIndex(0);
    
    toast({
      title: "Upload cancelled",
      description: "All uploads have been cancelled",
    });
  }, [uploadQueue, cancelUpload, toast, abortControllers]);

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
    validateFilesOnly,
    removeFile,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    uploadFile,
    startUpload,
    clearQueue,
    pauseAllUploads,
    resumeAllUploads,
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