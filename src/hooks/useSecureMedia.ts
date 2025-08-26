import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SecureMediaCache {
  [key: string]: {
    url: string;
    expires_at: string;
  };
}

const mediaCache: SecureMediaCache = {};

export const useSecureMedia = () => {
  const [loading, setLoading] = useState(false);

  const getSecureUrl = useCallback(async (
    path: string, 
    transforms?: { width?: number; height?: number; quality?: number }
  ): Promise<string | null> => {
    if (!path) return null;

    // Create cache key including transforms
    const cacheKey = `${path}_${JSON.stringify(transforms || {})}`;
    
    // Check if we have a valid cached URL
    const cached = mediaCache[cacheKey];
    if (cached && new Date(cached.expires_at) > new Date()) {
      return cached.url;
    }

    setLoading(true);
    try {
      // Build query parameters
      const params = new URLSearchParams({ path });
      if (transforms?.width) params.append('width', transforms.width.toString());
      if (transforms?.height) params.append('height', transforms.height.toString());
      if (transforms?.quality) params.append('quality', transforms.quality.toString());

      const { data, error } = await supabase.functions.invoke('secure-media', {
        body: null,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      // Use direct fetch since we need query parameters
      const response = await fetch(
        `https://alzyzfjzwvofmjccirjq.supabase.co/functions/v1/secure-media?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        console.error('Failed to get secure URL:', response.statusText);
        return null;
      }

      const result = await response.json();
      
      if (result.error) {
        console.error('Secure media error:', result.error);
        return null;
      }

      // Cache the result
      mediaCache[cacheKey] = {
        url: result.url,
        expires_at: result.expires_at
      };

      return result.url;
    } catch (error) {
      console.error('Error getting secure URL:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { getSecureUrl, loading };
};