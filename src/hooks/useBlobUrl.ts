import { useRef, useEffect, useCallback } from 'react';

/**
 * Centralized blob URL management hook
 * Automatically tracks and cleans up blob URLs to prevent memory leaks
 * Adds safe, delayed revocation to avoid race conditions with media elements
 */
export const useBlobUrl = () => {
  const blobUrlsRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<Map<string, number>>(new Map());

  // Cleanup all blob URLs on unmount
  useEffect(() => {
    return () => {
      // Clear any pending timers first
      timersRef.current.forEach((id) => {
        try { clearTimeout(id); } catch {}
      });
      timersRef.current.clear();

      // Revoke all known URLs
      blobUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (error) {
          console.warn('Failed to revoke blob URL:', error);
        }
      });
      blobUrlsRef.current.clear();
    };
  }, []);

  // Create and track a new blob URL
  const createBlobUrl = useCallback((blob: Blob | File): string => {
    const url = URL.createObjectURL(blob);
    blobUrlsRef.current.add(url);
    return url;
  }, []);

  // Revoke and untrack a specific blob URL (immediate)
  const revokeBlobUrl = useCallback((url: string) => {
    // Cancel any scheduled safe revoke
    const timerId = timersRef.current.get(url);
    if (timerId) {
      try { clearTimeout(timerId); } catch {}
      timersRef.current.delete(url);
    }

    if (blobUrlsRef.current.has(url)) {
      try {
        URL.revokeObjectURL(url);
        blobUrlsRef.current.delete(url);
      } catch (error) {
        console.warn('Failed to revoke blob URL:', error);
      }
    }
  }, []);

  // Revoke after a short delay to avoid net::ERR_FILE_NOT_FOUND during src swap
  const safeRevokeBlobUrl = useCallback((url: string, delayMs: number = 150) => {
    if (!blobUrlsRef.current.has(url)) return;

    // Debounce any existing timer
    const existing = timersRef.current.get(url);
    if (existing) {
      try { clearTimeout(existing); } catch {}
      timersRef.current.delete(url);
    }

    const id = window.setTimeout(() => {
      try {
        if (blobUrlsRef.current.has(url)) {
          URL.revokeObjectURL(url);
          blobUrlsRef.current.delete(url);
        }
      } catch (error) {
        console.warn('Failed to revoke blob URL:', error);
      } finally {
        timersRef.current.delete(url);
      }
    }, delayMs);

    timersRef.current.set(url, id);
  }, []);

  // Revoke all tracked blob URLs
  const revokeAllBlobUrls = useCallback(() => {
    // Clear timers
    timersRef.current.forEach((id) => {
      try { clearTimeout(id); } catch {}
    });
    timersRef.current.clear();

    blobUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {
        console.warn('Failed to revoke blob URL:', error);
      }
    });
    blobUrlsRef.current.clear();
  }, []);

  return {
    createBlobUrl,
    revokeBlobUrl,
    safeRevokeBlobUrl,
    revokeAllBlobUrls,
    trackedUrls: blobUrlsRef.current
  };
};