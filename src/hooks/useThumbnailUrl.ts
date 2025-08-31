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
      
      try {
        const { data, error: urlError } = await supabase.storage
          .from('content')
          .createSignedUrl(thumbnailPath, 3600); // 1 hour expiry

        if (urlError) {
          console.error('Error generating thumbnail URL:', urlError);
          setError(urlError.message);
          setThumbnailUrl(null);
        } else {
          setThumbnailUrl(data.signedUrl);
        }
      } catch (err) {
        console.error('Error generating thumbnail URL:', err);
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