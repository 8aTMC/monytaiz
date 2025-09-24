import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OptimizedMediaState {
  currentUrl: string | null;
  isLoading: boolean;
  error: boolean;
}

interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'audio' | 'gif';
  storage_path?: string;
  path?: string;
  tiny_placeholder?: string;
  width?: number;
  height?: number;
}

const SUPABASE_PROJECT_URL = 'https://alzyzfjzwvofmjccirjq.supabase.co';

// Simple cache for URLs with cleanup
class URLCache {
  private cache = new Map<string, { url: string; expires: number }>();
  private maxSize = 100;

  get(key: string): string | null {
    const entry = this.cache.get(key);
    if (!entry || entry.expires <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.url;
  }

  set(key: string, url: string, expiresIn: number): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      url,
      expires: Date.now() + (expiresIn * 1000) - 60000
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

const urlCache = new URLCache();

export const useOptimizedMediaDisplay = () => {
  const [mediaState, setMediaState] = useState<OptimizedMediaState>({
    currentUrl: null,
    isLoading: false,
    error: false
  });

  const loadingRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Generate optimized transform URL - pure function with no dependencies
  const getTransformUrl = useCallback((
    path: string, 
    transforms: {
      width?: number;
      height?: number;
      quality?: number;
      resize?: 'cover' | 'contain' | 'fill';
      dpr?: number;
    } = {}
  ): string => {
    const params = new URLSearchParams();
    
    if (transforms.width) params.set('width', transforms.width.toString());
    if (transforms.height) params.set('height', transforms.height.toString());
    if (transforms.quality) params.set('quality', transforms.quality.toString());
    if (transforms.resize) params.set('resize', transforms.resize);
    if (transforms.dpr) params.set('dpr', transforms.dpr.toString());

    const queryString = params.toString();
    const baseUrl = `${SUPABASE_PROJECT_URL}/storage/v1/object/public/content/${path}`;
    
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }, []);

  // Get signed URL with transforms for private content - stable function
  const getSignedTransformUrl = useCallback(async (
    path: string,
    transforms: Parameters<typeof getTransformUrl>[1] = {},
    expiresIn: number = 3600
  ): Promise<string | null> => {
    const cacheKey = `${path}-${JSON.stringify(transforms)}-${expiresIn}`;
    
    // Check cache first
    const cached = urlCache.get(cacheKey);
    if (cached) return cached;

    try {
      // Create signed URL with transforms
      const { data, error } = await supabase.storage
        .from('content')
        .createSignedUrl(path, expiresIn, {
          transform: transforms.width || transforms.height ? {
            width: transforms.width,
            height: transforms.height,
            quality: transforms.quality || 85,
            resize: transforms.resize || 'cover'
          } : undefined
        });

      if (error || !data.signedUrl) {
        return null;
      }

      // Cache the result
      urlCache.set(cacheKey, data.signedUrl, expiresIn);
      return data.signedUrl;
    } catch (error) {
      return null;
    }
  }, []);

  // HEIC detection utility
  const isHEICFile = useCallback((path?: string) => {
    if (!path) return false;
    const fileName = path.toLowerCase();
    return fileName.endsWith('.heic') || fileName.endsWith('.heif');
  }, []);

  // Simplified media loading with abort controller
  const loadOptimizedMedia = useCallback(async (item: MediaItem, isPublic: boolean = false) => {
    const itemKey = `${item.id}-${item.type}-${item.storage_path || item.path}`;
    
    // Prevent duplicate loading
    if (loadingRef.current === itemKey) return;
    
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    loadingRef.current = itemKey;
    abortControllerRef.current = new AbortController();
    
    setMediaState({
      currentUrl: null,
      isLoading: true,
      error: false
    });

    try {
      // Check if request was aborted
      if (abortControllerRef.current.signal.aborted) return;

      // Use actual database paths only - don't construct non-existent paths
      const bestPath = item.storage_path || item.path;
      
      if (!bestPath) {
        console.warn('MediaDisplay: No storage path found for item:', item.id, item.type);
        throw new Error('No valid file path found in database');
      }

      console.log('MediaDisplay: Loading media with path:', bestPath, 'for item:', item.id);

      // Check for abort again
      if (abortControllerRef.current.signal.aborted) return;

      let finalUrl: string | null = null;

      // Check if this is a HEIC file - use fast-secure-media for format conversion
      const isHEIC = isHEICFile(bestPath);
      
      if (isHEIC) {
        // For HEIC files, call fast-secure-media with format conversion
        try {
          const { data: mediaData, error: mediaError } = await supabase.functions.invoke('fast-secure-media', {
            body: { 
              path: bestPath,
              format: 'webp',
              quality: 80,
              width: 512,
              height: 512
            }
          });

          if (!mediaError && mediaData?.url) {
            finalUrl = mediaData.url;
          }
        } catch (error) {
          // If fast-secure-media fails, fall through to regular processing
        }
      }
      
      // For non-HEIC files or if HEIC processing failed, use regular signed URLs
      if (!finalUrl) {
        finalUrl = await getSignedTransformUrl(bestPath, {
          quality: 85,
          ...(item.type === 'image' && {
            width: 512,
            height: 512,
            resize: 'cover'
          })
        });
      }

      // If URL generation failed, log the error but don't retry with non-existent paths
      if (!finalUrl) {
        console.error('MediaDisplay: Failed to generate URL for path:', bestPath, 'item:', item.id);
      }

      // Final abort check before setting state
      if (abortControllerRef.current.signal.aborted) return;

      if (!finalUrl) {
        console.warn('MediaDisplay: No URL generated for item:', item.id, 'path:', bestPath);
        throw new Error(`Failed to generate media URL for path: ${bestPath}`);
      }

      // Set the final URL
      setMediaState({
        currentUrl: finalUrl,
        isLoading: false,
        error: false
      });

    } catch (error: any) {
      // Don't update state if request was aborted
      if (error.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
        return;
      }
      
      setMediaState({
        currentUrl: null,
        isLoading: false,
        error: true
      });
    } finally {
      loadingRef.current = null;
    }
  }, [getTransformUrl, getSignedTransformUrl]);

  // Simple quality enhancement (no-op since we load at full quality)
  const enhanceQuality = useCallback(() => {
    // No-op since we already load at optimal quality
  }, []);

  // Clear function for cleanup
  const clearMedia = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    loadingRef.current = null;
    
    setMediaState({
      currentUrl: null,
      isLoading: false,
      error: false
    });
  }, []);

  return {
    loadOptimizedMedia,
    enhanceQuality,
    clearMedia,
    getTransformUrl,
    getSignedTransformUrl,
    ...mediaState
  };
};