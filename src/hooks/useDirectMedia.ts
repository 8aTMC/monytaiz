import { useCallback } from 'react';

// Direct Supabase CDN URLs - blazing fast!
const SUPABASE_URL = 'https://alzyzfjzwvofmjccirjq.supabase.co';

interface DirectMediaCache {
  [key: string]: string;
}

const directCache: DirectMediaCache = {};

export const useDirectMedia = () => {
  
  const getDirectUrl = useCallback((
    path: string,
    transforms?: { width?: number; height?: number; quality?: number }
  ): string => {
    if (!path) return '';

    const cacheKey = `${path}_${JSON.stringify(transforms || {})}`;
    
    // Return cached URL instantly
    if (directCache[cacheKey]) {
      return directCache[cacheKey];
    }

    // Build direct CDN URL with transforms
    let url = `${SUPABASE_URL}/storage/v1/object/public/content/${path}`;
    
    if (transforms && (transforms.width || transforms.height || transforms.quality)) {
      const params = new URLSearchParams();
      if (transforms.width) params.append('width', transforms.width.toString());
      if (transforms.height) params.append('height', transforms.height.toString());
      if (transforms.quality) params.append('quality', transforms.quality.toString());
      url += `?${params.toString()}`;
    }

    // Cache for instant future access
    directCache[cacheKey] = url;
    return url;
  }, []);

  return { getDirectUrl };
};