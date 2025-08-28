import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SimpleMediaItem {
  id: string;
  creator_id: string;
  title: string;
  description?: string;
  tags: string[];
  mentions?: string[];
  suggested_price_cents?: number;
  original_filename: string;
  original_path: string;
  processed_path?: string;
  thumbnail_path?: string;
  mime_type: string;
  media_type: 'image' | 'video' | 'audio';
  processing_status: 'pending' | 'processing' | 'processed' | 'failed';
  processing_error?: string;
  processed_at?: string;
  width?: number;
  height?: number;
  duration_seconds?: number;
  original_size_bytes: number;
  optimized_size_bytes?: number;
  created_at: string;
  updated_at: string;
}

export const useSimpleMedia = () => {
  const [media, setMedia] = useState<SimpleMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('simple_media')
        .select('*')
        .eq('processing_status', 'processed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Type cast and validate fields
      const validatedMedia = (data || []).map(item => ({
        ...item,
        media_type: (item.media_type === 'image' || item.media_type === 'video' || item.media_type === 'audio') 
          ? item.media_type as 'image' | 'video' | 'audio'
          : 'image' as const,
        processing_status: (item.processing_status === 'pending' || item.processing_status === 'processing' || 
                           item.processing_status === 'processed' || item.processing_status === 'failed')
          ? item.processing_status as 'pending' | 'processing' | 'processed' | 'failed'
          : 'processed' as const
      }));
      
      setMedia(validatedMedia);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch media');
      console.error('Error fetching media:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const getMediaUrl = useCallback(async (path: string | undefined, useTransforms = false) => {
    if (!path) return null;
    
    try {
      // Since content bucket is private, use signed URLs
      const options: any = {};
      
      if (useTransforms) {
        options.transform = {
          width: 512,
          height: 512,
          quality: 85,
          resize: 'cover'
        };
      }
      
      const { data, error } = await supabase.storage
        .from('content')
        .createSignedUrl(path, 3600, options);

      if (error || !data.signedUrl) {
        console.error('Failed to get signed URL for:', path, error);
        return null;
      }
      
      return data.signedUrl;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      return null;
    }
  }, []);

  const getThumbnailUrl = useCallback((item: SimpleMediaItem) => {
    // Return null initially, components should handle async loading
    return null;
  }, []);

  const getFullUrl = useCallback((item: SimpleMediaItem) => {
    // Return null initially, components should handle async loading  
    return null;
  }, []);

  // Async versions for when needed
  const getThumbnailUrlAsync = useCallback(async (item: SimpleMediaItem) => {
    const thumbnailUrl = await getMediaUrl(item.thumbnail_path, true);
    if (thumbnailUrl) return thumbnailUrl;
    return await getMediaUrl(item.processed_path, true);
  }, [getMediaUrl]);

  const getFullUrlAsync = useCallback(async (item: SimpleMediaItem) => {
    return await getMediaUrl(item.processed_path, false);
  }, [getMediaUrl]);

  // Update media metadata
  const updateMediaMetadata = useCallback(async (
    mediaId: string, 
    metadata: Partial<Pick<SimpleMediaItem, 'title' | 'description' | 'tags' | 'mentions' | 'suggested_price_cents'>>
  ) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: updateError } = await supabase
        .from('simple_media')
        .update(metadata)
        .eq('id', mediaId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Update local state
      setMedia(prevMedia => 
        prevMedia.map(item => 
          item.id === mediaId ? { 
            ...item, 
            ...metadata,
            // Ensure type safety for the update
            tags: metadata.tags || item.tags,
            mentions: metadata.mentions || item.mentions
          } : item
        )
      );

      toast({
        title: "Success",
        description: "Media metadata updated successfully",
      });

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update media metadata';
      setError(errorMessage);
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Add media to folders (collections)
  const addToFolders = useCallback(async (mediaId: string, folderIds: string[]) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // First remove existing folder assignments for this media
      await supabase
        .from('collection_items')
        .delete()
        .eq('media_id', mediaId);

      // Add new folder assignments
      if (folderIds.length > 0 && user?.id) {
        const { error: insertError } = await supabase
          .from('collection_items')
          .insert(
            folderIds.map(folderId => ({
              collection_id: folderId,
              media_id: mediaId,
              added_by: user.id
            }))
          );

        if (insertError) {
          throw insertError;
        }
      }

      toast({
        title: "Success",
        description: "Media folders updated successfully",
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update media folders';
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      throw err;
    }
  }, [toast]);

  // Get folders for a media item
  const getMediaFolders = useCallback(async (mediaId: string): Promise<string[]> => {
    try {
      const { data, error } = await supabase
        .from('collection_items')
        .select('collection_id')
        .eq('media_id', mediaId);

      if (error) {
        throw error;
      }

      return data.map(item => item.collection_id);
    } catch (err) {
      console.error('Error fetching media folders:', err);
      return [];
    }
  }, []);

  return {
    media,
    loading,
    error,
    fetchMedia,
    getThumbnailUrl,
    getFullUrl,
    getThumbnailUrlAsync,
    getFullUrlAsync,
    updateMediaMetadata,
    addToFolders,
    getMediaFolders,
  };
};