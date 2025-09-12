import { useEffect, useRef, useCallback } from 'react';
import { useAdvancedPreloader } from './useAdvancedPreloader';

interface MediaItem {
  id: string;
  storage_path: string;
  type: 'image' | 'video' | 'audio' | 'gif';
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

  const { preloadImage, preloadMultiResolution } = useAdvancedPreloader();
  const preloadedIndexRef = useRef(0);
  const isPreloadingRef = useRef(false);
  const preloadQueueRef = useRef<MediaItem[]>([]);
  const processQueueTimeoutRef = useRef<NodeJS.Timeout>();

  // Process preload queue with enhanced multi-resolution preloading
  const processPreloadQueue = useCallback(async () => {
    if (isPreloadingRef.current || preloadQueueRef.current.length === 0) {
      return;
    }

    isPreloadingRef.current = true;
    const batch = preloadQueueRef.current.splice(0, 3); // Increased to 3 with better handling

    try {
      // Use advanced preloader for better performance
      await Promise.allSettled(
        batch.map(async (item, index) => {
          if (item.type !== 'image') return;
          
          try {
            // Preload multiple resolutions based on position in batch
            if (index === 0) {
              // First item gets full multi-resolution treatment
              await preloadMultiResolution(item.storage_path);
            } else {
              // Others get thumbnail + medium resolution
              await preloadImage(item.storage_path, { width: 300, height: 300, quality: 70 });
              await preloadImage(item.storage_path, { width: 800, quality: 80 });
            }
          } catch (error) {
            console.error('Error preloading item:', item.id, error);
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
  }, [preloadImage, preloadMultiResolution, preloadDelay]);

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
    
    // Add items to queue gradually instead of all at once
    const addGradually = (batch: MediaItem[], index = 0) => {
      if (index >= batch.length) return;
      
      queuePreload([batch[index]]);
      
      // Add next item after a delay
      setTimeout(() => addGradually(batch, index + 1), 300);
    };
    
    addGradually(initialBatch);
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