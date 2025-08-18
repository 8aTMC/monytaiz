import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface FileUploadItem {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  thumbnailUrl?: string;
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

export const useFileUpload = () => {
  const [uploadQueue, setUploadQueue] = useState<FileUploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
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
  }, []);

  const uploadFile = useCallback(async (item: FileUploadItem) => {
    const { file } = item;
    const fileType = getFileType(file);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileType}/${fileName}`;

    let progressInterval: NodeJS.Timeout | null = null;

    try {
      // Update status to uploading
      setUploadQueue(prev => prev.map(f => 
        f.id === item.id ? { ...f, status: 'uploading' as const } : f
      ));

      // Simulate progress for now (Supabase doesn't support onUploadProgress yet)
      let progress = 0;
      progressInterval = setInterval(() => {
        progress += 15;
        setUploadQueue(prev => prev.map(f => 
          f.id === item.id ? { ...f, progress: Math.min(progress, 85) } : f
        ));
        if (progress >= 85) {
          if (progressInterval) clearInterval(progressInterval);
        }
      }, 300);

      const { data, error } = await supabase.storage
        .from('content')
        .upload(filePath, file);

      if (progressInterval) clearInterval(progressInterval);
      
      if (error) throw error;

      // Save to database
      const { error: dbError } = await supabase
        .from('content_files')
        .insert({
          title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
          original_filename: file.name,
          file_path: data.path,
          content_type: fileType as any,
          mime_type: file.type,
          file_size: file.size,
          creator_id: (await supabase.auth.getUser()).data.user?.id!,
        });

      if (dbError) throw dbError;

      // Mark as completed
      setUploadQueue(prev => prev.map(f => 
        f.id === item.id ? { ...f, status: 'completed' as const, progress: 100 } : f
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
  }, []);

  const startUpload = useCallback(async () => {
    if (uploadQueue.length === 0 || isUploading) return;

    setIsUploading(true);
    setCurrentUploadIndex(0);

    // Process files one by one
    for (let i = 0; i < uploadQueue.length; i++) {
      const item = uploadQueue[i];
      if (item.status === 'pending') {
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
    startUpload,
    clearQueue,
    processedCount: uploadQueue.filter(f => f.status === 'completed').length,
    totalCount: uploadQueue.length,
  };
};