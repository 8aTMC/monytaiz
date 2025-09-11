import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Direct Supabase signed URLs for private content
const SUPABASE_URL = 'https://alzyzfjzwvofmjccirjq.supabase.co';

interface DirectMediaCache {
  [key: string]: { url: string; expires: number };
}

const directCache: DirectMediaCache = {};

export const useDirectMedia = () => {
  
  const getDirectUrl = useCallback(async (
    path: string,
    transforms?: { width?: number; height?: number; quality?: number }
  ): Promise<string> => {
    if (!path) return '';

    console.log('🔗 Direct media URL request for path:', path, 'transforms:', transforms);

    const cacheKey = `${path}_${JSON.stringify(transforms || {})}`;
    
    // Return cached URL if still valid
    const cached = directCache[cacheKey];
    if (cached && Date.now() < cached.expires) {
      console.log('📦 Using cached direct URL:', cached.url);
      return cached.url;
    }

    try {
      // Clean path - ensure no content/ prefix for signed URL generation
      const cleanPath = path.replace(/^content\//, '');
      console.log('🧹 Using clean path for signed URL:', cleanPath);
      
      // Generate signed URL with transforms and timeout protection
      let signedUrlOptions: any = { expiresIn: 3600 };
      
      // Add transforms for images if specified
      if (transforms && (transforms.width || transforms.height || transforms.quality)) {
        signedUrlOptions.transform = {
          width: transforms.width,
          height: transforms.height,
          quality: transforms.quality || 85,
          resize: 'cover'
        };
      }

      // Add timeout to prevent hanging requests
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Signed URL timeout')), 8000)
      );

      const urlPromise = supabase.storage
        .from('content')
        .createSignedUrl(cleanPath, 3600, signedUrlOptions);

      const { data, error } = await Promise.race([urlPromise, timeoutPromise]);

      if (error) {
        console.error('❌ Failed to generate signed URL:', error);
        // Fallback to public URL (might work for some files)
        const fallbackUrl = `${SUPABASE_URL}/storage/v1/object/public/content/${cleanPath}`;
        console.log('🔄 Using fallback public URL:', fallbackUrl);
        return fallbackUrl;
      }

      if (data?.signedUrl) {
        // Cache the signed URL (expires in 50 minutes, request new at 55 minutes)
        directCache[cacheKey] = {
          url: data.signedUrl,
          expires: Date.now() + (50 * 60 * 1000) // 50 minutes
        };
        
        console.log('✅ Generated signed URL successfully');
        return data.signedUrl;
      }

      throw new Error('No signed URL returned');
    } catch (error) {
      console.error('❌ Direct URL generation failed:', error);
      // Final fallback to public URL
      const cleanPath = path.replace(/^content\//, '');
      const fallbackUrl = `${SUPABASE_URL}/storage/v1/object/public/content/${cleanPath}`;
      console.log('🔄 Using final fallback URL:', fallbackUrl);
      return fallbackUrl;
    }
  }, []);

  return { getDirectUrl };
};