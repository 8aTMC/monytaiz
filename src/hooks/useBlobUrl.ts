import { useRef, useEffect, useCallback } from 'react';

/**
 * Centralized blob URL management hook
 * Automatically tracks and cleans up blob URLs to prevent memory leaks
 */
export const useBlobUrl = () => {
  const blobUrlsRef = useRef<Set<string>>(new Set());

  // Cleanup all blob URLs on unmount
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach(url => {
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

  // Revoke and untrack a specific blob URL
  const revokeBlobUrl = useCallback((url: string) => {
    if (blobUrlsRef.current.has(url)) {
      try {
        URL.revokeObjectURL(url);
        blobUrlsRef.current.delete(url);
      } catch (error) {
        console.warn('Failed to revoke blob URL:', error);
      }
    }
  }, []);

  // Revoke all tracked blob URLs
  const revokeAllBlobUrls = useCallback(() => {
    blobUrlsRef.current.forEach(url => {
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
    revokeAllBlobUrls,
    trackedUrls: blobUrlsRef.current
  };
};