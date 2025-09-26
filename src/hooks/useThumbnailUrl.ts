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
        // Handle full URLs directly (no signing needed)
        if (thumbnailPath.startsWith('http://') || thumbnailPath.startsWith('https://')) {
          setThumbnailUrl(thumbnailPath);
          return;
        }

        // Normalize path: trim leading slash and remove "content/" prefix if present
        let originalPath = thumbnailPath;
        if (originalPath.startsWith('/')) originalPath = originalPath.slice(1);
        let normalizedPath = originalPath.startsWith('content/')
          ? originalPath.substring(8)
          : originalPath;

        // Removed debug logging to reduce console noise

        // Try normalized path first
        const attemptSign = async (path: string) => {
          const { data, error: urlError } = await supabase.storage
            .from('content')
            .createSignedUrl(path, 3600);
          return { data, urlError } as const;
        };

        let { data, urlError } = await attemptSign(normalizedPath);

        // If failed, try the original path as a fallback (in case objects were stored with bucket prefix)
        if (urlError && originalPath !== normalizedPath) {
          ({ data, urlError } = await attemptSign(originalPath));
        }

        if (urlError) {
          setError(urlError.message);
          setThumbnailUrl(null);
        } else if (data?.signedUrl) {
          setThumbnailUrl(data.signedUrl);
        } else {
          setError('No URL generated');
          setThumbnailUrl(null);
        }
      } catch (err) {
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