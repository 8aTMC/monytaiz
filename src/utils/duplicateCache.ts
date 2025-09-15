// Duplicate detection cache management utility
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

interface DeletedFileEntry {
  filename: string;
  size: number;
  deletedAt: number;
}

class DuplicateCache {
  private cache = new Map<string, CacheEntry>();
  private deletedFiles = new Map<string, DeletedFileEntry>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes
  private readonly deletedFilesTTL = 10 * 60 * 1000; // 10 minutes

  // Generate cache key from file list
  getCacheKey(files: any[]): string {
    const fileSignatures = files
      .filter(f => f.status === 'pending')
      .map(f => `${f.file.name}-${f.file.size}`)
      .sort()
      .join('|');
    return `duplicate-check-${btoa(fileSignatures)}`;
  }

  // Get cached result
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  // Set cache entry
  set(key: string, data: any, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  // Check if a file was recently deleted
  isRecentlyDeleted(filename: string, size: number): boolean {
    const key = `${filename}-${size}`;
    const entry = this.deletedFiles.get(key);
    
    if (!entry) return false;
    
    const now = Date.now();
    if (now > entry.deletedAt + this.deletedFilesTTL) {
      this.deletedFiles.delete(key);
      return false;
    }
    
    return true;
  }

  // Mark files as recently deleted
  markAsDeleted(filenames: string[], sizes: number[]): void {
    const now = Date.now();
    
    for (let i = 0; i < filenames.length; i++) {
      const filename = filenames[i];
      const size = sizes[i] || 0;
      const key = `${filename}-${size}`;
      
      this.deletedFiles.set(key, {
        filename,
        size,
        deletedAt: now
      });
    }
    
    // Also clear any existing cache entries since files were deleted
    this.clearAll();
  }

  // Clear all cache entries
  clearAll(): void {
    this.cache.clear();
  }

  // Clear expired entries (cleanup)
  cleanup(): void {
    const now = Date.now();
    
    // Clean cache
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key);
      }
    }
    
    // Clean deleted files tracking
    for (const [key, entry] of this.deletedFiles.entries()) {
      if (now > entry.deletedAt + this.deletedFilesTTL) {
        this.deletedFiles.delete(key);
      }
    }
  }

  // Get cache stats for debugging
  getStats(): {cacheSize: number, deletedFilesTracked: number} {
    return {
      cacheSize: this.cache.size,
      deletedFilesTracked: this.deletedFiles.size
    };
  }
}

// Export singleton instance
export const duplicateCache = new DuplicateCache();

// Auto-cleanup every 2 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    duplicateCache.cleanup();
  }, 2 * 60 * 1000);
}