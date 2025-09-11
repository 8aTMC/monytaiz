import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDirectMedia } from './useDirectMedia';

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
  const [fallbackUrls, setFallbackUrls] = useState<ProgressiveMedia>({});
  const [usingFallback, setUsingFallback] = useState(false);
  const loadingRef = useRef<{ [key: string]: Promise<string | null> }>({});
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { getDirectUrl } = useDirectMedia();

  const getSecureUrl = async (path: string, quality: number): Promise<string | null> => {
    try {
      console.log('🔗 Attempting to get secure URL for path:', path, 'quality:', quality);
      const params = new URLSearchParams({ path, quality: quality.toString() });
      const session = await supabase.auth.getSession();
      
      if (!session.data.session?.access_token) {
        console.error('❌ No auth session available');
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

      console.log('📡 Edge function response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Edge function error:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      console.log('✅ Edge function result:', result);
      
      if (result.error) {
        console.error('❌ Edge function returned error:', result.error);
        return null;
      }
      
      return result.url;
    } catch (error) {
      console.error('❌ Failed to get secure URL:', error);
      return null;
    }
  };

  const loadProgressiveMedia = useCallback(async (
    storagePath: string,
    tinyPlaceholder?: string
  ) => {
    if (!storagePath) {
      console.error('❌ No storage path provided');
      return;
    }

    console.log('🚀 Starting progressive media load for path:', storagePath);
    const cacheKey = storagePath;
    
    // Reset state
    setUrls({});
    setFallbackUrls({});
    setCurrentQuality('tiny');
    setLoadingQuality(null);
    setUsingFallback(false);

    // Generate fallback direct URLs immediately (async)
    const cleanPath = storagePath.replace(/^content\//, '');
    const generateFallbacks = async () => {
      try {
        const fallbacks: ProgressiveMedia = {
          tiny: await getDirectUrl(cleanPath, { quality: 30 }),
          low: await getDirectUrl(cleanPath, { quality: 45 }),  
          medium: await getDirectUrl(cleanPath, { quality: 65 }),
          high: await getDirectUrl(cleanPath, { quality: 85 })
        };
        setFallbackUrls(fallbacks);
        console.log('🔄 Generated fallback URLs:', fallbacks);
        return fallbacks;
      } catch (error) {
        console.error('❌ Failed to generate fallback URLs:', error);
        return {};
      }
    };
    
    const fallbackPromise = generateFallbacks();

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

    // Try progressive loading, fallback to direct URLs if it fails
    try {
      // Load low quality immediately (should be very fast)
      const lowUrl = await loadQuality('low', 45);
      if (!lowUrl) {
        console.log('🔄 Progressive loading failed, waiting for fallback URLs...');
        const fallbacks = await fallbackPromise;
        setUsingFallback(true);
        setUrls(fallbacks);
        setCurrentQuality('low');
      } else {
        // Load medium quality after short delay
        setTimeout(() => loadQuality('medium', 65), 200);
        
        // Load high quality after longer delay
        setTimeout(() => loadQuality('high', 85), 800);
      }
    } catch (error) {
      console.error('❌ Progressive loading completely failed:', error);
      console.log('🔄 Waiting for fallback URLs...');
      const fallbacks = await fallbackPromise;
      setUsingFallback(true);
      setUrls(fallbacks);
      setCurrentQuality('low');
    }
    
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
    const activeUrls = usingFallback ? fallbackUrls : urls;
    let url: string | undefined;
    
    switch (currentQuality) {
      case 'high': url = activeUrls.high || activeUrls.medium || activeUrls.low || activeUrls.tiny; break;
      case 'medium': url = activeUrls.medium || activeUrls.low || activeUrls.tiny; break; 
      case 'low': url = activeUrls.low || activeUrls.tiny; break;
      case 'tiny': url = activeUrls.tiny; break;
      default: url = activeUrls.tiny; break;
    }
    
    // Additional fallback if progressive failed and we don't have fallback URLs
    if (!url && !usingFallback && fallbackUrls.low) {
      console.log('🔄 No progressive URL available, using fallback');
      setUsingFallback(true);
      url = fallbackUrls.low;
    }
    
    console.log('🎯 getCurrentUrl returning:', url, 'quality:', currentQuality, 'usingFallback:', usingFallback);
    return url || null;
  }, [currentQuality, urls, fallbackUrls, usingFallback]);

  return {
    loadProgressiveMedia,
    enhanceQuality,
    getCurrentUrl,
    currentQuality,
    loadingQuality,
    isLoading: loadingQuality !== null,
    usingFallback
  };
};