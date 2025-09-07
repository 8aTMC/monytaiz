import { useState, useEffect, useRef } from 'react';

// Cache for thumbnails to avoid regeneration
const thumbnailCache = new Map<string, string>();

export function useOptimizedThumbnail(file: File) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Create cache key from file properties
    const cacheKey = `${file.name}-${file.size}-${file.lastModified}`;
    
    // Check cache first
    if (thumbnailCache.has(cacheKey)) {
      setThumbnail(thumbnailCache.get(cacheKey)!);
      return;
    }

    // Cleanup previous operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const generateThumbnail = async () => {
      if (abortController.signal.aborted) return;
      
      setIsLoading(true);
      
      try {
        if (file.type.startsWith('image/')) {
          const url = URL.createObjectURL(file);
          if (!abortController.signal.aborted) {
            setThumbnail(url);
            thumbnailCache.set(cacheKey, url);
          }
        } else if (file.type.startsWith('video/')) {
          // Use a more efficient video thumbnail generation
          const thumbnailUrl = await generateVideoThumbnailOptimized(file, abortController.signal);
          if (!abortController.signal.aborted && thumbnailUrl) {
            setThumbnail(thumbnailUrl);
            thumbnailCache.set(cacheKey, thumbnailUrl);
          }
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.warn('Thumbnail generation failed:', error);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    generateThumbnail();

    return () => {
      abortController.abort();
      abortControllerRef.current = null;
    };
  }, [file]);

  return { thumbnail, isLoading };
}

async function generateVideoThumbnailOptimized(file: File, signal: AbortSignal): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      resolve(null);
      return;
    }

    // Set smaller canvas size for better performance
    canvas.width = 120;
    canvas.height = 80;
    
    video.muted = true;
    video.playsInline = true;
    
    const cleanup = () => {
      URL.revokeObjectURL(video.src);
      video.remove();
      canvas.remove();
    };
    
    const onAbort = () => {
      cleanup();
      resolve(null);
    };
    
    if (signal.aborted) {
      resolve(null);
      return;
    }
    
    signal.addEventListener('abort', onAbort);
    
    video.onloadedmetadata = () => {
      if (signal.aborted) return;
      // Seek to a reasonable position (2 seconds or 10% of duration)
      video.currentTime = Math.min(2, video.duration * 0.1);
    };
    
    video.onseeked = () => {
      if (signal.aborted) return;
      
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
        signal.removeEventListener('abort', onAbort);
        cleanup();
        resolve(thumbnailUrl);
      } catch (error) {
        signal.removeEventListener('abort', onAbort);
        cleanup();
        resolve(null);
      }
    };
    
    video.onerror = () => {
      signal.removeEventListener('abort', onAbort);  
      cleanup();
      resolve(null);
    };
    
    video.src = URL.createObjectURL(file);
    video.load();
  });
}