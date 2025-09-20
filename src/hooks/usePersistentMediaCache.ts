import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CachedMedia {
  url: string;
  blobUrl: string;
  expires_at: string;
  cached_at: number;
}

interface PersistentMediaCache {
  [key: string]: CachedMedia;
}

// Enhanced persistent cache using localStorage for faster access
const CACHE_KEY = 'secure_media_cache';
const MAX_CACHE_SIZE = 100; // Max items to cache
const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours

// In-memory cache for immediate access
let memoryCache: PersistentMediaCache = {};
const loadingPromises: { [key: string]: Promise<string | null> } = {};

// Load cache from localStorage on module init
try {
  const stored = localStorage.getItem(CACHE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    // Validate and clean expired entries
    const now = Date.now();
    Object.entries(parsed).forEach(([key, value]: [string, any]) => {
      if (value.cached_at && (now - value.cached_at) < CACHE_DURATION) {
        memoryCache[key] = value;
      }
    });
  }
} catch (error) {
  console.warn('Failed to load media cache from localStorage:', error);
}

// Save cache to localStorage
const saveCache = () => {
  try {
    // Clean old entries and limit size
    const entries = Object.entries(memoryCache);
    const sortedEntries = entries.sort(([,a], [,b]) => b.cached_at - a.cached_at);
    const limitedEntries = sortedEntries.slice(0, MAX_CACHE_SIZE);
    
    const limitedCache = Object.fromEntries(limitedEntries);
    localStorage.setItem(CACHE_KEY, JSON.stringify(limitedCache));
    memoryCache = limitedCache;
  } catch (error) {
    console.warn('Failed to save media cache to localStorage:', error);
  }
};

// Clean up blob URLs on page unload with delay to prevent race conditions
window.addEventListener('beforeunload', () => {
  setTimeout(() => {
    Object.values(memoryCache).forEach(cached => {
      if (cached.blobUrl && cached.blobUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(cached.blobUrl);
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
    });
  }, 100);
});

export const usePersistentMediaCache = () => {
  const [loading, setLoading] = useState(false);

  const getSecureMediaUrl = useCallback(async (
    path: string, 
    transforms?: { width?: number; height?: number; quality?: number }
  ): Promise<string | null> => {
    if (!path) return null;

    // Normalize path to avoid double content/ prefixing
    const normalizedPath = path.replace(/^content\//, '');
    const cacheKey = `${normalizedPath}_${JSON.stringify(transforms || {})}`;
    
    // Check memory cache first for instant access
    const cached = memoryCache[cacheKey];
    if (cached) {
      const now = Date.now();
      // Check if cache is still valid
      if ((now - cached.cached_at) < CACHE_DURATION) {
        // Verify blob URL is still valid and accessible
        if (cached.blobUrl && cached.blobUrl.startsWith('blob:')) {
          try {
            // Quick validation - create an image to test blob URL validity
            const testImg = new Image();
            testImg.src = cached.blobUrl;
            return cached.blobUrl;
          } catch (e) {
            // Blob URL is invalid, continue to other options
          }
        }
        // If signed URL is still valid, use it
        if (cached.url && cached.expires_at) {
          const expiresAt = new Date(cached.expires_at);
          if (expiresAt.getTime() > now) {
            return cached.url;
          }
        }
      }
      // Clean up expired or invalid cache
      if (cached.blobUrl && cached.blobUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(cached.blobUrl);
        } catch (e) {
          // Ignore revocation errors
        }
      }
      delete memoryCache[cacheKey];
    }

    // Check if already loading to prevent duplicate requests
    if (loadingPromises[cacheKey]) {
      return await loadingPromises[cacheKey];
    }

    // Create loading promise
    const loadingPromise = (async () => {
      setLoading(true);
      try {
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

        // Fetch the actual media and create blob URL for persistent caching
        try {
          const mediaResponse = await fetch(result.url, {
            headers: {
              'Accept': '*/*',
            }
          });
          if (mediaResponse.ok && mediaResponse.status === 200) {
            const blob = await mediaResponse.blob();
            // Validate blob before creating URL
            if (blob && blob.size > 0) {
              const blobUrl = URL.createObjectURL(blob);
              
              // Cache both the signed URL and blob URL
              memoryCache[cacheKey] = {
                url: result.url,
                blobUrl: blobUrl,
                expires_at: result.expires_at,
                cached_at: Date.now()
              };
              
              // Save to localStorage (without blob URLs to avoid issues)
              try {
                const cacheForStorage = { ...memoryCache };
                Object.values(cacheForStorage).forEach(item => {
                  if (item.blobUrl && item.blobUrl.startsWith('blob:')) {
                    item.blobUrl = item.url; // Store signed URL instead
                  }
                });
                localStorage.setItem(CACHE_KEY, JSON.stringify(cacheForStorage));
              } catch (e) {
                console.warn('Failed to save to localStorage:', e);
              }
              
              return blobUrl;
            }
          }
        } catch (blobError) {
          console.warn('Failed to create blob URL, using signed URL:', blobError);
        }

        // Fallback to signed URL if blob creation fails
        memoryCache[cacheKey] = {
          url: result.url,
          blobUrl: result.url, // Fallback to signed URL
          expires_at: result.expires_at,
          cached_at: Date.now()
        };

        return result.url;
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
    const cacheKey = `${path}_${JSON.stringify(transforms || {})}`;
    const cached = memoryCache[cacheKey];
    
    if (cached) {
      const now = Date.now();
      if ((now - cached.cached_at) < CACHE_DURATION) {
        // Prefer blob URL for instant loading
        if (cached.blobUrl.startsWith('blob:')) {
          return cached.blobUrl;
        }
        // Fallback to signed URL if still valid
        const expiresAt = new Date(cached.expires_at);
        if (expiresAt.getTime() > now) {
          return cached.url;
        }
      }
    }
    
    return null;
  }, []);

  // Clear cache function
  const clearCache = useCallback(() => {
    Object.values(memoryCache).forEach(cached => {
      if (cached.blobUrl && cached.blobUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(cached.blobUrl);
        } catch (e) {
          // Ignore revocation errors
        }
      }
    });
    memoryCache = {};
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (e) {
      // Ignore localStorage errors
    }
  }, []);

  return { 
    getSecureMediaUrl, 
    getCachedMediaUrl,
    clearCache,
    loading 
  };
};