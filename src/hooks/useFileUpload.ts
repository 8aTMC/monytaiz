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
}

const FILE_LIMITS = {
  video: 6 * 1024 * 1024 * 1024, // 6GB
  image: 20 * 1024 * 1024, // 20MB
  audio: 10 * 1024 * 1024, // 10MB
  document: 100 * 1024 * 1024, // 100MB
};

const ALLOWED_TYPES = {
  video: ['.mp4', '.mov', '.webm', '.avi', '.mkv'],
  image: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  audio: ['.mp3', '.wav', '.aac', '.ogg'],
  document: ['.pdf', '.doc', '.docx', '.txt', '.rtf'],
};

const getFileType = (file: File): keyof typeof FILE_LIMITS => {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  
  if (ALLOWED_TYPES.video.includes(extension)) return 'video';
  if (ALLOWED_TYPES.image.includes(extension)) return 'image';
  if (ALLOWED_TYPES.audio.includes(extension)) return 'audio';
  if (ALLOWED_TYPES.document.includes(extension)) return 'document';
  
  throw new Error(`Unsupported file type: ${extension}`);
};

const getStorageFolder = (fileType: keyof typeof FILE_LIMITS): string => {
  const folderMap = {
    video: 'videos',
    image: 'photos', 
    audio: 'audios',
    document: 'documents'
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

  const validateFile = useCallback((file: File) => {
    try {
      const fileType = getFileType(file);
      const maxSize = FILE_LIMITS[fileType];
      
      if (file.size > maxSize) {
        throw new Error(`File too large. Max size for ${fileType}: ${(maxSize / (1024 * 1024)).toFixed(0)}MB`);
      }
      
      return { fileType, valid: true };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Invalid file' };
    }
  }, []);

  const addFiles = useCallback((files: File[]) => {
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

    files.forEach((file, index) => {
      const validation = validateFile(file);
      
      if (validation.valid) {
        validFiles.push({
          file,
          id: `${Date.now()}-${index}`,
          progress: 0,
          status: 'pending',
          uploadedBytes: 0,
          totalBytes: file.size,
        });
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    });

    if (errors.length > 0) {
      toast({
        title: "Some files were rejected",
        description: errors.slice(0, 3).join(', ') + (errors.length > 3 ? '...' : ''),
        variant: "destructive",
      });
    }

    if (validFiles.length > 0) {
      setUploadQueue(prev => [...prev, ...validFiles]);
      toast({
        title: "Files added",
        description: `${validFiles.length} file(s) ready for upload`,
        variant: "success",
      });
    }
  }, [uploadQueue.length, validateFile, toast]);

  const removeFile = useCallback((id: string) => {
    setUploadQueue(prev => prev.filter(item => item.id !== id));
    setPausedUploads(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  }, []);

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
      setUploadQueue(prev => prev.filter(item => item.id !== id));
    }, 1000);
  }, []);

  const uploadFile = useCallback(async (item: FileUploadItem) => {
    const { file } = item;
    const fileType = getFileType(file);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const storageFolder = getStorageFolder(fileType);
    const filePath = `${storageFolder}/${fileName}`;

    let progressInterval: NodeJS.Timeout | null = null;
    let uploadAbortController: AbortController | null = null;
    let simulatedUploadedBytes = 0;
    const chunkSize = Math.max(1024 * 1024, file.size / 100);

    try {
      // Check if paused
      if (pausedUploads.has(item.id)) {
        return;
      }

      // Update status to uploading
      setUploadQueue(prev => prev.map(f => 
        f.id === item.id ? { ...f, status: 'uploading' as const } : f
      ));

      // Progress tracking - simulate upload progress
      progressInterval = setInterval(() => {
        if (pausedUploads.has(item.id)) {
          if (progressInterval) clearInterval(progressInterval);
          progressInterval = null;
          return;
        }

        simulatedUploadedBytes = Math.min(simulatedUploadedBytes + chunkSize, file.size * 0.90);
        const progress = Math.round((simulatedUploadedBytes / file.size) * 100);
        
        setUploadQueue(prev => prev.map(f => 
          f.id === item.id ? { 
            ...f, 
            progress,
            uploadedBytes: simulatedUploadedBytes 
          } : f
        ));

        if (simulatedUploadedBytes >= file.size * 0.90) {
          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
          }
        }
      }, 100);

      console.log('Starting upload for file:', file.name);
      
      // Get current user first to ensure we have the ID
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        console.error('User authentication error:', userError);
        throw new Error('User not authenticated - please log in again');
      }
      
      console.log('User authenticated:', userData.user.id);

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

      // Create abort controller for timeout handling
      uploadAbortController = new AbortController();
      const timeoutId = setTimeout(() => {
        uploadAbortController?.abort();
      }, 300000); // 5 minute timeout

      console.log('Uploading to storage path:', filePath);
      
      // Upload to Supabase Storage
      let { data, error } = await supabase.storage
        .from('content')
        .upload(filePath, file, {
          upsert: false // Don't overwrite if file exists
        });

      clearTimeout(timeoutId);
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      
      console.log('Storage upload result:', { data, error });
      
      if (error) {
        // Handle specific upload errors
        if (error.message.includes('already exists')) {
          // Retry with different filename
          const retryFileName = `${Date.now()}_${Math.random()}.${fileExt}`;
          const retryFilePath = `${storageFolder}/${retryFileName}`;
          
          const { data: retryData, error: retryError } = await supabase.storage
            .from('content')
            .upload(retryFilePath, file);
          
          if (retryError) throw retryError;
          data = retryData;
        } else {
          throw error;
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
        title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
        original_filename: file.name,
        file_path: data!.path,
        content_type: fileType,
        mime_type: file.type,
        file_size: file.size,
        creator_id: userData.user.id,
      };
      
      console.log('Insert payload:', insertPayload);
      
      const { data: insertData, error: dbError } = await supabase
        .from('content_files')
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

  const startUpload = useCallback(async () => {
    if (queueRef.current.length === 0 || isUploading) return;

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
  }, []);

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
    processedCount: uploadQueue.filter(f => f.status === 'completed').length,
    totalCount: uploadQueue.length,
  };
};