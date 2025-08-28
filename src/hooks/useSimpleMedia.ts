import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SimpleMediaItem {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  original_filename: string;
  mime_type: string;
  media_type: 'image' | 'video' | 'audio';
  processing_status: 'pending' | 'processing' | 'processed' | 'failed';
  processed_path?: string;
  thumbnail_path?: string;
  width?: number;
  height?: number;
  duration_seconds?: number;
  original_size_bytes: number;
  optimized_size_bytes?: number;
  created_at: string;
  processed_at?: string;
}

export const useSimpleMedia = () => {
  const [media, setMedia] = useState<SimpleMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const getMediaUrl = useCallback((path: string | undefined) => {
    if (!path) return null;
    
    const baseUrl = 'https://alzyzfjzwvofmjccirjq.supabase.co/storage/v1/object/public/content';
    return `${baseUrl}/${path}`;
  }, []);

  const getThumbnailUrl = useCallback((item: SimpleMediaItem) => {
    return getMediaUrl(item.thumbnail_path) || getMediaUrl(item.processed_path);
  }, [getMediaUrl]);

  const getFullUrl = useCallback((item: SimpleMediaItem) => {
    return getMediaUrl(item.processed_path);
  }, [getMediaUrl]);

  return {
    media,
    loading,
    error,
    fetchMedia,
    getThumbnailUrl,
    getFullUrl
  };
};