import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SecureMediaCache {
  [key: string]: {
    url: string;
    expires_at: string;
    quality?: string;
  };
}

interface MediaTransforms {
  width?: number;
  height?: number;
  quality?: number;
}

// Extended cache duration for better performance
const CACHE_DURATION_HOURS = 4;
const mediaCache: SecureMediaCache = {};
const loadingPromises = new Map<string, Promise<string | null>>();

export const useOptimizedSecureMedia = () => {
  const [loading, setLoading] = useState(false);
  const abortController = useRef<AbortController | null>(null);

  const createCacheKey = (path: string, transforms?: MediaTransforms) => {
    return `${path}_${JSON.stringify(transforms || {})}`;
  };

  const isCacheValid = (cached: { expires_at: string }) => {
    return new Date(cached.expires_at) > new Date();
  };

  const getSecureUrl = useCallback(async (
    path: string, 
    transforms?: MediaTransforms,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<string | null> => {
    if (!path) return null;

    const cacheKey = createCacheKey(path, transforms);
    
    // Check cache first
    const cached = mediaCache[cacheKey];
    if (cached && isCacheValid(cached)) {
      return cached.url;
    }

    // Check if already loading
    if (loadingPromises.has(cacheKey)) {
      return loadingPromises.get(cacheKey)!;
    }

    // Create loading promise
    const loadPromise = (async () => {
      try {
        if (priority === 'high') {
          setLoading(true);
        }

        // Cancel previous request if needed
        if (abortController.current) {
          abortController.current.abort();
        }
        abortController.current = new AbortController();

        const session = await supabase.auth.getSession();
        if (!session.data.session?.access_token) {
          throw new Error('No authentication session');
        }

        const params = new URLSearchParams({ 
          path,
          cache_duration: (CACHE_DURATION_HOURS * 3600).toString()
        });
        
        if (transforms?.width) params.append('width', transforms.width.toString());
        if (transforms?.height) params.append('height', transforms.height.toString());
        if (transforms?.quality) params.append('quality', transforms.quality.toString());

        const response = await fetch(
          `https://alzyzfjzwvofmjccirjq.supabase.co/functions/v1/fast-secure-media?${params.toString()}`,
          {
            headers: {
              'Authorization': `Bearer ${session.data.session.access_token}`,
              'Content-Type': 'application/json'
            },
            signal: abortController.current.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to get secure URL: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.error) {
          throw new Error(result.error);
        }

        // Cache with extended duration
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + CACHE_DURATION_HOURS);
        
        mediaCache[cacheKey] = {
          url: result.url,
          expires_at: expiresAt.toISOString(),
          quality: transforms?.quality?.toString()
        };

        return result.url;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return null;
        }
        console.error('Error getting secure URL:', error);
        return null;
      } finally {
        if (priority === 'high') {
          setLoading(false);
        }
        loadingPromises.delete(cacheKey);
      }
    })();

    loadingPromises.set(cacheKey, loadPromise);
    return loadPromise;
  }, []);

  const preloadUrl = useCallback(async (
    path: string,
    transforms?: MediaTransforms
  ) => {
    // Preload with low priority to avoid interfering with current playback
    return getSecureUrl(path, transforms, 'low');
  }, [getSecureUrl]);

  const preloadMultipleQualities = useCallback(async (
    path: string,
    qualities: { width?: number; height?: number; quality?: number }[]
  ) => {
    // Preload multiple qualities in parallel
    const promises = qualities.map(quality => 
      preloadUrl(path, quality)
    );
    
    try {
      await Promise.allSettled(promises);
    } catch (error) {
      console.warn('Some quality preloads failed:', error);
    }
  }, [preloadUrl]);

  const clearCache = useCallback(() => {
    Object.keys(mediaCache).forEach(key => delete mediaCache[key]);
    loadingPromises.clear();
  }, []);

  const getCacheStats = useCallback(() => {
    const keys = Object.keys(mediaCache);
    const validEntries = keys.filter(key => isCacheValid(mediaCache[key]));
    
    return {
      total: keys.length,
      valid: validEntries.length,
      expired: keys.length - validEntries.length
    };
  }, []);

  return { 
    getSecureUrl, 
    preloadUrl,
    preloadMultipleQualities,
    loading,
    clearCache,
    getCacheStats
  };
};