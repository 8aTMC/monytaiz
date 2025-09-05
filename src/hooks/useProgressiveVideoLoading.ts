import { useState, useEffect, useCallback, useRef } from 'react';
import { QualityLevel } from './useAdaptiveQuality';

interface ProgressiveLoadingState {
  primaryUrl: string | null;
  fallbackUrl: string | null;
  preloadedQualities: Set<QualityLevel>;
  loadingQuality: QualityLevel | null;
  error: string | null;
}

interface QualitySource {
  quality: QualityLevel;
  url: string;
  priority: number;
}

export const useProgressiveVideoLoading = (
  mediaId: string, 
  startingQuality: QualityLevel = '480p'
) => {
  const [state, setState] = useState<ProgressiveLoadingState>({
    primaryUrl: null,
    fallbackUrl: null,
    preloadedQualities: new Set(),
    loadingQuality: null,
    error: null
  });

  const preloadCache = useRef<Map<QualityLevel, string>>(new Map());
  const loadingPromises = useRef<Map<QualityLevel, Promise<string>>>(new Map());

  // Get signed URL for specific quality
  const getSignedUrl = useCallback(async (quality: QualityLevel): Promise<string> => {
    try {
      // Check cache first
      if (preloadCache.current.has(quality)) {
        const cached = preloadCache.current.get(quality)!;
        console.log(`📋 Using cached URL for ${quality}`);
        return cached;
      }

      // Check if already loading
      if (loadingPromises.current.has(quality)) {
        return await loadingPromises.current.get(quality)!;
      }

      // Create loading promise
      const loadingPromise = (async () => {
        console.log(`🔄 Loading ${quality} URL...`);
        
      // Call the adaptive media edge function
      const response = await fetch(`https://alzyzfjzwvofmjccirjq.supabase.co/functions/v1/adaptive-media`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          mediaId,
          quality,
          expiresIn: 3600,
          format: 'url'
        })
      });

        if (!response.ok) {
          throw new Error(`Failed to get ${quality} URL: ${response.statusText}`);
        }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to get media URL');
      }
      const url = data.signedUrl;
        
        // Cache the URL
        preloadCache.current.set(quality, url);
        console.log(`✅ ${quality} URL loaded and cached`);
        
        return url;
      })();

      loadingPromises.current.set(quality, loadingPromise);
      
      try {
        const url = await loadingPromise;
        return url;
      } finally {
        loadingPromises.current.delete(quality);
      }

    } catch (error) {
      console.error(`❌ Failed to load ${quality} URL:`, error);
      throw error;
    }
  }, [mediaId]);

  // Preload video data for smooth switching
  const preloadQuality = useCallback(async (quality: QualityLevel) => {
    if (state.preloadedQualities.has(quality)) {
      return; // Already preloaded
    }

    setState(prev => ({ ...prev, loadingQuality: quality }));

    try {
      const url = await getSignedUrl(quality);
      
      // Create invisible video element to preload
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      
      // Set up preloading
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Preload timeout for ${quality}`));
        }, 15000);

        const onCanPlay = () => {
          clearTimeout(timeout);
          video.removeEventListener('canplay', onCanPlay);
          video.removeEventListener('error', onError);
          resolve();
        };

        const onError = () => {
          clearTimeout(timeout);
          video.removeEventListener('canplay', onCanPlay);
          video.removeEventListener('error', onError);
          reject(new Error(`Preload failed for ${quality}`));
        };

        video.addEventListener('canplay', onCanPlay);
        video.addEventListener('error', onError);
        video.src = url;
      });

      setState(prev => ({
        ...prev,
        preloadedQualities: new Set([...prev.preloadedQualities, quality]),
        loadingQuality: null
      }));

      console.log(`🎯 ${quality} preloaded successfully`);

    } catch (error) {
      console.error(`❌ Preload failed for ${quality}:`, error);
      setState(prev => ({
        ...prev,
        loadingQuality: null,
        error: `Failed to preload ${quality}: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
    }
  }, [getSignedUrl, state.preloadedQualities]);

  // Get the best available URL for playback
  const getBestAvailableUrl = useCallback(async (preferredQuality: QualityLevel): Promise<string> => {
    // Quality fallback hierarchy
    const fallbackOrder: QualityLevel[] = ['480p', '360p', '720p', '240p', '1080p'];
    
    // Try preferred quality first
    const qualitiesToTry = [preferredQuality, ...fallbackOrder.filter(q => q !== preferredQuality)];

    for (const quality of qualitiesToTry) {
      try {
        const url = await getSignedUrl(quality);
        
        // Test if URL is accessible
        const testResponse = await fetch(url, { method: 'HEAD' });
        if (testResponse.ok) {
          console.log(`✅ Using ${quality} as best available quality`);
          return url;
        }
      } catch (error) {
        console.warn(`❌ ${quality} not available:`, error);
        continue;
      }
    }

    throw new Error('No quality levels available');
  }, [getSignedUrl]);

  // Load initial quality and start progressive loading
  const loadProgressive = useCallback(async (targetQuality: QualityLevel = startingQuality) => {
    setState(prev => ({ ...prev, error: null }));

    try {
      // Load primary URL (immediate playback)
      console.log(`🎬 Loading primary quality: ${targetQuality}`);
      const primaryUrl = await getBestAvailableUrl(targetQuality);
      
      setState(prev => ({
        ...prev,
        primaryUrl,
        preloadedQualities: new Set([targetQuality])
      }));

      // Start progressive preloading in background
      const preloadOrder: QualityLevel[] = ['720p', '1080p', '480p', '360p'];
      const qualitiesNotLoaded = preloadOrder.filter(q => q !== targetQuality);

      // Preload one quality at a time to avoid overwhelming the network
      for (const quality of qualitiesNotLoaded) {
        // Small delay between preloads
        setTimeout(() => {
          preloadQuality(quality);
        }, qualitiesNotLoaded.indexOf(quality) * 2000);
      }

    } catch (error) {
      console.error('❌ Progressive loading failed:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Progressive loading failed'
      }));
    }
  }, [startingQuality, getBestAvailableUrl, preloadQuality]);

  // Get URL for specific quality with fallback
  const getUrlForQuality = useCallback(async (quality: QualityLevel): Promise<string | null> => {
    try {
      return await getSignedUrl(quality);
    } catch (error) {
      console.error(`Failed to get URL for ${quality}:`, error);
      return null;
    }
  }, [getSignedUrl]);

  // Check if quality is ready for smooth switching
  const isQualityReady = useCallback((quality: QualityLevel): boolean => {
    return state.preloadedQualities.has(quality);
  }, [state.preloadedQualities]);

  // Clear cache (useful for cleanup or refresh)
  const clearCache = useCallback(() => {
    preloadCache.current.clear();
    loadingPromises.current.clear();
    setState({
      primaryUrl: null,
      fallbackUrl: null,
      preloadedQualities: new Set(),
      loadingQuality: null,
      error: null
    });
  }, []);

  // Auto-load on mount
  useEffect(() => {
    loadProgressive();
    
    // Cleanup on unmount
    return () => {
      clearCache();
    };
  }, [mediaId]); // Re-run when mediaId changes

  return {
    ...state,
    loadProgressive,
    preloadQuality,
    getUrlForQuality,
    isQualityReady,
    getBestAvailableUrl,
    clearCache
  };
};