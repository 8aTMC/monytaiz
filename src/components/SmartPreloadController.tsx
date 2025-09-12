import React, { useEffect, useCallback, useRef } from 'react';
import { useSmartPreloader } from '../hooks/useSmartPreloader';
import { usePredictiveCache } from '../hooks/usePredictiveCache';
import { useUserBehaviorTracker } from '../hooks/useUserBehaviorTracker';
import { useIntersectionPreloader } from '../hooks/useIntersectionPreloader';

interface MediaItem {
  id: string;
  storage_path: string;
  type: 'image' | 'video' | 'audio' | 'gif';
  size?: number;
  priority?: 'high' | 'medium' | 'low';
  lastViewed?: Date;
  viewCount?: number;
}

interface SmartPreloadControllerProps {
  items: MediaItem[];
  currentItemId?: string;
  onPreloadProgress?: (loaded: number, total: number) => void;
  onCacheOptimized?: () => void;
  enabled?: boolean;
  maxCacheSize?: number;
  children: React.ReactNode;
}

export const SmartPreloadController: React.FC<SmartPreloadControllerProps> = ({
  items,
  currentItemId,
  onPreloadProgress,
  onCacheOptimized,
  enabled = true,
  maxCacheSize = 50 * 1024 * 1024, // 50MB
  children
}) => {
  const {
    smartPreload,
    trackView,
    adaptivePreload,
    behaviorPattern,
    cacheStats,
    isPreloading
  } = useSmartPreloader(items);

  const {
    predictivePreload,
    trackAccess,
    predictNextItems,
    getCacheStats
  } = usePredictiveCache(maxCacheSize);

  const {
    trackView: trackBehaviorView,
    trackInteraction,
    trackScroll,
    predictInterest,
    getBehaviorInsights
  } = useUserBehaviorTracker();

  const {
    registerElement,
    unregisterElement,
    preloadForNavigation
  } = useIntersectionPreloader(items);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const visibleItemsRef = useRef<Set<string>>(new Set());
  const scrollPositionRef = useRef(0);
  const scrollVelocityRef = useRef(0);
  const lastScrollTimeRef = useRef(Date.now());
  const itemPathMapRef = useRef<Map<string, string>>(new Map());
  const viewTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Update item path mapping
  useEffect(() => {
    const pathMap = new Map<string, string>();
    items.forEach(item => {
      pathMap.set(item.id, item.storage_path);
    });
    itemPathMapRef.current = pathMap;
  }, [items]);

  // Handle scroll events for adaptive preloading
  const handleScroll = useCallback(() => {
    if (!enabled) return;

    const currentTime = Date.now();
    const currentPosition = window.scrollY;
    const timeDelta = currentTime - lastScrollTimeRef.current;
    const positionDelta = currentPosition - scrollPositionRef.current;

    if (timeDelta > 0) {
      const velocity = Math.abs(positionDelta) / timeDelta;
      scrollVelocityRef.current = velocity;
      
      // Track scroll behavior
      trackScroll(currentPosition);
      
      // Trigger adaptive preloading
      adaptivePreload(currentPosition, velocity);
    }

    scrollPositionRef.current = currentPosition;
    lastScrollTimeRef.current = currentTime;
  }, [enabled, trackScroll, adaptivePreload]);

  // Handle item visibility changes
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    if (!enabled) return;

    entries.forEach(entry => {
      const itemId = entry.target.getAttribute('data-item-id');
      if (!itemId) return;

      if (entry.isIntersecting) {
        visibleItemsRef.current.add(itemId);
        
        // Start view tracking timer
        const timer = setTimeout(() => {
          const item = items.find(i => i.id === itemId);
          if (item) {
            trackView(itemId, 3000); // 3 second view
            trackBehaviorView(itemId, 3000, scrollPositionRef.current);
            trackAccess(itemId, item.storage_path, currentItemId, item.type, item.size);
          }
        }, 1000); // Track after 1 second of visibility

        viewTimersRef.current.set(itemId, timer);
        
        // Track interaction
        trackInteraction('scroll', itemId, {
          scrollPosition: scrollPositionRef.current,
          intersectionRatio: entry.intersectionRatio
        });

      } else {
        visibleItemsRef.current.delete(itemId);
        
        // Clear view timer if item goes out of view
        const timer = viewTimersRef.current.get(itemId);
        if (timer) {
          clearTimeout(timer);
          viewTimersRef.current.delete(itemId);
        }
      }
    });

    // Update preloading based on visible items
    if (visibleItemsRef.current.size > 0) {
      const visibleArray = Array.from(visibleItemsRef.current);
      const currentIndex = items.findIndex(item => visibleArray.includes(item.id));
      if (currentIndex !== -1) {
        smartPreload(currentIndex, currentItemId);
      }
    }
  }, [enabled, items, currentItemId, smartPreload, trackView, trackBehaviorView, trackAccess, trackInteraction]);

  // Initialize intersection observer
  useEffect(() => {
    if (!enabled) return;

    observerRef.current = new IntersectionObserver(handleIntersection, {
      rootMargin: '50px',
      threshold: [0.1, 0.5, 1.0]
    });

    // Observe all media elements
    const mediaElements = document.querySelectorAll('[data-item-id]');
    mediaElements.forEach(element => {
      observerRef.current?.observe(element);
    });

    return () => {
      observerRef.current?.disconnect();
      // Clear all view timers
      viewTimersRef.current.forEach(timer => clearTimeout(timer));
      viewTimersRef.current.clear();
    };
  }, [enabled, handleIntersection, items]);

  // Handle scroll events
  useEffect(() => {
    if (!enabled) return;

    let ticking = false;
    const throttledScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', throttledScroll, { passive: true });
    return () => window.removeEventListener('scroll', throttledScroll);
  }, [enabled, handleScroll]);

  // Predictive preloading when current item changes
  useEffect(() => {
    if (!enabled || !currentItemId) return;

    const performPredictivePreload = async () => {
      try {
        await predictivePreload(currentItemId, itemPathMapRef.current);
        
        // Also use intersection-based navigation preloading
        preloadForNavigation(currentItemId, 'both');
        
      } catch (error) {
        console.warn('Predictive preload failed:', error);
      }
    };

    performPredictivePreload();
  }, [enabled, currentItemId, predictivePreload, preloadForNavigation]);

  // Report progress to parent
  useEffect(() => {
    if (onPreloadProgress) {
      const stats = getCacheStats();
      onPreloadProgress(stats.entryCount, items.length);
    }
  }, [onPreloadProgress, getCacheStats, items.length]);

  // Periodic cache optimization
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      // Get user interest predictions
      const predictions = predictInterest(
        items.map(item => ({
          id: item.id,
          type: item.type,
          size: item.size,
          tags: [] // Could add tags if available
        }))
      );

      // Preload high-interest items that aren't cached
      const highInterestItems = predictions
        .filter(p => p.score > 70)
        .slice(0, 3);

      highInterestItems.forEach(prediction => {
        const item = items.find(i => i.id === prediction.itemId);
        if (item) {
          const visibleIndex = items.findIndex(i => i.id === prediction.itemId);
          smartPreload(visibleIndex, currentItemId);
        }
      });

      onCacheOptimized?.();
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [enabled, items, predictInterest, smartPreload, currentItemId, onCacheOptimized]);

  // Provide context for child components
  const contextValue = {
    isPreloading,
    cacheStats,
    behaviorPattern,
    behaviorInsights: getBehaviorInsights(),
    registerElement,
    unregisterElement,
    trackInteraction
  };

  return (
    <div data-smart-preload-controller>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { 
            smartPreloadContext: contextValue 
          } as any);
        }
        return child;
      })}
    </div>
  );
};