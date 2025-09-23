// Consolidated Media Cache Manager
// Fixes IndexedDB timeout issues by batching localStorage operations and coordinating caches

interface CachedMediaItem {
  url: string;
  blobUrl?: string;
  expires_at?: string;
  cached_at: number;
  type: 'secure' | 'instant' | 'persistent';
  metadata?: any;
}

interface MediaCacheStats {
  total: number;
  valid: number;
  expired: number;
  storageUsed: number;
  storageQuota: number;
}

class MediaCacheManager {
  private static instance: MediaCacheManager;
  private cache: Map<string, CachedMediaItem> = new Map();
  private writeQueue: Set<string> = new Set();
  private writeTimeout: NodeJS.Timeout | null = null;
  private isWriting = false;
  
  private readonly STORAGE_KEY = 'unified_media_cache';
  private readonly CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours
  private readonly MAX_CACHE_SIZE = 200;
  private readonly WRITE_DEBOUNCE_MS = 500;
  private readonly STORAGE_QUOTA_THRESHOLD = 0.8; // 80% of quota

  private constructor() {
    this.loadFromStorage();
    this.setupCleanup();
  }

  static getInstance(): MediaCacheManager {
    if (!MediaCacheManager.instance) {
      MediaCacheManager.instance = new MediaCacheManager();
    }
    return MediaCacheManager.instance;
  }

  private async loadFromStorage(): Promise<void> {
    try {
      // Check storage quota first
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 0;
        
        if (quota > 0 && usage / quota > this.STORAGE_QUOTA_THRESHOLD) {
          console.warn('Storage quota near limit, clearing cache');
          this.clearCache();
          return;
        }
      }

      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored);
      const now = Date.now();
      
      Object.entries(parsed).forEach(([key, value]: [string, any]) => {
        if (value.cached_at && (now - value.cached_at) < this.CACHE_DURATION) {
          this.cache.set(key, value);
        }
      });
    } catch (error) {
      console.warn('Failed to load unified media cache:', error);
      // Clear corrupted cache
      try {
        localStorage.removeItem(this.STORAGE_KEY);
      } catch (e) {
        // Ignore
      }
    }
  }

  private setupCleanup(): void {
    // Clean up blob URLs on page unload
    window.addEventListener('beforeunload', () => {
      this.cache.forEach((item) => {
        if (item.blobUrl && item.blobUrl.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(item.blobUrl);
          } catch (e) {
            // Ignore
          }
        }
      });
    });

    // Periodic cleanup every 30 minutes
    setInterval(() => {
      this.cleanExpired();
    }, 30 * 60 * 1000);
  }

  private createCacheKey(path: string, transforms?: any, type: string = 'default'): string {
    const normalizedPath = path.replace(/^content\//, '');
    return `${type}_${normalizedPath}_${JSON.stringify(transforms || {})}`;
  }

  get(path: string, transforms?: any, type: string = 'default'): CachedMediaItem | null {
    const key = this.createCacheKey(path, transforms, type);
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    const now = Date.now();
    if ((now - item.cached_at) > this.CACHE_DURATION) {
      this.cache.delete(key);
      this.scheduleWrite();
      return null;
    }
    
    return item;
  }

  set(
    path: string, 
    data: Omit<CachedMediaItem, 'cached_at'>, 
    transforms?: any, 
    type: string = 'default'
  ): void {
    const key = this.createCacheKey(path, transforms, type);
    
    this.cache.set(key, {
      ...data,
      cached_at: Date.now()
    });
    
    this.writeQueue.add(key);
    this.scheduleWrite();
  }

  private scheduleWrite(): void {
    if (this.writeTimeout) {
      clearTimeout(this.writeTimeout);
    }

    this.writeTimeout = setTimeout(() => {
      this.debouncedWrite();
    }, this.WRITE_DEBOUNCE_MS);
  }

  private debouncedWrite(): void {
    if (this.isWriting) return;
    
    // Use requestIdleCallback for non-critical writes
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => this.performWrite(), { timeout: 2000 });
    } else {
      setTimeout(() => this.performWrite(), 10);
    }
  }

  private async performWrite(): Promise<void> {
    if (this.isWriting) return;
    
    this.isWriting = true;
    
    try {
      // Check storage quota before writing
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 0;
        
        if (quota > 0 && usage / quota > this.STORAGE_QUOTA_THRESHOLD) {
          this.cleanExpired();
          this.limitCacheSize();
        }
      }

      // Prepare data for storage (excluding blob URLs)
      const cacheForStorage: { [key: string]: any } = {};
      
      this.cache.forEach((value, key) => {
        const storageItem = { ...value };
        // Don't store blob URLs in localStorage - they're not serializable
        if (storageItem.blobUrl && storageItem.blobUrl.startsWith('blob:')) {
          delete storageItem.blobUrl;
        }
        cacheForStorage[key] = storageItem;
      });

      // Batch write to localStorage
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cacheForStorage));
      this.writeQueue.clear();
      
    } catch (error) {
      console.warn('Failed to write unified cache to storage:', error);
      
      // If storage is full, clear some cache
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        this.limitCacheSize(Math.floor(this.MAX_CACHE_SIZE / 2));
      }
    } finally {
      this.isWriting = false;
    }
  }

  private cleanExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    this.cache.forEach((item, key) => {
      if ((now - item.cached_at) > this.CACHE_DURATION) {
        expiredKeys.push(key);
        
        // Clean up blob URLs
        if (item.blobUrl && item.blobUrl.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(item.blobUrl);
          } catch (e) {
            // Ignore
          }
        }
      }
    });
    
    expiredKeys.forEach(key => this.cache.delete(key));
    
    if (expiredKeys.length > 0) {
      this.scheduleWrite();
    }
  }

  private limitCacheSize(maxSize: number = this.MAX_CACHE_SIZE): void {
    if (this.cache.size <= maxSize) return;
    
    // Sort by last accessed time (cached_at) and remove oldest
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].cached_at - b[1].cached_at);
    
    const toRemove = entries.slice(0, this.cache.size - maxSize);
    
    toRemove.forEach(([key, item]) => {
      this.cache.delete(key);
      
      // Clean up blob URLs
      if (item.blobUrl && item.blobUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(item.blobUrl);
        } catch (e) {
          // Ignore
        }
      }
    });
  }

  clearCache(): void {
    this.cache.forEach((item) => {
      if (item.blobUrl && item.blobUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(item.blobUrl);
        } catch (e) {
          // Ignore
        }
      }
    });
    
    this.cache.clear();
    this.writeQueue.clear();
    
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (e) {
      // Ignore
    }
  }

  async getStats(): Promise<MediaCacheStats> {
    const now = Date.now();
    let valid = 0;
    let expired = 0;
    
    this.cache.forEach((item) => {
      if ((now - item.cached_at) > this.CACHE_DURATION) {
        expired++;
      } else {
        valid++;
      }
    });

    let storageUsed = 0;
    let storageQuota = 0;
    
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        storageUsed = estimate.usage || 0;
        storageQuota = estimate.quota || 0;
      } catch (e) {
        // Ignore
      }
    }

    return {
      total: this.cache.size,
      valid,
      expired,
      storageUsed,
      storageQuota
    };
  }
}

// Export the singleton instance
export const mediaCache = MediaCacheManager.getInstance();

// Helper function for components
export const createMediaCacheKey = (path: string, transforms?: any, type?: string): string => {
  const normalizedPath = path.replace(/^content\//, '');
  return `${type || 'default'}_${normalizedPath}_${JSON.stringify(transforms || {})}`;
};