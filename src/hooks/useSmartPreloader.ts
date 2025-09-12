import { useEffect, useRef, useCallback, useState } from 'react';
import { useMediaPreloader } from './useMediaPreloader';
import { useIntersectionPreloader } from './useIntersectionPreloader';
import { useAdvancedPreloader } from './useAdvancedPreloader';
import { usePersistentMediaCache } from './usePersistentMediaCache';


interface MediaItem {
  id: string;
  storage_path: string;
  type: 'image' | 'video' | 'audio' | 'gif';
  size?: number;
  priority?: 'high' | 'medium' | 'low';
  lastViewed?: Date;
  viewCount?: number;
}

interface UserBehaviorPattern {
  averageViewTime: number;
  preferredTimeOfDay: number[];
  commonSequences: string[][];
  scrollSpeed: number;
  deviceType: 'mobile' | 'tablet' | 'desktop';
}

interface SmartPreloadConfig {
  maxConcurrentPreloads: number;
  networkAwarePreloading: boolean;
  behaviorBasedPreloading: boolean;
  predictivePreloading: boolean;
  maxCacheSize: number; // MB
  preloadDistance: number;
}

const DEFAULT_CONFIG: SmartPreloadConfig = {
  maxConcurrentPreloads: 3,
  networkAwarePreloading: true,
  behaviorBasedPreloading: true,
  predictivePreloading: true,
  maxCacheSize: 100, // 100MB
  preloadDistance: 10
};

