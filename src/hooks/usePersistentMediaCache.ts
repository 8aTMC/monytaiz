import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { mediaCache } from '@/lib/mediaCache';

const loadingPromises: { [key: string]: Promise<string | null> } = {};

export const usePersistentMediaCache = () => {
  const [loading, setLoading] = useState(false);

  const getSecureMediaUrl = useCallback(async (
    path: string, 
    transforms?: { width?: number; height?: number; quality?: number }
  ): Promise<string | null> => {
    if (!path) return null;

    const cacheKey = `persistent_${path}_${JSON.stringify(transforms || {})}`;
    
    // Check unified cache first
    const cached = mediaCache.get(path, transforms, 'persistent');
    if (cached) {
      // Prefer blob URL for instant access
      if (cached.blobUrl && cached.blobUrl.startsWith('blob:')) {
        return cached.blobUrl;
      }
      // Check if signed URL is still valid
      if (cached.url && cached.expires_at) {
        const expiresAt = new Date(cached.expires_at);
        if (expiresAt.getTime() > Date.now()) {
          return cached.url;
        }
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
        const normalizedPath = path.replace(/^content\//, '');
        const params = new URLSearchParams({ path: normalizedPath });
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

        // Try to fetch the actual media and create blob URL for persistent caching
        let blobUrl: string | undefined;
        try {
          const mediaResponse = await fetch(result.url, {
            headers: { 'Accept': '*/*' }
          });
          
          if (mediaResponse.ok && mediaResponse.status === 200) {
            const blob = await mediaResponse.blob();
            if (blob && blob.size > 0) {
              blobUrl = URL.createObjectURL(blob);
            }
          }
        } catch (blobError) {
          console.warn('Failed to create blob URL:', blobError);
        }

        // Cache using unified cache manager
        mediaCache.set(path, {
          url: result.url,
          blobUrl,
          expires_at: result.expires_at,
          type: 'persistent'
        }, transforms, 'persistent');

        return blobUrl || result.url;
      } catch (error) {
        console.error('Error getting secure media URL:', error);
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
  const getCachedMediaUrl = useCallback((
    path: string, 
    transforms?: { width?: number; height?: number; quality?: number }
  ): string | null => {
    const cached = mediaCache.get(path, transforms, 'persistent');
    
    if (cached) {
      // Prefer blob URL for instant loading
      if (cached.blobUrl && cached.blobUrl.startsWith('blob:')) {
        return cached.blobUrl;
      }
      // Fallback to signed URL if still valid
      if (cached.expires_at) {
        const expiresAt = new Date(cached.expires_at);
        if (expiresAt.getTime() > Date.now()) {
          return cached.url;
        }
      }
    }
    
    return null;
  }, []);

  // Clear cache function
  const clearCache = useCallback(() => {
    mediaCache.clearCache();
  }, []);

  return { 
    getSecureMediaUrl, 
    getCachedMediaUrl,
    clearCache,
    loading 
  };
};