import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ProgressiveMedia {
  tiny?: string;
  low?: string;
  medium?: string;
  high?: string;
}

interface CachedProgressiveMedia extends ProgressiveMedia {
  expires_at: string;
  cached_at: number;
}

const CACHE_KEY = 'progressive_media_cache';
const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours
let memoryCache: { [key: string]: CachedProgressiveMedia } = {};

// Load from localStorage
try {
  const stored = localStorage.getItem(CACHE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    const now = Date.now();
    Object.entries(parsed).forEach(([key, value]: [string, any]) => {
      if (value.cached_at && (now - value.cached_at) < CACHE_DURATION) {
        memoryCache[key] = value;
      }
    });
  }
} catch (error) {
  console.warn('Failed to load progressive cache:', error);
}

const saveCache = () => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(memoryCache));
  } catch (error) {
    console.warn('Failed to save progressive cache:', error);
  }
};

export const useProgressiveMediaLoading = () => {
  const [currentQuality, setCurrentQuality] = useState<'tiny' | 'low' | 'medium' | 'high'>('tiny');
  const [loadingQuality, setLoadingQuality] = useState<string | null>(null);
  const [urls, setUrls] = useState<ProgressiveMedia>({});
  const loadingRef = useRef<{ [key: string]: Promise<string | null> }>({});
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getSecureUrl = async (path: string, quality: number): Promise<string | null> => {
    try {
      const params = new URLSearchParams({ path, quality: quality.toString() });
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

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const result = await response.json();
      return result.error ? null : result.url;
    } catch (error) {
      console.error('Failed to get secure URL:', error);
      return null;
    }
  };

  const loadProgressiveMedia = useCallback(async (
    storagePath: string,
    tinyPlaceholder?: string
  ) => {
    if (!storagePath) return;

    const cacheKey = storagePath;
    
    // Reset state
    setUrls({});
    setCurrentQuality('tiny');
    setLoadingQuality(null);

    // Check cache first
    const cached = memoryCache[cacheKey];
    if (cached && (Date.now() - cached.cached_at) < CACHE_DURATION) {
      setUrls(cached);
      // Set highest available quality
      if (cached.high) setCurrentQuality('high');
      else if (cached.medium) setCurrentQuality('medium');
      else if (cached.low) setCurrentQuality('low');
      return;
    }

    // Start with tiny placeholder for instant feedback
    const initialUrls: ProgressiveMedia = {};
    if (tinyPlaceholder) {
      initialUrls.tiny = tinyPlaceholder;
      setUrls(initialUrls);
    }

    // Progressive loading strategy
    const loadQuality = async (qualityName: 'low' | 'medium' | 'high', qualityValue: number) => {
      const loadKey = `${cacheKey}_${qualityName}`;
      
      if (loadingRef.current[loadKey]) {
        return await loadingRef.current[loadKey];
      }

      setLoadingQuality(qualityName);
      
      const promise = getSecureUrl(storagePath, qualityValue);
      loadingRef.current[loadKey] = promise;
      
      try {
        const url = await promise;
        if (url) {
          setUrls(prev => {
            const updated = { ...prev, [qualityName]: url };
            
            // Update cache
            memoryCache[cacheKey] = {
              ...memoryCache[cacheKey],
              ...updated,
              expires_at: new Date(Date.now() + CACHE_DURATION).toISOString(),
              cached_at: Date.now()
            };
            saveCache();
            
            return updated;
          });
          
          setCurrentQuality(qualityName);
          return url;
        }
      } catch (error) {
        console.error(`Failed to load ${qualityName} quality:`, error);
      } finally {
        setLoadingQuality(null);
        delete loadingRef.current[loadKey];
      }
      
      return null;
    };

    // Load low quality immediately (should be very fast)
    loadQuality('low', 45);
    
    // Load medium quality after short delay
    setTimeout(() => loadQuality('medium', 65), 200);
    
    // Load high quality after longer delay
    setTimeout(() => loadQuality('high', 85), 800);
    
  }, []);

  const enhanceQuality = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // If user stays longer, prioritize higher quality
    timeoutRef.current = setTimeout(() => {
      if (currentQuality === 'low' && urls.medium) {
        setCurrentQuality('medium');
      } else if (currentQuality === 'medium' && urls.high) {
        setCurrentQuality('high');
      }
    }, 1000);
  }, [currentQuality, urls]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const getCurrentUrl = useCallback(() => {
    switch (currentQuality) {
      case 'high': return urls.high || urls.medium || urls.low || urls.tiny;
      case 'medium': return urls.medium || urls.low || urls.tiny;
      case 'low': return urls.low || urls.tiny;
      case 'tiny': return urls.tiny;
      default: return urls.tiny;
    }
  }, [currentQuality, urls]);

  return {
    loadProgressiveMedia,
    enhanceQuality,
    getCurrentUrl,
    currentQuality,
    loadingQuality,
    isLoading: loadingQuality !== null
  };
};