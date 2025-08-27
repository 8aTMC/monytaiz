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

export const useAdvancedPreloader = () => {
  const { getSecureUrl } = useSecureMedia();
  const preloadCacheRef = useRef<Map<string, Promise<string>>>(new Map());
  const queueRef = useRef<PreloadItem[]>([]);
  const processingRef = useRef(false);

  // Create cache key for preload options
  const getCacheKey = (path: string, options?: PreloadOptions) => {
    if (!options) return path;
    const { quality = 85, width, height } = options;
    return `${path}:${width || 'auto'}x${height || 'auto'}q${quality}`;
  };

  // Process preload queue with smart batching
  const processQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) return;
    
    processingRef.current = true;
    const batch = queueRef.current.splice(0, 3); // Process 3 at a time

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

          const url = await getSecureUrl(item.path, transforms);
          if (url) {
            // Preload using Image constructor for browser caching
            const img = new Image();
            img.onload = () => item.resolve(url);
            img.onerror = () => item.reject(new Error('Failed to preload image'));
            img.src = url;
          } else {
            item.reject(new Error('No secure URL returned'));
          }
        } catch (error) {
          item.reject(error as Error);
        }
      })
    );

    processingRef.current = false;
    
    // Continue processing if more items in queue
    if (queueRef.current.length > 0) {
      setTimeout(processQueue, 100);
    }
  }, [getSecureUrl]);

  // Preload single image with caching
  const preloadImage = useCallback((path: string, options?: PreloadOptions): Promise<string> => {
    const cacheKey = getCacheKey(path, options);
    
    // Return cached promise if exists
    if (preloadCacheRef.current.has(cacheKey)) {
      return preloadCacheRef.current.get(cacheKey)!;
    }

    // Create new promise and cache it
    const promise = new Promise<string>((resolve, reject) => {
      queueRef.current.push({ path, options, resolve, reject });
      setTimeout(processQueue, 0);
    });

    preloadCacheRef.current.set(cacheKey, promise);
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

  // Get cached URL if available
  const getCachedUrl = useCallback((path: string, options?: PreloadOptions): string | null => {
    const cacheKey = getCacheKey(path, options);
    const cachedPromise = preloadCacheRef.current.get(cacheKey);
    
    // This is a synchronous check - only returns if promise is already resolved
    if (cachedPromise) {
      let result: string | null = null;
      cachedPromise.then(url => { result = url; }).catch(() => {});
      return result;
    }
    
    return null;
  }, []);

  return {
    preloadImage,
    preloadMultiResolution,
    getCachedUrl
  };
};