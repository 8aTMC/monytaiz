import { useState, useEffect, useRef } from 'react';
import { fileToDataURL } from '@/lib/blobUtils';

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
          // Use data URL for images to avoid blob URL lifecycle issues
          const dataUrl = await fileToDataURL(file);
          if (!abortController.signal.aborted) {
            setThumbnail(dataUrl);
            thumbnailCache.set(cacheKey, dataUrl);
          }
        } else if (file.type.startsWith('video/')) {
          // Use canvas-based video thumbnail generation that returns data URL
          const thumbnailDataUrl = await generateVideoThumbnailOptimized(file, abortController.signal);
          if (!abortController.signal.aborted && thumbnailDataUrl) {
            setThumbnail(thumbnailDataUrl);
            thumbnailCache.set(cacheKey, thumbnailDataUrl);
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
    
    let blobUrl: string | null = null;
    
    const cleanup = () => {
      if (blobUrl) {
        // Add delay to prevent ERR_FILE_NOT_FOUND during cleanup
        setTimeout(() => {
          try {
            URL.revokeObjectURL(blobUrl);
          } catch (e) {
            // Ignore revocation errors
          }
        }, 200);
        blobUrl = null;
      }
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
        // Return data URL instead of blob URL to avoid lifecycle issues
        const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        signal.removeEventListener('abort', onAbort);
        cleanup();
        resolve(thumbnailDataUrl);
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
    
    // Create blob URL and track it for cleanup
    blobUrl = URL.createObjectURL(file);
    video.src = blobUrl;
    video.load();
  });
}