import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOptimizedSecureMedia } from './useOptimizedSecureMedia';

interface VideoQualityInfo {
  quality: string;
  url: string;
  width: number;
  height: number;
  bitrate_kbps: number;
  file_size_bytes: number;
}

export const useVideoQualityLoader = (mediaId: string | undefined) => {
  const [availableQualities, setAvailableQualities] = useState<VideoQualityInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const { getSecureUrl } = useOptimizedSecureMedia();

  const loadQualities = useCallback(async () => {
    if (!mediaId) return;

    setLoading(true);
    try {
      // Get quality metadata from database
      const { data: qualityData, error } = await supabase
        .from('quality_metadata')
        .select('*')
        .eq('media_id', mediaId)
        .order('height', { ascending: false });

      if (error) {
        console.error('Failed to load quality metadata:', error);
        return;
      }

      if (qualityData && qualityData.length > 0) {
        // Generate secure URLs for each quality
        const qualities = await Promise.all(
          qualityData.map(async (quality) => {
            const url = await getSecureUrl(quality.storage_path, {}, 'normal');
            return {
              quality: quality.quality,
              url: url || '',
              width: quality.width || 0,
              height: quality.height || 0,
              bitrate_kbps: quality.bitrate_kbps || 0,
              file_size_bytes: quality.file_size_bytes || 0
            };
          })
        );

        setAvailableQualities(qualities.filter(q => q.url));
      }
    } catch (error) {
      console.error('Error loading video qualities:', error);
    } finally {
      setLoading(false);
    }
  }, [mediaId, getSecureUrl]);

  const getQualityByHeight = useCallback((targetHeight: number) => {
    if (availableQualities.length === 0) return null;
    
    // Find the closest quality that doesn't exceed target height
    const suitable = availableQualities
      .filter(q => q.height <= targetHeight)
      .sort((a, b) => b.height - a.height);
    
    return suitable[0] || availableQualities[availableQualities.length - 1];
  }, [availableQualities]);

  return {
    availableQualities,
    loading,
    loadQualities,
    getQualityByHeight
  };
};