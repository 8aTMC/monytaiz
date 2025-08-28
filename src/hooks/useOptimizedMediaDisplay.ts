import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OptimizedMediaState {
  currentUrl: string | null;
  isLoading: boolean;
  error: boolean;
}

interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'audio';
  storage_path?: string;
  path?: string;
  tiny_placeholder?: string;
  width?: number;
  height?: number;
}

const SUPABASE_PROJECT_URL = 'https://alzyzfjzwvofmjccirjq.supabase.co';

// Enhanced cache for URLs
const urlCache = new Map();

export const useOptimizedMediaDisplay = () => {
  const [mediaState, setMediaState] = useState<OptimizedMediaState>({
    currentUrl: null,
    isLoading: false,
    error: false
  });

  const loadingRef = useRef<boolean>(false);
  const currentItemRef = useRef<string | null>(null);

  // Generate optimized transform URL using Supabase Image Transformations
  const getTransformUrl = useCallback((
    path: string, 
    transforms: {
      width?: number;
      height?: number;
      quality?: number;
      resize?: 'cover' | 'contain' | 'fill';
      dpr?: number;
    } = {}
  ): string => {
    const params = new URLSearchParams();
    
    if (transforms.width) params.set('width', transforms.width.toString());
    if (transforms.height) params.set('height', transforms.height.toString());
    if (transforms.quality) params.set('quality', transforms.quality.toString());
    if (transforms.resize) params.set('resize', transforms.resize);
    if (transforms.dpr) params.set('dpr', transforms.dpr.toString());

    const queryString = params.toString();
    const baseUrl = `${SUPABASE_PROJECT_URL}/storage/v1/object/public/content/${path}`;
    
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }, []);

  // Get signed URL with transforms for private content
  const getSignedTransformUrl = useCallback(async (
    path: string,
    transforms: Parameters<typeof getTransformUrl>[1] = {},
    expiresIn: number = 3600
  ): Promise<string | null> => {
    try {
      const cacheKey = `${path}-${JSON.stringify(transforms)}-${expiresIn}`;
      const cached = urlCache.get(cacheKey);
      
      if (cached && cached.expires > Date.now()) {
        return cached.url;
      }

      // Create signed URL with transforms
      const { data, error } = await supabase.storage
        .from('content')
        .createSignedUrl(path, expiresIn, {
          transform: transforms.width || transforms.height ? {
            width: transforms.width,
            height: transforms.height,
            quality: transforms.quality || 85,
            resize: transforms.resize || 'cover'
          } : undefined
        });

      if (error || !data.signedUrl) {
        // Silent handling for missing files
        return null;
      }

      // Cache the result
      urlCache.set(cacheKey, {
        url: data.signedUrl,
        expires: Date.now() + (expiresIn * 1000) - 60000
      });

      return data.signedUrl;
    } catch (error) {
      // Silent error handling to prevent console spam
      return null;
    }
  }, []);

  // Simplified media loading with flat file structure priority
  const loadOptimizedMedia = useCallback(async (item: MediaItem, isPublic: boolean = false) => {
    const itemId = `${item.id}-${item.type}`;
    
    // Prevent duplicate loading of same item
    if (loadingRef.current || currentItemRef.current === itemId) return;
    
    loadingRef.current = true;
    currentItemRef.current = itemId;
    setMediaState(prev => ({ ...prev, isLoading: true, error: false }));

    try {
      // Determine best file path - prioritize actual folder structure
      let bestPath: string | null = null;
      
      if (item.type === 'image') {
        // Try processed folder structure first (where files are actually stored)
        bestPath = `processed/${item.id}/image.webp`;
      } else if (item.type === 'video') {
        // Try processed folder structure first (where files are actually stored)
        bestPath = `processed/${item.id}/video.mp4`;
      } else {
        // For audio or other types, fallback to original path
        bestPath = item.path || item.storage_path || null;
      }

      if (!bestPath) {
        throw new Error('No valid file path found');
      }

      let finalUrl: string | null = null;

      if (isPublic) {
        // For public files, use direct transform URL
        finalUrl = getTransformUrl(bestPath, {
          quality: 85,
          ...(item.type === 'image' && {
            width: 512,
            height: 512,
            resize: 'cover'
          })
        });
      } else {
        // For private files, get signed URL
        finalUrl = await getSignedTransformUrl(bestPath, {
          quality: 85,
          ...(item.type === 'image' && {
            width: 512,
            height: 512,
            resize: 'cover'
          })
        });

        // If processed version fails, try original path as fallback
        if (!finalUrl && (item.path || item.storage_path)) {
          const fallbackPath = item.path || item.storage_path!;
          finalUrl = await getSignedTransformUrl(fallbackPath, {
            quality: 85,
            ...(item.type === 'image' && {
              width: 512,
              height: 512,
              resize: 'cover'
            })
          });
        }
      }

      if (!finalUrl) {
        throw new Error('Failed to generate media URL');
      }

      // Set the final URL immediately - no progressive loading
      setMediaState(prev => ({
        ...prev,
        currentUrl: finalUrl,
        isLoading: false,
        error: false
      }));

    } catch (error) {
      // Silent error handling - just show error state
      setMediaState(prev => ({
        ...prev,
        currentUrl: null,
        isLoading: false,
        error: true
      }));
    } finally {
      loadingRef.current = false;
    }
  }, [getTransformUrl, getSignedTransformUrl]);

  // Simple quality enhancement (no-op since we load at full quality)
  const enhanceQuality = useCallback(() => {
    // No-op since we already load at optimal quality
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      currentItemRef.current = null;
      loadingRef.current = false;
    };
  }, []);

  return {
    loadOptimizedMedia,
    enhanceQuality,
    getTransformUrl,
    getSignedTransformUrl,
    ...mediaState
  };
};