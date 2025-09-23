import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { mediaCache } from '@/lib/mediaCache';

interface InstantMediaState {
  placeholder: string | null;
  lowQuality: string | null;
  highQuality: string | null;
  currentUrl: string | null;
  isLoading: boolean;
  error: boolean;
}

export const useInstantMedia = () => {
  const [mediaState, setMediaState] = useState<InstantMediaState>({
    placeholder: null,
    lowQuality: null,
    highQuality: null,
    currentUrl: null,
    isLoading: false,
    error: false
  });

  const loadingRef = useRef<boolean>(false);
  const enhanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadInstantMedia = useCallback(async (storagePath: string, dbPlaceholder?: string) => {
    if (!storagePath || loadingRef.current) return;
    
    loadingRef.current = true;
    setMediaState(prev => ({ ...prev, isLoading: true, error: false }));

    // Check unified cache first
    const cached = mediaCache.get(storagePath, undefined, 'instant');
    if (cached && cached.metadata) {
      setMediaState({
        placeholder: cached.metadata.placeholder,
        lowQuality: cached.metadata.lowQuality,
        highQuality: cached.metadata.highQuality,
        currentUrl: cached.metadata.highQuality || cached.metadata.lowQuality || cached.metadata.placeholder,
        isLoading: false,
        error: false
      });
      loadingRef.current = false;
      return;
    }

    try {
      // Step 1: Instant placeholder (base64 or from DB)
      let placeholderUrl = dbPlaceholder;
      if (!placeholderUrl) {
        // Generate tiny base64 placeholder if not in DB
        placeholderUrl = generateTinyPlaceholder(storagePath);
      }

      // Set placeholder immediately for instant loading
      setMediaState(prev => ({
        ...prev,
        placeholder: placeholderUrl,
        currentUrl: placeholderUrl,
        isLoading: false // Set to false for thumbnails - no loading spinner
      }));

      // Step 2: Load only low quality for thumbnails first (staggered loading)
      const session = await supabase.auth.getSession();
      if (!session.data.session?.access_token) {
        throw new Error('No auth session');
      }

      // Load optimized version (with special handling for HEIC files)
      setTimeout(async () => {
        try {
          const isHEIC = isHEICFile(storagePath);
          console.log('Loading media:', { storagePath, isHEIC });
          
          let optimizedUrl: string | null = null;
          
          if (isHEIC) {
            // For HEIC files, try to get original file directly first
            optimizedUrl = await getOriginalUrl(storagePath, session.data.session.access_token);
            console.log('HEIC original URL result:', optimizedUrl);
          } else {
            // For other formats, use optimized transforms
            optimizedUrl = await getOptimizedUrl(storagePath, session.data.session.access_token, 60, 256);
            console.log('Optimized URL result:', optimizedUrl);
          }
          
          if (optimizedUrl) {
            setMediaState(prev => ({
              ...prev,
              lowQuality: optimizedUrl,
              currentUrl: optimizedUrl || prev.placeholder,
              isLoading: false
            }));

            // Cache result using unified cache
            mediaCache.set(storagePath, {
              url: optimizedUrl,
              type: 'instant',
              metadata: {
                placeholder: placeholderUrl,
                lowQuality: optimizedUrl,
                highQuality: null,
              }
            }, undefined, 'instant');
          } else {
            console.warn('No optimized URL returned for:', storagePath);
          }
        } catch (error) {
          console.warn('Failed to load optimized media:', error);
          // Don't show error for thumbnails, just keep placeholder
        }
      }, Math.random() * 200); // Random delay to prevent simultaneous requests

    } catch (error) {
      console.error('Failed to load instant media:', error);
      // For thumbnails, don't show error state, just keep placeholder
      setMediaState(prev => ({
        ...prev,
        isLoading: false,
        error: false, // Don't show errors for thumbnails
        currentUrl: prev.placeholder || null
      }));
    } finally {
      loadingRef.current = false;
    }
  }, []);

  const enhanceQuality = useCallback(() => {
    if (enhanceTimeoutRef.current) {
      clearTimeout(enhanceTimeoutRef.current);
    }
    
    // If user hovers/focuses, prioritize high quality after delay
    enhanceTimeoutRef.current = setTimeout(() => {
      setMediaState(prev => {
        if (prev.highQuality && prev.currentUrl !== prev.highQuality) {
          return { ...prev, currentUrl: prev.highQuality };
        }
        return prev;
      });
    }, 500);
  }, []);

  useEffect(() => {
    return () => {
      if (enhanceTimeoutRef.current) {
        clearTimeout(enhanceTimeoutRef.current);
      }
    };
  }, []);

  return {
    loadInstantMedia,
    enhanceQuality,
    ...mediaState
  };
};

// Check if file is HEIC format
const isHEICFile = (storagePath: string): boolean => {
  const extension = storagePath.toLowerCase().split('.').pop();
  return extension === 'heic' || extension === 'heif' || extension === 'heix';
};

// Generate a tiny base64 placeholder from the image
const generateTinyPlaceholder = (storagePath: string): string => {
  try {
    // Create a tiny 8x8 colored rectangle as placeholder
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return '';
    
    // Generate a color based on the path hash for consistent colors
    const hash = hashCode(storagePath);
    const hue = Math.abs(hash) % 360;
    ctx.fillStyle = `hsl(${hue}, 30%, 80%)`;
    ctx.fillRect(0, 0, 8, 8);
    
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.warn('Failed to generate placeholder:', error);
    return '';
  }
};

// Simple hash function for consistent colors
const hashCode = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
};

// Get original file URL directly (for HEIC files with format conversion)
const getOriginalUrl = async (
  path: string,
  token: string,
  retries: number = 2
): Promise<string | null> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Force format conversion for HEIC files to web-compatible format
      const params = new URLSearchParams({ 
        path,
        // Force format conversion for HEIC files
        format: 'webp',
        quality: '80',
        width: '512',
        height: '512'
      });

      const response = await fetch(
        `https://alzyzfjzwvofmjccirjq.supabase.co/functions/v1/fast-secure-media?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(15000) // 15 second timeout for original files
        }
      );

      if (!response.ok) {
        console.warn(`HTTP ${response.status} for HEIC conversion:`, path);
        if (attempt === retries) throw new Error(`HTTP ${response.status}`);
        continue;
      }
      
      const result = await response.json();
      console.log('HEIC conversion URL response:', { path, result });
      return result.error ? null : result.url;
    } catch (error) {
      console.warn(`Attempt ${attempt + 1} failed for HEIC conversion:`, { path, error });
      if (attempt === retries) {
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
    }
  }
  return null;
};

// Optimized URL fetching with retries and better error handling
const getOptimizedUrl = async (
  path: string, 
  token: string, 
  quality: number, 
  maxSize: number,
  retries: number = 2
): Promise<string | null> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const params = new URLSearchParams({ 
        path, 
        quality: quality.toString(),
        width: maxSize.toString(),
        height: maxSize.toString()
      });

      const response = await fetch(
        `https://alzyzfjzwvofmjccirjq.supabase.co/functions/v1/fast-secure-media?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(10000) // 10 second timeout
        }
      );

      if (!response.ok) {
        console.warn(`HTTP ${response.status} for optimized file:`, path);
        if (attempt === retries) throw new Error(`HTTP ${response.status}`);
        continue;
      }
      
      const result = await response.json();
      return result.error ? null : result.url;
    } catch (error) {
      if (attempt === retries) {
        console.warn(`Failed to get optimized URL after ${retries + 1} attempts:`, error);
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
    }
  }
  return null;
};