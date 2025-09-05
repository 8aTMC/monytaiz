import { useCallback, useRef, useEffect } from 'react';
import { usePersistentMediaCache } from './usePersistentMediaCache';
import { useNetworkMonitor } from './useNetworkMonitor';

interface CacheEntry {
  id: string;
  path: string;
  lastAccessed: Date;
  accessCount: number;
  size: number;
  priority: number;
  type: 'image' | 'video' | 'audio';
}

interface PredictionModel {
  itemTransitions: Map<string, Map<string, number>>; // item -> next item -> frequency
  timePatterns: Map<number, string[]>; // hour -> frequently accessed items
  sequencePatterns: Map<string, string[]>; // sequence -> likely next items
}

interface CacheMetrics {
  hitRate: number;
  missRate: number;
  evictionRate: number;
  avgFetchTime: number;
  totalSize: number;
  predictiveHits: number;
}

export const usePredictiveCache = (maxCacheSize: number = 50 * 1024 * 1024) => { // 50MB default
  const { getSecureMediaUrl, getCachedMediaUrl, clearCache } = usePersistentMediaCache();
  const { networkStatus } = useNetworkMonitor();
  
  const cacheEntriesRef = useRef<Map<string, CacheEntry>>(new Map());
  const predictionModelRef = useRef<PredictionModel>({
    itemTransitions: new Map(),
    timePatterns: new Map(),
    sequencePatterns: new Map()
  });
  
  const metricsRef = useRef<CacheMetrics>({
    hitRate: 0,
    missRate: 0,
    evictionRate: 0,
    avgFetchTime: 0,
    totalSize: 0,
    predictiveHits: 0
  });
  
  const accessHistoryRef = useRef<Array<{ itemId: string; timestamp: Date }>>([]);
  const fetchTimesRef = useRef<number[]>([]);

  // Update prediction model based on access patterns
  const updatePredictionModel = useCallback((currentItemId: string, previousItemId?: string) => {
    const model = predictionModelRef.current;
    const currentHour = new Date().getHours();
    
    // Update item transitions
    if (previousItemId) {
      if (!model.itemTransitions.has(previousItemId)) {
        model.itemTransitions.set(previousItemId, new Map());
      }
      const transitions = model.itemTransitions.get(previousItemId)!;
      transitions.set(currentItemId, (transitions.get(currentItemId) || 0) + 1);
    }
    
    // Update time patterns
    if (!model.timePatterns.has(currentHour)) {
      model.timePatterns.set(currentHour, []);
    }
    const hourlyItems = model.timePatterns.get(currentHour)!;
    if (!hourlyItems.includes(currentItemId)) {
      hourlyItems.push(currentItemId);
      // Keep only top 10 items per hour
      if (hourlyItems.length > 10) {
        hourlyItems.shift();
      }
    }
    
    // Track access history for sequence patterns
    accessHistoryRef.current.push({ itemId: currentItemId, timestamp: new Date() });
    if (accessHistoryRef.current.length > 50) {
      accessHistoryRef.current = accessHistoryRef.current.slice(-50);
    }
    
    // Update sequence patterns (every 5 accesses)
    if (accessHistoryRef.current.length >= 3 && accessHistoryRef.current.length % 5 === 0) {
      const recent = accessHistoryRef.current.slice(-3).map(item => item.itemId);
      const sequenceKey = recent.slice(0, 2).join('-');
      const nextItem = recent[2];
      
      if (!model.sequencePatterns.has(sequenceKey)) {
        model.sequencePatterns.set(sequenceKey, []);
      }
      const sequence = model.sequencePatterns.get(sequenceKey)!;
      if (!sequence.includes(nextItem)) {
        sequence.push(nextItem);
      }
    }
  }, []);

  // Predict likely next items
  const predictNextItems = useCallback((currentItemId: string, count: number = 3): string[] => {
    const model = predictionModelRef.current;
    const predictions = new Set<string>();
    
    // Predictions based on item transitions
    const transitions = model.itemTransitions.get(currentItemId);
    if (transitions) {
      const sortedTransitions = Array.from(transitions.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, count);
      sortedTransitions.forEach(([itemId]) => predictions.add(itemId));
    }
    
    // Predictions based on time patterns
    const currentHour = new Date().getHours();
    const hourlyItems = model.timePatterns.get(currentHour) || [];
    hourlyItems.slice(0, count).forEach(itemId => predictions.add(itemId));
    
    // Predictions based on sequence patterns
    const recentItems = accessHistoryRef.current.slice(-2).map(item => item.itemId);
    if (recentItems.length >= 2) {
      const sequenceKey = recentItems.join('-');
      const sequencePredictions = model.sequencePatterns.get(sequenceKey) || [];
      sequencePredictions.slice(0, count).forEach(itemId => predictions.add(itemId));
    }
    
    return Array.from(predictions).slice(0, count);
  }, []);

  // Calculate cache priority based on multiple factors
  const calculateCachePriority = useCallback((entry: CacheEntry): number => {
    const now = Date.now();
    const timeSinceAccess = now - entry.lastAccessed.getTime();
    const hoursSinceAccess = timeSinceAccess / (1000 * 60 * 60);
    
    let priority = 0;
    
    // Access frequency (higher = better)
    priority += entry.accessCount * 10;
    
    // Recency bonus (more recent = better)
    priority += Math.max(0, 100 - hoursSinceAccess * 5);
    
    // Size penalty (smaller = better for retention)
    const sizeMB = entry.size / (1024 * 1024);
    priority -= sizeMB * 2;
    
    // Network-aware adjustments
    if (networkStatus.speed === 'slow' || networkStatus.speed === 'very-slow') {
      priority += 20; // Keep more items cached on slow networks
    }
    
    // Type-based priority (images > videos > audio for quick access)
    const typePriority = { image: 10, video: 5, audio: 3 };
    priority += typePriority[entry.type] || 0;
    
    return priority;
  }, [networkStatus]);

  // Intelligent cache eviction
  const evictLeastValuable = useCallback((targetSize: number): string[] => {
    const entries = Array.from(cacheEntriesRef.current.values());
    
    // Sort by priority (lowest first for eviction)
    entries.sort((a, b) => calculateCachePriority(a) - calculateCachePriority(b));
    
    const evicted: string[] = [];
    let currentSize = metricsRef.current.totalSize;
    
    for (const entry of entries) {
      if (currentSize <= targetSize) break;
      
      evicted.push(entry.id);
      currentSize -= entry.size;
      cacheEntriesRef.current.delete(entry.id);
    }
    
    metricsRef.current.totalSize = currentSize;
    metricsRef.current.evictionRate = evicted.length / entries.length;
    
    return evicted;
  }, [calculateCachePriority]);

  // Predictive preloading
  const predictivePreload = useCallback(async (currentItemId: string, itemPaths: Map<string, string>) => {
    const predictions = predictNextItems(currentItemId, 3);
    
    for (const predictedId of predictions) {
      const path = itemPaths.get(predictedId);
      if (!path) continue;
      
      // Check if already cached
      if (getCachedMediaUrl(path)) {
        metricsRef.current.predictiveHits++;
        continue;
      }
      
      // Check cache capacity
      if (metricsRef.current.totalSize > maxCacheSize * 0.8) {
        evictLeastValuable(maxCacheSize * 0.6);
      }
      
      try {
        const startTime = performance.now();
        await getSecureMediaUrl(path);
        const fetchTime = performance.now() - startTime;
        
        fetchTimesRef.current.push(fetchTime);
        if (fetchTimesRef.current.length > 100) {
          fetchTimesRef.current = fetchTimesRef.current.slice(-100);
        }
        
        // Update cache entry
        cacheEntriesRef.current.set(predictedId, {
          id: predictedId,
          path,
          lastAccessed: new Date(),
          accessCount: 0,
          size: 1024, // Estimated size
          priority: 0,
          type: 'image' // Default type
        });
        
      } catch (error) {
        console.warn('Predictive preload failed for:', predictedId, error);
      }
    }
  }, [predictNextItems, getCachedMediaUrl, getSecureMediaUrl, evictLeastValuable, maxCacheSize]);

  // Track item access for metrics and model updates
  const trackAccess = useCallback((itemId: string, path: string, previousItemId?: string, itemType: 'image' | 'video' | 'audio' = 'image', size: number = 1024) => {
    // Update prediction model
    updatePredictionModel(itemId, previousItemId);
    
    // Update cache entry
    const existing = cacheEntriesRef.current.get(itemId);
    if (existing) {
      existing.lastAccessed = new Date();
      existing.accessCount++;
      existing.priority = calculateCachePriority(existing);
    } else {
      cacheEntriesRef.current.set(itemId, {
        id: itemId,
        path,
        lastAccessed: new Date(),
        accessCount: 1,
        size,
        priority: 0,
        type: itemType
      });
    }
    
    // Update metrics
    const isCached = !!getCachedMediaUrl(path);
    if (isCached) {
      metricsRef.current.hitRate = (metricsRef.current.hitRate + 1) / 2;
    } else {
      metricsRef.current.missRate = (metricsRef.current.missRate + 1) / 2;
    }
    
    // Update average fetch time
    if (fetchTimesRef.current.length > 0) {
      const avg = fetchTimesRef.current.reduce((sum, time) => sum + time, 0) / fetchTimesRef.current.length;
      metricsRef.current.avgFetchTime = avg;
    }
  }, [updatePredictionModel, calculateCachePriority, getCachedMediaUrl]);

  // Get cache statistics
  const getCacheStats = useCallback(() => ({
    ...metricsRef.current,
    entryCount: cacheEntriesRef.current.size,
    predictionAccuracy: metricsRef.current.predictiveHits / Math.max(1, accessHistoryRef.current.length),
    modelStats: {
      transitionCount: predictionModelRef.current.itemTransitions.size,
      timePatternCount: predictionModelRef.current.timePatterns.size,
      sequencePatternCount: predictionModelRef.current.sequencePatterns.size
    }
  }), []);

  // Periodic cache maintenance
  useEffect(() => {
    const interval = setInterval(() => {
      // Clean up old entries and optimize cache
      if (metricsRef.current.totalSize > maxCacheSize) {
        evictLeastValuable(maxCacheSize * 0.8);
      }
      
      // Clean old access history
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      accessHistoryRef.current = accessHistoryRef.current.filter(
        item => item.timestamp.getTime() > oneHourAgo
      );
    }, 60000); // Every minute
    
    return () => clearInterval(interval);
  }, [maxCacheSize, evictLeastValuable]);

  return {
    predictivePreload,
    trackAccess,
    predictNextItems,
    getCacheStats,
    evictLeastValuable,
    clearCache: () => {
      cacheEntriesRef.current.clear();
      clearCache();
    }
  };
};