export const useSmartPreloader = (
  items: MediaItem[],
  config: Partial<SmartPreloadConfig> = {}
) => {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const { getSecureMediaUrl } = usePersistentMediaCache();
  const { preloadMultiResolution } = useAdvancedPreloader();
  
  const [behaviorPattern, setBehaviorPattern] = useState<UserBehaviorPattern>({
    averageViewTime: 5000,
    preferredTimeOfDay: [9, 12, 15, 18, 21],
    commonSequences: [],
    scrollSpeed: 1,
    deviceType: 'desktop'
  });

  const [preloadQueue, setPreloadQueue] = useState<Map<string, { priority: number; timestamp: Date }>>(new Map());
  const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0, size: 0 });
  
  const viewHistoryRef = useRef<Array<{ itemId: string; timestamp: Date; duration: number }>>([]);
  const sequencePatternsRef = useRef<Map<string, string[]>>(new Map());
  const preloadingItemsRef = useRef<Set<string>>(new Set());
  
  // Analyze user behavior patterns
  const analyzeUserBehavior = useCallback(() => {
    const history = viewHistoryRef.current;
    if (history.length < 5) return;

    // Calculate average view time
    const avgViewTime = history.reduce((sum, item) => sum + item.duration, 0) / history.length;
    
    // Detect time patterns
    const timeOfDay = history.map(item => item.timestamp.getHours());
    const timeFrequency = timeOfDay.reduce((acc, hour) => {
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    const preferredTimes = Object.entries(timeFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([hour]) => parseInt(hour));

    // Detect sequence patterns
    const sequences: string[][] = [];
    for (let i = 0; i < history.length - 2; i++) {
      const sequence = history.slice(i, i + 3).map(item => item.itemId);
      sequences.push(sequence);
    }

    setBehaviorPattern(prev => ({
      ...prev,
      averageViewTime: avgViewTime,
      preferredTimeOfDay: preferredTimes,
      commonSequences: sequences
    }));
  }, []);

  // Calculate preload priority based on multiple factors
  const calculatePreloadPriority = useCallback((item: MediaItem, index: number): number => {
    let priority = 0;
    
    // Distance-based priority (closer = higher)
    priority += Math.max(0, 100 - index * 2);
    
    // Simple priority without network awareness
    priority *= 1.0; // Default multiplier
    
    // Behavior-based adjustments
    if (fullConfig.behaviorBasedPreloading && item.viewCount) {
      priority += Math.min(50, item.viewCount * 5);
    }
    
    // Time-based adjustments
    if (item.lastViewed) {
      const daysSinceViewed = (Date.now() - item.lastViewed.getTime()) / (1000 * 60 * 60 * 24);
      priority += Math.max(0, 30 - daysSinceViewed * 3);
    }
    
    // File size penalty for large files
    if (item.size) {
      const sizeMB = item.size / (1024 * 1024);
      priority -= sizeMB * 2; // Reduced penalty
    }
    
    return Math.max(0, priority);
  }, [fullConfig, behaviorPattern]);

  // Predict next likely items based on sequences
  const predictNextItems = useCallback((currentItemId: string): string[] => {
    if (!fullConfig.predictivePreloading) return [];
    
    const predictions: string[] = [];
    const sequences = behaviorPattern.commonSequences;
    
    for (const sequence of sequences) {
      const currentIndex = sequence.indexOf(currentItemId);
      if (currentIndex !== -1 && currentIndex < sequence.length - 1) {
        predictions.push(sequence[currentIndex + 1]);
      }
    }
    
    // Remove duplicates and limit predictions
    return [...new Set(predictions)].slice(0, 3);
  }, [fullConfig.predictivePreloading, behaviorPattern]);

  // Smart preload based on priority queue
  const smartPreload = useCallback(async (visibleItemIndex: number, currentItemId?: string) => {
    if (preloadingItemsRef.current.size >= fullConfig.maxConcurrentPreloads) {
      return;
    }

    // Calculate priorities for upcoming items
    const itemsToConsider = items.slice(
      Math.max(0, visibleItemIndex - 2),
      Math.min(items.length, visibleItemIndex + fullConfig.preloadDistance)
    );

    // Add predicted items if we have a current item
    if (currentItemId) {
      const predicted = predictNextItems(currentItemId);
      const predictedItems = items.filter(item => predicted.includes(item.id));
      itemsToConsider.push(...predictedItems);
    }

    // Sort by priority
    const prioritizedItems = itemsToConsider
      .map((item, index) => ({
        item,
        priority: calculatePreloadPriority(item, index + visibleItemIndex)
      }))
      .sort((a, b) => b.priority - a.priority)
      .filter(({ item }) => !preloadingItemsRef.current.has(item.id))
      .slice(0, fullConfig.maxConcurrentPreloads);

    // Preload highest priority items
    for (const { item } of prioritizedItems) {
      if (preloadingItemsRef.current.size >= fullConfig.maxConcurrentPreloads) break;
      
      preloadingItemsRef.current.add(item.id);
      
      try {
        if (item.type === 'image') {
          // Use advanced preloader for images
          await preloadMultiResolution(item.storage_path, [
            { quality: 70, width: 400, priority: 'low' },
            { quality: 85, priority: 'medium' }
          ]);
        } else {
          // For videos/audio, just get the URL to cache it
          await getSecureMediaUrl(item.storage_path);
        }
        
        setCacheStats(prev => ({ ...prev, hits: prev.hits + 1 }));
      } catch (error) {
        console.warn('Smart preload failed for item:', item.id, error);
        setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
      } finally {
        preloadingItemsRef.current.delete(item.id);
      }
    }
  }, [
    items,
    fullConfig,
    calculatePreloadPriority,
    predictNextItems,
    preloadMultiResolution,
    getSecureMediaUrl
  ]);

  // Track viewing behavior
  const trackView = useCallback((itemId: string, duration: number) => {
    const viewRecord = {
      itemId,
      timestamp: new Date(),
      duration
    };
    
    viewHistoryRef.current.push(viewRecord);
    
    // Keep only last 100 views
    if (viewHistoryRef.current.length > 100) {
      viewHistoryRef.current = viewHistoryRef.current.slice(-100);
    }
    
    // Update item statistics
    const item = items.find(i => i.id === itemId);
    if (item) {
      item.viewCount = (item.viewCount || 0) + 1;
      item.lastViewed = new Date();
    }
    
    // Trigger behavior analysis every 10 views
    if (viewHistoryRef.current.length % 10 === 0) {
      analyzeUserBehavior();
    }
  }, [items, analyzeUserBehavior]);

  // Cleanup old cache entries based on usage patterns
  const optimizeCache = useCallback(() => {
    // This would integrate with the persistent cache to remove least used items
    console.log('Optimizing cache based on usage patterns');
  }, []);

  // Adaptive preloading based on scroll behavior
  const adaptivePreload = useCallback((scrollPosition: number, scrollVelocity: number) => {
    const currentIndex = Math.floor(scrollPosition / 200); // Assume 200px per item
    
    // Adjust preload distance based on scroll velocity
    let dynamicDistance = fullConfig.preloadDistance;
    if (scrollVelocity > 1000) {
      dynamicDistance *= 1.5; // Preload more when scrolling fast
    } else if (scrollVelocity < 100) {
      dynamicDistance *= 0.7; // Preload less when scrolling slowly
    }
    
    smartPreload(currentIndex);
  }, [fullConfig.preloadDistance, smartPreload]);

  // Initialize behavior pattern detection
  useEffect(() => {
    // Detect device type
    const isMobile = window.innerWidth <= 768;
    const isTablet = window.innerWidth <= 1024 && window.innerWidth > 768;
    
    setBehaviorPattern(prev => ({
      ...prev,
      deviceType: isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'
    }));
  }, []);

  // Periodic cache optimization
  useEffect(() => {
    const interval = setInterval(optimizeCache, 300000); // Every 5 minutes
    return () => clearInterval(interval);
  }, [optimizeCache]);

  return {
    smartPreload,
    trackView,
    adaptivePreload,
    behaviorPattern,
    cacheStats,
    preloadQueue: Array.from(preloadQueue.entries()),
    isPreloading: preloadingItemsRef.current.size > 0,
    optimizeCache
  };
};
