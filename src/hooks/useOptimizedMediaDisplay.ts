import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OptimizedMediaState {
  tinyPlaceholder: string | null;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  fullUrl: string | null;
  currentUrl: string | null;
  isLoading: boolean;
  error: boolean;
}

interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'audio';
  storage_path?: string;
  path?: string;
  renditions?: {
    video_1080?: string;
    video_720?: string;
  };
  tiny_placeholder?: string;
  width?: number;
  height?: number;
}

const SUPABASE_PROJECT_URL = 'https://alzyzfjzwvofmjccirjq.supabase.co';

// Cache for transform URLs
const urlCache = new Map<string, { url: string; expires: number }>();

export const useOptimizedMediaDisplay = () => {
  const [mediaState, setMediaState] = useState<OptimizedMediaState>({
    tinyPlaceholder: null,
    thumbnailUrl: null,
    previewUrl: null,
    fullUrl: null,
    currentUrl: null,
    isLoading: false,
    error: false
  });

  const loadingRef = useRef<boolean>(false);
  const enhanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Generate optimized transform URL using Supabase Image Transformations
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

  // Get signed URL with transforms for private content
  const getSignedTransformUrl = useCallback(async (
    path: string,
    transforms: Parameters<typeof getTransformUrl>[1] = {},
    expiresIn: number = 3600
  ): Promise<string | null> => {
    try {
      const cacheKey = `${path}-${JSON.stringify(transforms)}-${expiresIn}`;
      const cached = urlCache.get(cacheKey);
      
      if (cached && cached.expires > Date.now()) {
        return cached.url;
      }

      // Create signed URL with transforms
      const { data, error } = await supabase.storage
        .from('content')
        .createSignedUrl(path, expiresIn, {
          transform: transforms.width || transforms.height ? {
            width: transforms.width,
            height: transforms.height,
            quality: transforms.quality || 80,
            resize: transforms.resize || 'cover'
          } : undefined
        });

      if (error || !data.signedUrl) {
        // Don't spam console with warnings for missing files
        if (error.message !== 'Object not found') {
          console.warn('Failed to create signed URL for', path, ':', error);
        }
        throw new Error(`Failed to create signed URL: ${error.message}`);
      }

      // Cache the result
      urlCache.set(cacheKey, {
        url: data.signedUrl,
        expires: Date.now() + (expiresIn * 1000) - 60000 // Expire 1 minute early for safety
      });

      return data.signedUrl;
    } catch (error) {
      // Throw error to be handled by caller instead of returning null
      throw error;
    }
  }, []);

  // Load optimized media with progressive enhancement
  const loadOptimizedMedia = useCallback(async (item: MediaItem, isPublic: boolean = false) => {
    if (loadingRef.current) return;
    
    loadingRef.current = true;
    setMediaState(prev => ({ ...prev, isLoading: true, error: false }));

    try {
      const mediaPath = item.path || item.storage_path;
      if (!mediaPath) {
        throw new Error('No storage path available');
      }

      // Check if this is a processed file path
      const isProcessedPath = mediaPath.includes('processed/');
      
      // Use tiny placeholder for initial display if available
      let initialUrl: string | null = null;
      if (item.tiny_placeholder) {
        initialUrl = item.tiny_placeholder;
      }

      // Generate URLs based on media type and privacy
      let thumbnailUrl: string | null = null;
      let previewUrl: string | null = null;
      let fullUrl: string | null = null;

      if (item.type === 'image') {
        // For all files, try direct loading first (processed files should load instantly)
        if (isPublic) {
          fullUrl = getTransformUrl(mediaPath, { quality: 90 });
          thumbnailUrl = getTransformUrl(mediaPath, {
            width: 256,
            height: 256,
            resize: 'cover',
            quality: 70
          });
          previewUrl = getTransformUrl(mediaPath, {
            width: 1280,
            height: 720,
            resize: 'contain',
            quality: 80
          });
        } else {
          // For private files, use the original path without assuming processed versions exist
          try {
            fullUrl = await getSignedTransformUrl(mediaPath, { quality: 90 });
            thumbnailUrl = await getSignedTransformUrl(mediaPath, {
              width: 256,
              height: 256,
              resize: 'cover',
              quality: 70
            });
            previewUrl = await getSignedTransformUrl(mediaPath, {
              width: 1280,
              height: 720,
              resize: 'contain',
              quality: 80
            });
          } catch (error) {
            console.warn('Failed to generate signed URLs for:', mediaPath, error);
            // Set error state and stop trying
            setMediaState(prev => ({
              ...prev,
              isLoading: false,
              error: true
            }));
            loadingRef.current = false;
            return;
          }
        }

        // Set URLs immediately - processed files load instantly, others use progressive loading
        setMediaState(prev => ({
          ...prev,
          thumbnailUrl,
          previewUrl,
          fullUrl,
          // Use full quality for processed files, thumbnail for others initially
          currentUrl: isProcessedPath ? fullUrl : (thumbnailUrl || fullUrl),
          tinyPlaceholder: initialUrl,
          isLoading: false
        }));

      } else if (item.type === 'video') {
        // For videos, use the original path
        if (isPublic) {
          fullUrl = getTransformUrl(mediaPath);
          thumbnailUrl = getTransformUrl(mediaPath, {
            width: 256,
            height: 256,
            resize: 'cover',
            quality: 70
          });
        } else {
          try {
            fullUrl = await getSignedTransformUrl(mediaPath);
            thumbnailUrl = await getSignedTransformUrl(mediaPath, {
              width: 256,
              height: 256,
              resize: 'cover',
              quality: 70
            });
          } catch (error) {
            console.warn('Failed to generate video URLs for:', mediaPath, error);
            setMediaState(prev => ({
              ...prev,
              isLoading: false,
              error: true
            }));
            loadingRef.current = false;
            return;
          }
        }

        setMediaState(prev => ({
          ...prev,
          thumbnailUrl,
          fullUrl,
          currentUrl: fullUrl || thumbnailUrl,
          tinyPlaceholder: initialUrl,
          isLoading: false
        }));

      } else if (item.type === 'audio') {
        // Audio files don't have visual thumbnails
        setMediaState(prev => ({
          ...prev,
          isLoading: false
        }));
      }

    } catch (error) {
      console.error('Failed to load optimized media:', error);
      setMediaState(prev => ({
        ...prev,
        isLoading: false,
        error: true
      }));
    } finally {
      loadingRef.current = false;
    }
  }, [getTransformUrl, getSignedTransformUrl]);

  // Enhance quality on hover/focus
  const enhanceQuality = useCallback(() => {
    if (enhanceTimeoutRef.current) {
      clearTimeout(enhanceTimeoutRef.current);
    }
    
    enhanceTimeoutRef.current = setTimeout(() => {
      setMediaState(prev => {
        // Upgrade from thumbnail to preview, or preview to full
        if (prev.fullUrl && prev.currentUrl !== prev.fullUrl) {
          return { ...prev, currentUrl: prev.fullUrl };
        } else if (prev.previewUrl && prev.currentUrl !== prev.previewUrl) {
          return { ...prev, currentUrl: prev.previewUrl };
        }
        return prev;
      });
    }, 300);
  }, []);

  // Get best available URL for specific use case
  const getBestUrl = useCallback((
    purpose: 'thumbnail' | 'preview' | 'full' = 'thumbnail'
  ): string | null => {
    switch (purpose) {
      case 'thumbnail':
        return mediaState.thumbnailUrl || mediaState.tinyPlaceholder;
      case 'preview':
        return mediaState.previewUrl || mediaState.thumbnailUrl || mediaState.tinyPlaceholder;
      case 'full':
        return mediaState.fullUrl || mediaState.previewUrl || mediaState.thumbnailUrl || mediaState.tinyPlaceholder;
      default:
        return mediaState.currentUrl;
    }
  }, [mediaState]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (enhanceTimeoutRef.current) {
        clearTimeout(enhanceTimeoutRef.current);
      }
    };
  }, []);

  return {
    loadOptimizedMedia,
    enhanceQuality,
    getBestUrl,
    getTransformUrl,
    getSignedTransformUrl,
    ...mediaState
  };
};