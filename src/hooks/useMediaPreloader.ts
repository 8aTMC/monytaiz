import { useEffect, useRef, useCallback } from 'react';
import { useSecureMedia } from './useSecureMedia';

interface MediaItem {
  id: string;
  storage_path: string;
  type: 'image' | 'video' | 'audio';
}

interface PreloaderOptions {
  initialBatchSize?: number;
  scrollBatchSize?: number;
  preloadDelay?: number;
}

export const useMediaPreloader = (
  items: MediaItem[],
  options: PreloaderOptions = {}
) => {
  const {
    initialBatchSize = 50,
    scrollBatchSize = 20,
    preloadDelay = 100
  } = options;

  const { getSecureUrl } = useSecureMedia();
  const preloadedIndexRef = useRef(0);
  const isPreloadingRef = useRef(false);
  const preloadQueueRef = useRef<MediaItem[]>([]);
  const processQueueTimeoutRef = useRef<NodeJS.Timeout>();

  // Process preload queue with delay to avoid overwhelming the server
  const processPreloadQueue = useCallback(async () => {
    if (isPreloadingRef.current || preloadQueueRef.current.length === 0) {
      return;
    }

    isPreloadingRef.current = true;
    const batch = preloadQueueRef.current.splice(0, 5); // Process 5 at a time

    try {
      // Preload batch with different transforms for optimal caching
      await Promise.allSettled(
        batch.map(async (item) => {
          // Preload thumbnail size for grid view
          await getSecureUrl(item.storage_path, { width: 300, height: 300, quality: 80 });
          
          // For images, also preload a medium size for quick preview
          if (item.type === 'image') {
            await getSecureUrl(item.storage_path, { width: 800, height: 800, quality: 85 });
          }
        })
      );
    } catch (error) {
      console.error('Error preloading media batch:', error);
    } finally {
      isPreloadingRef.current = false;
      
      // Continue processing queue if there are more items
      if (preloadQueueRef.current.length > 0) {
        processQueueTimeoutRef.current = setTimeout(processPreloadQueue, preloadDelay);
      }
    }
  }, [getSecureUrl, preloadDelay]);

  // Add items to preload queue
  const queuePreload = useCallback((itemsToQueue: MediaItem[]) => {
    preloadQueueRef.current.push(...itemsToQueue);
    
    // Clear existing timeout and start processing
    if (processQueueTimeoutRef.current) {
      clearTimeout(processQueueTimeoutRef.current);
    }
    processQueueTimeoutRef.current = setTimeout(processPreloadQueue, preloadDelay);
  }, [processPreloadQueue, preloadDelay]);

  // Preload initial batch
  useEffect(() => {
    if (items.length === 0) return;

    const initialBatch = items.slice(0, Math.min(initialBatchSize, items.length));
    preloadedIndexRef.current = initialBatch.length;
    queuePreload(initialBatch);
  }, [items, initialBatchSize, queuePreload]);

  // Preload more items based on scroll position
  const preloadMore = useCallback((visibleIndex: number) => {
    if (items.length === 0) return;

    // If we're getting close to what we've preloaded, load more
    const threshold = 10; // Start preloading when 10 items away from preloaded content
    if (visibleIndex + threshold >= preloadedIndexRef.current) {
      const nextBatchStart = preloadedIndexRef.current;
      const nextBatchEnd = Math.min(nextBatchStart + scrollBatchSize, items.length);
      
      if (nextBatchStart < nextBatchEnd) {
        const nextBatch = items.slice(nextBatchStart, nextBatchEnd);
        preloadedIndexRef.current = nextBatchEnd;
        queuePreload(nextBatch);
      }
    }
  }, [items, scrollBatchSize, queuePreload]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (processQueueTimeoutRef.current) {
        clearTimeout(processQueueTimeoutRef.current);
      }
    };
  }, []);

  return { preloadMore };
};