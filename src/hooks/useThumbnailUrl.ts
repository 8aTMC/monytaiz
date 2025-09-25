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
        // Use direct storage access with proper authentication
        const { data, error: urlError } = await supabase.storage
          .from('content')
          .createSignedUrl(thumbnailPath, 3600); // 1 hour expiry

        if (urlError) {
          console.error('Error generating thumbnail URL:', urlError);
          console.log('Failed path:', thumbnailPath);
          setError(urlError.message);
          setThumbnailUrl(null);
        } else {
          console.log('Successfully generated thumbnail URL for:', thumbnailPath);
          setThumbnailUrl(data.signedUrl);
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