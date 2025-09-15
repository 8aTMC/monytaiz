import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OptimizationInfo {
  originalSize: number;
  optimizedSize: number;
  percentSaved: number;
}

interface UploadFileOptions {
  file: File;
  onProgress: (progress: number, uploadedBytes: number, totalBytes: number, uploadSpeed?: number) => void;
  onOptimization: (info: OptimizationInfo) => void;
  onStatusChange: (status: 'pending' | 'processing' | 'uploading' | 'completed' | 'error') => void;
  metadata?: {
    mentions: string[];
    tags: string[];
    folders: string[];
    description: string;
    suggestedPrice: number | null;
  };
}

export const useEnhancedUpload = () => {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const getFileType = (file: File): 'image' | 'video' | 'audio' => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'].includes(extension)) return 'image';
    if (['.mp4', '.mov', '.webm', '.mkv'].includes(extension)) return 'video';
    if (['.mp3', '.wav', '.aac', '.ogg', '.opus'].includes(extension)) return 'audio';
    
    throw new Error(`Unsupported file type: ${extension}`);
  };

  const getStorageFolder = (fileType: 'image' | 'video' | 'audio'): string => {
    const folderMap = {
      video: 'videos',
      image: 'photos', 
      audio: 'audios'
    };
    return folderMap[fileType];
  };

  const optimizeImage = async (file: File): Promise<{ file: File; info: OptimizationInfo }> => {
    const originalSize = file.size;

    // Only optimize PNG and JPEG files
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      return {
        file,
        info: {
          originalSize,
          optimizedSize: originalSize,
          percentSaved: 0
        }
      };
    }

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });

      // Set canvas dimensions
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw image to canvas
      ctx?.drawImage(img, 0, 0);
      
      // Convert to WebP with 0.8 quality
      const webpBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to convert to WebP'));
        }, 'image/webp', 0.8);
      });

      URL.revokeObjectURL(img.src);

      // Use WebP if it's smaller, otherwise keep original
      if (webpBlob.size < originalSize) {
        const optimizedFile = new File([webpBlob], file.name.replace(/\.(png|jpg|jpeg)$/i, '.webp'), {
          type: 'image/webp'
        });
        
        const sizeSaved = originalSize - webpBlob.size;
        const percentSaved = Math.round((sizeSaved / originalSize) * 100);

        return {
          file: optimizedFile,
          info: {
            originalSize,
            optimizedSize: webpBlob.size,
            percentSaved
          }
        };
      }

      // No optimization benefit, return original
      return {
        file,
        info: {
          originalSize,
          optimizedSize: originalSize,
          percentSaved: 0
        }
      };

    } catch (error) {
      console.warn('Image optimization failed, using original:', error);
      return {
        file,
        info: {
          originalSize,
          optimizedSize: originalSize,
          percentSaved: 0
        }
      };
    }
  };

  const uploadWithProgress = async (
    file: File, 
    filePath: string, 
    onProgress: (progress: number, uploadedBytes: number, totalBytes: number, uploadSpeed?: number) => void
  ): Promise<{ data: any; error?: any }> => {
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let lastUploadedBytes = 0;
      let lastTime = Date.now();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 85) + 10; // 10-95%
          const currentTime = Date.now();
          const timeDiff = currentTime - lastTime;
          
          let uploadSpeed = 0;
          if (timeDiff > 100) { // Update speed every 100ms
            const bytesDiff = event.loaded - lastUploadedBytes;
            uploadSpeed = (bytesDiff / timeDiff) * 1000; // bytes per second
            
            lastUploadedBytes = event.loaded;
            lastTime = currentTime;
          }
          
          onProgress(progress, event.loaded, event.total, uploadSpeed);
        }
      });

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve({ data: response });
          } catch (e) {
            reject(new Error('Invalid response format'));
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            resolve({ data: null, error: errorResponse.error || 'Upload failed' });
          } catch (e) {
            resolve({ data: null, error: `HTTP ${xhr.status}: Upload failed` });
          }
        }
      };

      xhr.onerror = () => resolve({ data: null, error: 'Network error during upload' });
      xhr.onabort = () => resolve({ data: null, error: 'Upload cancelled' });

      // Prepare form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', filePath);
      formData.append('cacheControl', '3600');
      formData.append('upsert', 'false');

      // Use standard Supabase storage upload for simplicity
      supabase.storage
        .from('content')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })
        .then(({ data, error }) => {
          resolve({ data, error });
        })
        .catch((error) => {
          resolve({ data: null, error: error.message });
        });
    });
  };

  const uploadFile = useCallback(async (options: UploadFileOptions): Promise<{ success: boolean; data?: any; error?: string }> => {
    const { file, onProgress, onOptimization, onStatusChange, metadata } = options;

    try {
      onStatusChange('pending');
      
      // Get user data first
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        throw new Error('Authentication required');
      }

      const fileType = getFileType(file);
      const storageFolder = getStorageFolder(fileType);
      
      // Generate unique filename
      const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_');
      const uniqueFilename = `${baseName}_${Date.now()}.${fileExtension}`;
      const filePath = `${storageFolder}/${userData.user.id}/${uniqueFilename}`;

      let processedFile = file;
      let optimizationInfo: OptimizationInfo = {
        originalSize: file.size,
        optimizedSize: file.size,
        percentSaved: 0
      };

      // Process image files for optimization
      if (fileType === 'image') {
        onStatusChange('processing');
        onProgress(5, 0, file.size);
        
        const optimization = await optimizeImage(file);
        processedFile = optimization.file;
        optimizationInfo = optimization.info;
        
        onOptimization(optimizationInfo);
        onProgress(10, 0, processedFile.size);
      }

      onStatusChange('uploading');

      // Upload with real progress tracking
      const { data, error } = await uploadWithProgress(
        processedFile, 
        filePath, 
        onProgress
      );

      if (error) {
        if (error.includes?.('Duplicate') || error.message?.includes?.('Duplicate')) {
          throw new Error('A file with this name already exists');
        }
        throw new Error(`Upload failed: ${typeof error === 'string' ? error : error.message}`);
      }

      // Set progress to 95% for database operations
      onProgress(95, processedFile.size, processedFile.size);

      // Insert metadata into database
      const insertPayload = {
        title: metadata?.description || file.name.replace(/\.[^/.]+$/, ""),
        description: metadata?.description || null,
        tags: metadata?.tags || [],
        mentions: metadata?.mentions || [],
        suggested_price_cents: metadata?.suggestedPrice ? Math.round(metadata.suggestedPrice * 100) : 0,
        original_filename: file.name,
        original_path: filePath,
        mime_type: processedFile.type,
        media_type: fileType,
        original_size_bytes: optimizationInfo.originalSize,
        optimized_size_bytes: optimizationInfo.optimizedSize,
        creator_id: userData.user.id,
      };
      
      const { data: insertData, error: dbError } = await supabase
        .from('simple_media')
        .insert(insertPayload)
        .select();

      if (dbError) {
        throw new Error(`Failed to save file metadata: ${dbError.message}`);
      }

      // Add to folders if specified
      if (metadata?.folders && metadata.folders.length > 0 && insertData?.[0]?.id) {
        try {
          const folderAssignments = metadata.folders.map(folderId => ({
            media_id: insertData[0].id,
            collection_id: folderId,
            added_by: userData.user.id,
          }));

          await supabase.from('collection_items').insert(folderAssignments);
        } catch (folderAssignError) {
          console.warn('Folder assignment error:', folderAssignError);
        }
      }

      // Complete upload
      onStatusChange('completed');
      onProgress(100, processedFile.size, processedFile.size);

      toast({
        title: "Upload successful",
        description: `${file.name} uploaded successfully${optimizationInfo.percentSaved > 0 ? ` (${optimizationInfo.percentSaved}% smaller)` : ''}`,
      });

      return { success: true, data };

    } catch (error) {
      onStatusChange('error');
      
      let errorMessage = 'Upload failed';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Upload failed",
        description: `${file.name}: ${errorMessage}`,
        variant: "destructive",
      });

      return { success: false, error: errorMessage };
    }
  }, [toast]);

  return {
    uploadFile,
    isUploading
  };
};
