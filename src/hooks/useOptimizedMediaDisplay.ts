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
        console.warn('Failed to create signed URL:', error);
        return null;
      }

      // Cache the result
      urlCache.set(cacheKey, {
        url: data.signedUrl,
        expires: Date.now() + (expiresIn * 1000) - 60000 // Expire 1 minute early for safety
      });

      return data.signedUrl;
    } catch (error) {
      console.warn('Error creating signed transform URL:', error);
      return null;
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

      // Step 1: Start loading proper image immediately (skip tiny placeholder for faster loading)
      let initialUrl: string | null = null;
      
      if (item.tiny_placeholder && !mediaPath.includes('processed/')) {
        // Only use tiny placeholder for unprocessed files
        initialUrl = item.tiny_placeholder;
      }

      // Step 2: Generate URLs based on media type and privacy
      let thumbnailUrl: string | null = null;
      let previewUrl: string | null = null;
      let fullUrl: string | null = null;

      if (item.type === 'image') {
        if (isPublic) {
          // Public images use direct transform URLs
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

          fullUrl = getTransformUrl(mediaPath, {
            quality: 90
          });
        } else {
          // Private images need signed URLs
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

          fullUrl = await getSignedTransformUrl(mediaPath, {
            quality: 90
          });
        }

        // Load thumbnail immediately for processed images
        if (thumbnailUrl) {
          setMediaState(prev => ({
            ...prev,
            thumbnailUrl,
            currentUrl: thumbnailUrl,
            tinyPlaceholder: initialUrl,
            isLoading: false
          }));
        }

      } else if (item.type === 'video') {
        // For videos, use renditions or fall back to original
        const videoPath = item.renditions?.video_720 || item.renditions?.video_1080 || mediaPath;
        
        if (isPublic) {
          thumbnailUrl = getTransformUrl(videoPath, {
            width: 256,
            height: 256,
            resize: 'cover',
            quality: 70
          });
          
          fullUrl = getTransformUrl(videoPath);
        } else {
          thumbnailUrl = await getSignedTransformUrl(videoPath, {
            width: 256,
            height: 256,
            resize: 'cover',
            quality: 70
          });
          
          fullUrl = await getSignedTransformUrl(videoPath);
        }

        if (thumbnailUrl) {
          setMediaState(prev => ({
            ...prev,
            thumbnailUrl,
            currentUrl: thumbnailUrl,
            tinyPlaceholder: initialUrl,
            isLoading: false
          }));
        }

      } else if (item.type === 'audio') {
        // Audio files don't have visual thumbnails, but we can create a waveform or use icon
        setMediaState(prev => ({
          ...prev,
          isLoading: false
        }));
      }

      // Update state with all URLs - prefer actual image over placeholder
      setMediaState(prev => ({
        ...prev,
        thumbnailUrl,
        previewUrl,
        fullUrl,
        currentUrl: thumbnailUrl || fullUrl || prev.currentUrl || initialUrl,
        tinyPlaceholder: initialUrl,
        isLoading: false
      }));

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