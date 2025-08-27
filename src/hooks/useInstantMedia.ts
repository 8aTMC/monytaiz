import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface InstantMediaState {
  placeholder: string | null;
  lowQuality: string | null;
  highQuality: string | null;
  currentUrl: string | null;
  isLoading: boolean;
  error: boolean;
}

const CACHE_KEY = 'instant_media_cache';
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours
let memoryCache: { [key: string]: any } = {};

// Load cache from localStorage
try {
  const stored = localStorage.getItem(CACHE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    const now = Date.now();
    Object.entries(parsed).forEach(([key, value]: [string, any]) => {
      if (value.cached_at && (now - value.cached_at) < CACHE_DURATION) {
        memoryCache[key] = value;
      }
    });
  }
} catch (error) {
  console.warn('Failed to load instant media cache:', error);
}

const saveToCache = (key: string, data: any) => {
  memoryCache[key] = { ...data, cached_at: Date.now() };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(memoryCache));
  } catch (error) {
    console.warn('Failed to save to cache:', error);
  }
};

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

    const cacheKey = storagePath;

    // Check cache first
    const cached = memoryCache[cacheKey];
    if (cached && (Date.now() - cached.cached_at) < CACHE_DURATION) {
      setMediaState({
        placeholder: cached.placeholder,
        lowQuality: cached.lowQuality,
        highQuality: cached.highQuality,
        currentUrl: cached.highQuality || cached.lowQuality || cached.placeholder,
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
        placeholderUrl = await generateTinyPlaceholder(storagePath);
      }

      // Set placeholder immediately for instant loading
      setMediaState(prev => ({
        ...prev,
        placeholder: placeholderUrl,
        currentUrl: placeholderUrl,
        isLoading: true
      }));

      // Step 2: Get auth session once
      const session = await supabase.auth.getSession();
      if (!session.data.session?.access_token) {
        throw new Error('No auth session');
      }

      // Step 3: Load both qualities in parallel with optimized endpoint
      const [lowQualityUrl, highQualityUrl] = await Promise.all([
        getOptimizedUrl(storagePath, session.data.session.access_token, 45, 256),
        getOptimizedUrl(storagePath, session.data.session.access_token, 85, 1024)
      ]);

      const finalState = {
        placeholder: placeholderUrl,
        lowQuality: lowQualityUrl,
        highQuality: highQualityUrl,
        currentUrl: highQualityUrl || lowQualityUrl || placeholderUrl,
        isLoading: false,
        error: false
      };

      setMediaState(finalState);
      
      // Cache the result
      saveToCache(cacheKey, finalState);

    } catch (error) {
      console.error('Failed to load instant media:', error);
      setMediaState(prev => ({
        ...prev,
        isLoading: false,
        error: true,
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

// Generate a tiny base64 placeholder from the image
const generateTinyPlaceholder = async (storagePath: string): Promise<string> => {
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

// Optimized URL fetching with better caching
const getOptimizedUrl = async (
  path: string, 
  token: string, 
  quality: number, 
  maxSize: number
): Promise<string | null> => {
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
        }
      }
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const result = await response.json();
    return result.error ? null : result.url;
  } catch (error) {
    console.error('Failed to get optimized URL:', error);
    return null;
  }
};