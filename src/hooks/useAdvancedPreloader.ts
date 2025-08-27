import { useCallback, useRef } from 'react';
import { useSecureMedia } from './useSecureMedia';

interface PreloadOptions {
  quality?: number;
  width?: number;
  height?: number;
  priority?: 'low' | 'medium' | 'high';
}

interface PreloadItem {
  path: string;
  options?: PreloadOptions;
  resolve: (url: string) => void;
  reject: (error: Error) => void;
}

// Global cache that persists across component re-renders - enhanced for better persistence
const globalUrlCache = new Map<string, string>();
const globalPreloadCache = new Map<string, Promise<string>>();

// Enhanced cache persistence
const getCacheStats = () => {
  console.log('Cache stats:', {
    urlCache: globalUrlCache.size,
    promiseCache: globalPreloadCache.size,
    urls: Array.from(globalUrlCache.keys()).slice(0, 5) // Show first 5 keys
  });
};

export const useAdvancedPreloader = () => {
  const { getSecureUrl } = useSecureMedia();
  const queueRef = useRef<PreloadItem[]>([]);
  const processingRef = useRef(false);

  // Create cache key for preload options
  const getCacheKey = (path: string, options?: PreloadOptions) => {
    if (!options) return path;
    const { quality = 85, width, height } = options;
    return `${path}:${width || 'auto'}x${height || 'auto'}q${quality}`;
  };

  // Process preload queue with MAXIMUM speed and instant browser caching
  const processQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) return;
    
    processingRef.current = true;
    const batch = queueRef.current.splice(0, 15); // MASSIVE batch processing

    // Sort by priority (high -> medium -> low)
    batch.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.options?.priority || 'medium'] - priorityOrder[a.options?.priority || 'medium'];
    });

    await Promise.allSettled(
      batch.map(async (item) => {
        try {
          const transforms = item.options ? {
            quality: item.options.quality,
            width: item.options.width,
            height: item.options.height
          } : undefined;

          const cacheKey = getCacheKey(item.path, item.options);

          const url = await getSecureUrl(item.path, transforms);
          if (url) {
            // Store in global cache IMMEDIATELY
            globalUrlCache.set(cacheKey, url);
            
            // CRITICAL: Force immediate browser cache with fetch + cache headers
            try {
              const response = await fetch(url, { 
                cache: 'force-cache',
                mode: 'no-cors' 
              });
              console.log(`💾 BROWSER-CACHED: ${cacheKey}`);
            } catch (e) {
              // Fallback to Image constructor if fetch fails
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.src = url;
              console.log(`🖼️ IMG-CACHED: ${cacheKey}`);
            }
            
            item.resolve(url);
          } else {
            console.error('❌ No URL for:', item.path);
            item.reject(new Error('No secure URL returned'));
          }
        } catch (error) {
          console.error('❌ Preload error:', error);
          item.reject(error as Error);
        }
      })
    );

    processingRef.current = false;
    
    // Continue processing IMMEDIATELY
    if (queueRef.current.length > 0) {
      setTimeout(processQueue, 5); // SUPER fast processing
    }
  }, [getSecureUrl]);

  // Preload single image with caching
  const preloadImage = useCallback((path: string, options?: PreloadOptions): Promise<string> => {
    const cacheKey = getCacheKey(path, options);
    console.log('preloadImage called for:', cacheKey);
    
    // Check global cache first for instant return
    if (globalUrlCache.has(cacheKey)) {
      const cachedUrl = globalUrlCache.get(cacheKey)!;
      console.log('Returning cached URL immediately:', cacheKey);
      return Promise.resolve(cachedUrl);
    }
    
    // Return cached promise if exists
    if (globalPreloadCache.has(cacheKey)) {
      console.log('Returning cached promise:', cacheKey);
      return globalPreloadCache.get(cacheKey)!;
    }

    // Create new promise and cache it
    console.log('Creating new preload promise:', cacheKey);
    const promise = new Promise<string>((resolve, reject) => {
      queueRef.current.push({ path, options, resolve, reject });
      setTimeout(processQueue, 0);
    });

    globalPreloadCache.set(cacheKey, promise);
    return promise;
  }, [processQueue]);

  // Preload multiple images with different resolutions
  const preloadMultiResolution = useCallback(async (path: string, priorities: PreloadOptions[] = []) => {
    const defaultResolutions: PreloadOptions[] = [
      { quality: 70, width: 300, height: 300, priority: 'low' },    // Thumbnail
      { quality: 80, width: 800, priority: 'medium' },             // Medium preview  
      { quality: 85, priority: 'high' }                            // Full resolution
    ];

    const resolutions = priorities.length > 0 ? priorities : defaultResolutions;
    
    return Promise.allSettled(
      resolutions.map(options => preloadImage(path, options))
    );
  }, [preloadImage]);

  // Get cached URL if available (synchronous) with enhanced logging
  const getCachedUrl = useCallback((path: string, options?: PreloadOptions): string | null => {
    const cacheKey = getCacheKey(path, options);
    const cachedUrl = globalUrlCache.get(cacheKey);
    
    if (cachedUrl) {
      console.log('🚀 INSTANT: Found cached URL for', cacheKey);
      return cachedUrl;
    }
    
    console.log('⏳ CACHE MISS: No cached URL for', cacheKey);
    getCacheStats();
    return null;
  }, []);

  return {
    preloadImage,
    preloadMultiResolution,
    getCachedUrl
  };
};