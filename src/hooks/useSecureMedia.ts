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
      console.log('Using cached URL for:', path);
      return cached.url;
    }

    console.log('Fetching secure URL for:', path, transforms);
    setLoading(true);
    try {
      // Build query parameters
      const params = new URLSearchParams({ path });
      if (transforms?.width) params.append('width', transforms.width.toString());
      if (transforms?.height) params.append('height', transforms.height.toString());
      if (transforms?.quality) params.append('quality', transforms.quality.toString());

      const session = await supabase.auth.getSession();
      if (!session.data.session?.access_token) {
        console.error('No auth session found');
        return null;
      }

      console.log('Making request to secure-media with params:', params.toString());
      
      // Use direct fetch with query parameters
      const response = await fetch(
        `https://alzyzfjzwvofmjccirjq.supabase.co/functions/v1/secure-media?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${session.data.session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Response status:', response.status, response.statusText);

      if (!response.ok) {
        console.error('Failed to get secure URL:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response:', errorText);
        return null;
      }

      const result = await response.json();
      console.log('Secure media result:', result);
      
      if (result.error) {
        console.error('Secure media error:', result.error);
        return null;
      }

      // Cache the result
      mediaCache[cacheKey] = {
        url: result.url,
        expires_at: result.expires_at
      };

      console.log('Successfully got secure URL for:', path);
      return result.url;
    } catch (error) {
      console.error('Error getting secure URL for path:', path, error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { getSecureUrl, loading };
};