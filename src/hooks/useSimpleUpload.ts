import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useSimpleUpload = () => {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Generate unique path for original file
      const fileId = crypto.randomUUID();
      const originalPath = `incoming/${fileId}-${file.name}`;
      
      // Upload original file to storage
      const { error: uploadError } = await supabase.storage
        .from('content')
        .upload(originalPath, file, {
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Determine media type
      const mediaType = file.type.startsWith('image/') ? 'image' : 
                       file.type.startsWith('video/') ? 'video' : 
                       file.type.startsWith('audio/') ? 'audio' : 'image';

      // Create database record
      const { data: mediaRecord, error: dbError } = await supabase
        .from('simple_media')
        .insert({
          creator_id: user.id,
          original_filename: file.name,
          title: file.name.split('.')[0], // Remove extension for title
          mime_type: file.type,
          original_size_bytes: file.size,
          original_path: originalPath,
          media_type: mediaType,
          processing_status: 'pending'
        })
        .select()
        .single();

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }

      // Trigger optimization in background
      supabase.functions.invoke('media-optimizer', {
        body: {
          mediaId: mediaRecord.id,
          originalPath,
          mimeType: file.type,
          mediaType
        }
      }).catch(error => {
        console.error('Background optimization failed:', error);
        // Don't throw here - the file is uploaded, optimization can be retried
      });

      toast({
        title: "Upload successful",
        description: `${file.name} is being processed`,
      });

      return mediaRecord;

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
  }, [toast]);

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
    uploadMultiple
  };
};