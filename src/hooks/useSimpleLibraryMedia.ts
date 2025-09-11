import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SimpleLibraryMediaState {
  thumbnailUrl: string | null;
  isLoading: boolean;
  error: boolean;
}

interface LibraryMediaItem {
  id: string;
  type: 'image' | 'video' | 'audio';
  storage_path?: string;
  thumbnail_path?: string;
  processed_path?: string;
  original_path?: string;
}

export const useSimpleLibraryMedia = () => {
  const [mediaState, setMediaState] = useState<SimpleLibraryMediaState>({
    thumbnailUrl: null,
    isLoading: false,
    error: false
  });

  // Clean storage path by removing content/ prefix if present
  const cleanStoragePath = useCallback((path: string): string => {
    return path.startsWith('content/') ? path.replace('content/', '') : path;
  }, []);

  // Get thumbnail URL for library media items
  const getThumbnailUrl = useCallback(async (item: LibraryMediaItem): Promise<string | null> => {
    setMediaState(prev => ({ ...prev, isLoading: true, error: false }));

    try {
      let pathToTry: string | null = null;

      // Priority order: thumbnail_path > processed_path > storage_path > original_path
      if (item.thumbnail_path) {
        pathToTry = item.thumbnail_path;
      } else if (item.processed_path) {
        pathToTry = item.processed_path;
      } else if (item.storage_path) {
        pathToTry = item.storage_path;
      } else if (item.original_path) {
        pathToTry = item.original_path;
      }

      if (!pathToTry) {
        throw new Error('No valid path found for media item');
      }

      // Clean the path
      const cleanPath = cleanStoragePath(pathToTry);
      
      // Create signed URL with thumbnail transforms for images
      const transforms = item.type === 'image' ? {
        transform: {
          width: 512,
          height: 512,
          quality: 85,
          resize: 'cover' as const
        }
      } : undefined;

      const { data, error } = await supabase.storage
        .from('content')
        .createSignedUrl(cleanPath, 3600, transforms); // 1 hour expiry

      if (error || !data.signedUrl) {
        throw new Error(error?.message || 'Failed to create signed URL');
      }

      setMediaState({
        thumbnailUrl: data.signedUrl,
        isLoading: false,
        error: false
      });

      return data.signedUrl;

    } catch (error) {
      console.warn('Failed to get library media URL:', error);
      setMediaState({
        thumbnailUrl: null,
        isLoading: false,
        error: true
      });
      return null;
    }
  }, [cleanStoragePath]);

  // Reset media state
  const resetMedia = useCallback(() => {
    setMediaState({
      thumbnailUrl: null,
      isLoading: false,
      error: false
    });
  }, []);

  return {
    getThumbnailUrl,
    resetMedia,
    ...mediaState
  };
};