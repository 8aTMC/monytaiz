import { useState, useCallback } from 'react';
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
    let simulatedUploadedBytes = 0;
    const chunkSize = Math.max(1024 * 1024, file.size / 100); // 1MB or 1% of file size

    try {
      // Check if paused
      if (pausedUploads.has(item.id)) {
        return;
      }

      // Update status to uploading
      setUploadQueue(prev => prev.map(f => 
        f.id === item.id ? { ...f, status: 'uploading' as const } : f
      ));

      // More realistic progress tracking
      progressInterval = setInterval(() => {
        if (pausedUploads.has(item.id)) {
          if (progressInterval) clearInterval(progressInterval);
          return;
        }

        simulatedUploadedBytes = Math.min(simulatedUploadedBytes + chunkSize, file.size * 0.9);
        const progress = Math.round((simulatedUploadedBytes / file.size) * 100);
        
        setUploadQueue(prev => prev.map(f => 
          f.id === item.id ? { 
            ...f, 
            progress,
            uploadedBytes: simulatedUploadedBytes 
          } : f
        ));

        if (simulatedUploadedBytes >= file.size * 0.9) {
          if (progressInterval) clearInterval(progressInterval);
        }
      }, 150);

      // Get current user first to ensure we have the ID
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase.storage
        .from('content')
        .upload(filePath, file);

      if (progressInterval) clearInterval(progressInterval);
      
      if (error) throw error;

      // Save to database with proper user ID
      const { error: dbError } = await supabase
        .from('content_files')
        .insert({
          title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
          original_filename: file.name,
          file_path: data.path,
          content_type: fileType as any,
          mime_type: file.type,
          file_size: file.size,
          creator_id: userData.user.id,
        });

      if (dbError) throw dbError;

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
      }, 1000);

    } catch (error) {
      if (progressInterval) clearInterval(progressInterval);
      setUploadQueue(prev => prev.map(f => 
        f.id === item.id ? { 
          ...f, 
          status: 'error' as const, 
          error: error instanceof Error ? error.message : 'Upload failed' 
        } : f
      ));
    }
  }, [pausedUploads]);

  const startUpload = useCallback(async () => {
    if (uploadQueue.length === 0 || isUploading) return;

    setIsUploading(true);
    setCurrentUploadIndex(0);

    // Process files one by one
    for (let i = 0; i < uploadQueue.length; i++) {
      const item = uploadQueue[i];
      if (item.status === 'pending' && !pausedUploads.has(item.id)) {
        setCurrentUploadIndex(i);
        await uploadFile(item);
      }
    }

    setIsUploading(false);
    toast({
      title: "Upload complete",
      description: "All files have been processed",
      variant: "success",
    });
  }, [uploadQueue, isUploading, uploadFile, toast]);

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