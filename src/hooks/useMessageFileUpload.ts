import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UploadingFile } from '@/components/UploadProgressBar';

interface UseMessageFileUploadOptions {
  onUploadComplete?: (files: any[]) => void;
}

const FILE_LIMITS = {
  images: 20 * 1024 * 1024, // 20MB
  videos: 6 * 1024 * 1024 * 1024, // 6GB
  audio: 10 * 1024 * 1024, // 10MB
  documents: 100 * 1024 * 1024, // 100MB
};

export const useMessageFileUpload = (options: UseMessageFileUploadOptions = {}) => {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  };

  const validateFile = (file: File, type: string): boolean => {
    const limit = FILE_LIMITS[type as keyof typeof FILE_LIMITS];
    if (file.size > limit) {
      const limitMB = limit / (1024 * 1024);
      toast.error(`File "${file.name}" exceeds ${limitMB}MB limit for ${type}`);
      return false;
    }
    return true;
  };

  const createPreview = (file: File, type: string): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (type === 'images') {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        resolve(undefined);
      }
    });
  };

  const addFiles = useCallback(async (files: File[], type: string) => {
    // Validate files
    const validFiles = files.filter(file => validateFile(file, type));
    if (validFiles.length === 0) return;

    // Check total file limit
    if (uploadingFiles.length + validFiles.length > 10) {
      toast.error('Maximum 10 files per batch allowed');
      return;
    }

    // Create uploading file objects
    const newUploadingFiles: UploadingFile[] = await Promise.all(
      validFiles.map(async (file) => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        type,
        progress: 0,
        uploaded: false,
        preview: await createPreview(file, type)
      }))
    );

    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);
  }, [uploadingFiles.length]);

  const removeFile = useCallback((id: string) => {
    setUploadingFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const uploadFiles = useCallback(async () => {
    if (uploadingFiles.length === 0) return;
    
    setIsUploading(true);
    const uploadedFiles: any[] = [];

    try {
      // Get current user
      const user = await getCurrentUser();
      if (!user) {
        toast.error('Please log in to upload files');
        return;
      }

      for (const uploadingFile of uploadingFiles) {
        if (uploadingFile.uploaded) continue;

        const fileExt = uploadingFile.file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `messages/${fileName}`;

        // Simulate progress
        const progressInterval = setInterval(() => {
          setUploadingFiles(prev => 
            prev.map(f => 
              f.id === uploadingFile.id 
                ? { ...f, progress: Math.min(f.progress + 10, 90) }
                : f
            )
          );
        }, 200);

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('content')
          .upload(filePath, uploadingFile.file, {
            cacheControl: '3600',
            upsert: false
          });

        clearInterval(progressInterval);

        if (error) {
          toast.error(`Failed to upload ${uploadingFile.file.name}`);
          continue;
        }

        // Save file metadata to database
        const { data: fileData, error: dbError } = await supabase
          .from('content_files')
          .insert({
            creator_id: user.id,
            title: uploadingFile.file.name,
            original_filename: uploadingFile.file.name,
            file_path: filePath,
            file_size: uploadingFile.file.size,
            content_type: uploadingFile.type === 'images' ? 'image' : 
                         uploadingFile.type === 'videos' ? 'video' :
                         uploadingFile.type === 'audio' ? 'audio' : 'document',
            mime_type: uploadingFile.file.type,
            tags: ['Messages'] // Add Messages tag
          })
          .select()
          .single();

        if (dbError) {
          toast.error(`Failed to save ${uploadingFile.file.name} metadata`);
          console.error('Database error:', dbError);
          continue;
        }

        // Get the public URL
        const { data: { publicUrl } } = supabase.storage
          .from('content')
          .getPublicUrl(filePath);

        uploadedFiles.push({
          ...fileData,
          type: uploadingFile.type,
          name: uploadingFile.file.name,
          size: uploadingFile.file.size,
          url: publicUrl,
          preview: uploadingFile.preview
        });

        // Mark as uploaded
        setUploadingFiles(prev => 
          prev.map(f => 
            f.id === uploadingFile.id 
              ? { ...f, progress: 100, uploaded: true }
              : f
          )
        );
      }

      options.onUploadComplete?.(uploadedFiles);
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [uploadingFiles, options]);

  const clearFiles = useCallback(() => {
    setUploadingFiles([]);
  }, []);

  const allFilesUploaded = uploadingFiles.length > 0 && uploadingFiles.every(f => f.uploaded);
  const hasFiles = uploadingFiles.length > 0;

  return {
    uploadingFiles,
    isUploading,
    addFiles,
    removeFile,
    uploadFiles,
    clearFiles,
    allFilesUploaded,
    hasFiles
  };
};