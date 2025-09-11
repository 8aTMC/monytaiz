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
      // Clean the path - remove any existing content/ prefix to avoid duplication
      const cleanPath = path.replace(/^content\//, '');
      console.log('🔗 Attempting to get secure URL for clean path:', cleanPath, 'quality:', quality);
      
      const params = new URLSearchParams({ 
        path: cleanPath,
        quality: quality.toString()
      });
      
      const session = await supabase.auth.getSession();
      if (!session.data.session?.access_token) {
        console.error('❌ No auth session available');
        throw new Error('No auth session');
      }

      // Add timeout protection for edge function calls
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(
        `https://alzyzfjzwvofmjccirjq.supabase.co/functions/v1/fast-secure-media?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${session.data.session.access_token}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);
      console.log('📡 Edge function response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Edge function error:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      console.log('✅ Edge function result for quality', quality, ':', !!result.url);
      
      if (result.error) {
        console.error('❌ Edge function returned error:', result.error);
        return null;
      }
      
      return result.url;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('⏰ Secure URL request timed out for path:', path);
        return null;
      }
      console.warn('⚠️ Secure URL generation failed, will use fallback:', error);
      return null;
    }
  };

  const loadProgressiveMedia = useCallback(async (
    storagePath: string,
    tinyPlaceholder?: string,
    mediaType?: string
  ) => {
    if (!storagePath) {
      console.error('❌ No storage path provided');
      return;
    }

    console.log('🚀 Starting progressive media load for path:', storagePath, 'type:', mediaType);
    const cacheKey = storagePath;
    
    // Reset state
    setUrls({});
    setFallbackUrls({});
    setCurrentQuality('tiny');
    setLoadingQuality(null);
    setUsingFallback(false);

    // Check if this is a video - if so, skip progressive loading and use direct URLs
    const isVideo = mediaType === 'video' || 
                   storagePath.includes('.mp4') || 
                   storagePath.includes('.webm') || 
                   storagePath.includes('.mov') ||
                   storagePath.includes('.avi');

    // Clean the path - ensure consistent format without content/ prefix
    const cleanPath = storagePath.replace(/^content\//, '');
    console.log('🧹 Clean storage path:', cleanPath, 'from original:', storagePath);
    
    // For videos, go directly to signed URLs without progressive loading attempts
    if (isVideo) {
      console.log('📹 Video detected, using direct signed URL path');
      setLoadingQuality('high');
      
      try {
        const directUrl = await getDirectUrl(cleanPath);
        if (directUrl) {
          const videoUrls = { high: directUrl };
          setUrls(videoUrls);
          setCurrentQuality('high');
          console.log('✅ Video URL loaded successfully');
        } else {
          console.warn('⚠️ Failed to get direct video URL');
        }
      } catch (error) {
        console.error('❌ Failed to load video:', error);
      } finally {
        setLoadingQuality(null);
      }
      return;
    }

    // For images, use the progressive loading strategy
    const generateFallbacks = async () => {
      try {
        const fallbacks: ProgressiveMedia = {
          tiny: await getDirectUrl(cleanPath, { quality: 30 }),
          low: await getDirectUrl(cleanPath, { quality: 45 }),  
          medium: await getDirectUrl(cleanPath, { quality: 65 }),
          high: await getDirectUrl(cleanPath, { quality: 85 })
        };
        setFallbackUrls(fallbacks);
        console.log('🔄 Generated image fallback URLs');
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
      
      const promise = getSecureUrl(cleanPath, qualityValue);
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

    // Try progressive loading, fallback to direct URLs if transformation fails
    try {
      // Load low quality immediately (should be very fast)
      const lowUrl = await loadQuality('low', 45);
      if (!lowUrl) {
        console.log('🔄 Image transformation unavailable, using direct URLs...');
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
      console.warn('⚠️ Progressive image loading unavailable, using direct URLs');
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