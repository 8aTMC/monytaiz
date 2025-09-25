import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useThumbnailUrl = (thumbnailPath?: string) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!thumbnailPath) {
      setThumbnailUrl(null);
      return;
    }

    const generateThumbnailUrl = async () => {
      setLoading(true);
      setError(null);
      
      console.log('useThumbnailUrl - Attempting to load thumbnail:', thumbnailPath);
      
      try {
        // Use fast-secure-media edge function for consistent auth and access control
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          throw new Error('Not authenticated');
        }

        const { data, error: functionError } = await supabase.functions.invoke('fast-secure-media', {
          body: { path: thumbnailPath },
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (functionError) {
          console.error('Error calling fast-secure-media:', functionError);
          // Fallback to direct storage access
          const { data: fallbackData, error: urlError } = await supabase.storage
            .from('content')
            .createSignedUrl(thumbnailPath, 3600);

          if (urlError) {
            console.error('Fallback error generating thumbnail URL:', urlError);
            setError(urlError.message);
            setThumbnailUrl(null);
          } else {
            console.log('Fallback: Successfully generated thumbnail URL for:', thumbnailPath);
            setThumbnailUrl(fallbackData.signedUrl);
          }
        } else if (data?.success && data?.url) {
          console.log('Successfully generated secure thumbnail URL for:', thumbnailPath);
          setThumbnailUrl(data.url);
        } else {
          console.error('Invalid response from fast-secure-media:', data);
          setError('Invalid response from secure media service');
          setThumbnailUrl(null);
        }
      } catch (err) {
        console.error('Error generating thumbnail URL:', err);
        console.log('Failed path:', thumbnailPath);
        setError('Failed to generate thumbnail URL');
        setThumbnailUrl(null);
      } finally {
        setLoading(false);
      }
    };

    generateThumbnailUrl();
  }, [thumbnailPath]);

  return { thumbnailUrl, loading, error };
};