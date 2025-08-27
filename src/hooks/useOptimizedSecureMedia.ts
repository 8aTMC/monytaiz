import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OptimizedSecureMediaCache {
  [key: string]: {
    url: string;
    expires_at: string;
  };
}

// Enhanced global cache with longer persistence
const optimizedCache: OptimizedSecureMediaCache = {};
const loadingPromises: { [key: string]: Promise<string | null> } = {};

export const useOptimizedSecureMedia = () => {
  const [loading, setLoading] = useState(false);

  const getOptimizedSecureUrl = useCallback(async (
    path: string, 
    transforms?: { width?: number; height?: number; quality?: number }
  ): Promise<string | null> => {
    if (!path) return null;

    const cacheKey = `${path}_${JSON.stringify(transforms || {})}`;
    
    // Check if URL is still valid (with buffer time)
    const cached = optimizedCache[cacheKey];
    if (cached) {
      const expiresAt = new Date(cached.expires_at);
      const bufferTime = 10 * 60 * 1000; // 10 minutes buffer
      if (expiresAt.getTime() - bufferTime > Date.now()) {
        return cached.url;
      }
    }

    // Check if already loading to prevent duplicate requests
    if (loadingPromises[cacheKey]) {
      return await loadingPromises[cacheKey];
    }

    // Create loading promise
    const loadingPromise = (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ path });
        if (transforms?.width) params.append('width', transforms.width.toString());
        if (transforms?.height) params.append('height', transforms.height.toString());
        if (transforms?.quality) params.append('quality', transforms.quality.toString());

        const session = await supabase.auth.getSession();
        if (!session.data.session?.access_token) {
          throw new Error('No auth session');
        }

        const response = await fetch(
          `https://alzyzfjzwvofmjccirjq.supabase.co/functions/v1/fast-secure-media?${params.toString()}`,
          {
            headers: {
              'Authorization': `Bearer ${session.data.session.access_token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        
        if (result.error) {
          throw new Error(result.error);
        }

        // Cache the result with longer expiry
        optimizedCache[cacheKey] = {
          url: result.url,
          expires_at: result.expires_at
        };

        return result.url;
      } catch (error) {
        console.error('Error getting optimized secure URL:', error);
        return null;
      } finally {
        setLoading(false);
        delete loadingPromises[cacheKey];
      }
    })();

    // Store promise to prevent duplicate requests
    loadingPromises[cacheKey] = loadingPromise;
    
    return await loadingPromise;
  }, []);

  // Get cached URL without making request
  const getCachedUrl = useCallback((
    path: string, 
    transforms?: { width?: number; height?: number; quality?: number }
  ): string | null => {
    const cacheKey = `${path}_${JSON.stringify(transforms || {})}`;
    const cached = optimizedCache[cacheKey];
    
    if (cached) {
      const expiresAt = new Date(cached.expires_at);
      const bufferTime = 10 * 60 * 1000; // 10 minutes buffer
      if (expiresAt.getTime() - bufferTime > Date.now()) {
        return cached.url;
      }
    }
    
    return null;
  }, []);

  return { 
    getOptimizedSecureUrl, 
    getCachedUrl,
    loading 
  };
};