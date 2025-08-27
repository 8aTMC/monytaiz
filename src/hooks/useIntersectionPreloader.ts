import { useEffect, useRef, useCallback } from 'react';
import { useAdvancedPreloader } from './useAdvancedPreloader';

interface MediaItem {
  id: string;
  storage_path: string;
  type: 'image' | 'video' | 'audio';
}

interface IntersectionPreloaderOptions {
  rootMargin?: string;
  threshold?: number;
  preloadDistance?: number; // How many items ahead to preload
}

export const useIntersectionPreloader = (
  items: MediaItem[],
  options: IntersectionPreloaderOptions = {}
) => {
  const {
    rootMargin = '100px',
    threshold = 0.1,
    preloadDistance = 5
  } = options;

  const { preloadMultiResolution } = useAdvancedPreloader();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const preloadedItemsRef = useRef<Set<string>>(new Set());
  const elementIndexMapRef = useRef<Map<Element, number>>(new Map());

  // Preload items around a given index
  const preloadAroundIndex = useCallback((currentIndex: number) => {
    const startIndex = Math.max(0, currentIndex);
    const endIndex = Math.min(items.length - 1, currentIndex + preloadDistance);

    for (let i = startIndex; i <= endIndex; i++) {
      const item = items[i];
      if (item && item.type === 'image' && !preloadedItemsRef.current.has(item.id)) {
        preloadedItemsRef.current.add(item.id);
        
        // Preload with different priorities based on distance
        const distance = Math.abs(i - currentIndex);
        const priorities = distance === 0 
          ? [{ quality: 85, priority: 'high' as const }] // Current item - full quality
          : distance <= 2 
          ? [{ quality: 80, width: 800, priority: 'medium' as const }] // Close items - medium quality
          : [{ quality: 70, width: 400, priority: 'low' as const }]; // Far items - low quality

        preloadMultiResolution(item.storage_path, priorities).catch(error => {
          console.warn('Failed to preload item:', item.id, error);
        });
      }
    }
  }, [items, preloadDistance, preloadMultiResolution]);

  // Handle intersection changes
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const index = elementIndexMapRef.current.get(entry.target);
        if (index !== undefined) {
          preloadAroundIndex(index);
        }
      }
    });
  }, [preloadAroundIndex]);

  // Initialize intersection observer
  useEffect(() => {
    observerRef.current = new IntersectionObserver(handleIntersection, {
      rootMargin,
      threshold
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [handleIntersection, rootMargin, threshold]);

  // Register an element for intersection observation
  const registerElement = useCallback((element: Element, index: number) => {
    if (observerRef.current && element) {
      elementIndexMapRef.current.set(element, index);
      observerRef.current.observe(element);
    }
  }, []);

  // Unregister an element
  const unregisterElement = useCallback((element: Element) => {
    if (observerRef.current && element) {
      elementIndexMapRef.current.delete(element);
      observerRef.current.unobserve(element);
    }
  }, []);

  // Preload items around a specific item (for navigation)
  const preloadForNavigation = useCallback((currentItemId: string, direction: 'prev' | 'next' | 'both' = 'both') => {
    const currentIndex = items.findIndex(item => item.id === currentItemId);
    if (currentIndex === -1) return;

    const preloadIndices: number[] = [];
    
    if (direction === 'prev' || direction === 'both') {
      // Preload previous items
      for (let i = 1; i <= 3; i++) {
        const prevIndex = currentIndex - i;
        if (prevIndex >= 0) preloadIndices.push(prevIndex);
      }
    }
    
    if (direction === 'next' || direction === 'both') {
      // Preload next items
      for (let i = 1; i <= 3; i++) {
        const nextIndex = currentIndex + i;
        if (nextIndex < items.length) preloadIndices.push(nextIndex);
      }
    }

    preloadIndices.forEach(index => {
      const item = items[index];
      if (item && item.type === 'image' && !preloadedItemsRef.current.has(item.id)) {
        preloadedItemsRef.current.add(item.id);
        preloadMultiResolution(item.storage_path, [
          { quality: 85, priority: 'high' } // Full quality for navigation
        ]).catch(error => {
          console.warn('Failed to preload navigation item:', item.id, error);
        });
      }
    });
  }, [items, preloadMultiResolution]);

  return {
    registerElement,
    unregisterElement,
    preloadForNavigation
  };
};