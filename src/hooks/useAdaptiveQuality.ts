import { useState, useEffect, useCallback, useRef } from 'react';
import { useBandwidthDetection } from './useBandwidthDetection';

export type QualityLevel = '240p' | '360p' | '480p' | '720p' | '1080p' | '1440p' | '4K' | 'original';

interface QualityOption {
  level: QualityLevel;
  width: number;
  height: number;
  bitrate: string;
  url?: string;
  loaded?: boolean;
}

interface BufferInfo {
  buffered: number;
  duration: number;
  health: 'critical' | 'low' | 'good' | 'excellent';
}

interface AdaptiveQualityState {
  currentQuality: QualityLevel;
  targetQuality: QualityLevel;
  availableQualities: QualityOption[];
  isAdaptive: boolean;
  manualOverride: QualityLevel | null;
  bufferHealth: BufferInfo;
}

export const useAdaptiveQuality = (mediaId: string, videoElement?: HTMLVideoElement | null) => {
  const { bandwidth, getRecommendedQuality } = useBandwidthDetection();
  const bufferCheckInterval = useRef<NodeJS.Timeout>();
  
  const [state, setState] = useState<AdaptiveQualityState>({
    currentQuality: '480p',
    targetQuality: '480p', 
    availableQualities: [],
    isAdaptive: true,
    manualOverride: null,
    bufferHealth: {
      buffered: 0,
      duration: 0,
      health: 'good'
    }
  });

  // Define quality hierarchy (lowest to highest)
  const qualityHierarchy: QualityLevel[] = ['240p', '360p', '480p', '720p', '1080p', '1440p', '4K'];

  // Get quality URLs from media metadata
  const loadAvailableQualities = useCallback(async () => {
    try {
      // Fetch available qualities from the adaptive media endpoint
      const response = await fetch(`https://alzyzfjzwvofmjccirjq.supabase.co/functions/v1/adaptive-media`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          mediaId,
          format: 'manifest'
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.manifest) {
          const qualities: QualityOption[] = data.manifest.qualities.map((q: any) => ({
            level: q.level as QualityLevel,
            width: q.width,
            height: q.height,
            bitrate: q.bitrate,
            url: q.url,
            loaded: true
          }));

          setState(prev => ({
            ...prev,
            availableQualities: qualities
          }));
          
          return;
        }
      }

      // Fallback to default qualities if manifest fails
      const defaultQualities: QualityOption[] = [
        { level: '240p', width: 426, height: 240, bitrate: '300k' },
        { level: '360p', width: 640, height: 360, bitrate: '500k' },
        { level: '480p', width: 854, height: 480, bitrate: '800k' },
        { level: '720p', width: 1280, height: 720, bitrate: '1500k' },
        { level: '1080p', width: 1920, height: 1080, bitrate: '3000k' }
      ];

      setState(prev => ({
        ...prev,
        availableQualities: defaultQualities
      }));
      
    } catch (error) {
      console.error('Failed to load available qualities:', error);
    }
  }, [mediaId]);

  // Monitor buffer health
  const checkBufferHealth = useCallback(() => {
    if (!videoElement) return;

    try {
      const buffered = videoElement.buffered;
      const currentTime = videoElement.currentTime;
      const duration = videoElement.duration || 0;
      
      let bufferAhead = 0;
      for (let i = 0; i < buffered.length; i++) {
        if (buffered.start(i) <= currentTime && buffered.end(i) > currentTime) {
          bufferAhead = buffered.end(i) - currentTime;
          break;
        }
      }

      const health: BufferInfo['health'] = 
        bufferAhead < 2 ? 'critical' :
        bufferAhead < 5 ? 'low' :
        bufferAhead < 10 ? 'good' : 'excellent';

      setState(prev => ({
        ...prev,
        bufferHealth: {
          buffered: bufferAhead,
          duration,
          health
        }
      }));

      // Auto-adjust quality based on buffer health
      if (state.isAdaptive && !state.manualOverride) {
        if (health === 'critical' && state.currentQuality !== '240p') {
          // Emergency downgrade
          const currentIndex = qualityHierarchy.indexOf(state.currentQuality);
          const newQuality = qualityHierarchy[Math.max(0, currentIndex - 2)];
          setTargetQuality(newQuality);
          console.log(`🚨 Buffer critical, emergency downgrade to ${newQuality}`);
        } else if (health === 'excellent' && bufferAhead > 15) {
          // Can try upgrading
          const recommendedQuality = getRecommendedQuality();
          const currentIndex = qualityHierarchy.indexOf(state.currentQuality);
          const recommendedIndex = qualityHierarchy.indexOf(recommendedQuality as QualityLevel);
          
          if (recommendedIndex > currentIndex) {
            const nextQuality = qualityHierarchy[currentIndex + 1];
            if (nextQuality && state.availableQualities.some(q => q.level === nextQuality)) {
              setTargetQuality(nextQuality);
              console.log(`⬆️ Buffer healthy, upgrading to ${nextQuality}`);
            }
          }
        }
      }

    } catch (error) {
      console.warn('Buffer health check failed:', error);
    }
  }, [videoElement, state.isAdaptive, state.manualOverride, state.currentQuality, getRecommendedQuality]);

  // Set target quality (will trigger quality switch)
  const setTargetQuality = useCallback((quality: QualityLevel) => {
    setState(prev => ({
      ...prev,
      targetQuality: quality
    }));
  }, []);

  // Manual quality override
  const setManualQuality = useCallback((quality: QualityLevel | null) => {
    setState(prev => ({
      ...prev,
      manualOverride: quality,
      isAdaptive: quality === null
    }));
    
    if (quality) {
      setTargetQuality(quality);
    }
  }, [setTargetQuality]);

  // Get URL for specific quality
  const getQualityUrl = useCallback(async (quality: QualityLevel): Promise<string | null> => {
    try {
      const response = await fetch(`https://alzyzfjzwvofmjccirjq.supabase.co/functions/v1/adaptive-media`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          mediaId,
          quality,
          expiresIn: 3600,
          format: 'url'
        })
      });

      if (!response.ok) return null;
      
      const data = await response.json();
      return data.success ? data.signedUrl : null;
    } catch (error) {
      console.error(`Failed to get URL for ${quality}:`, error);
      return null;
    }
  }, [mediaId]);

  // Switch to new quality
  const switchToQuality = useCallback(async (quality: QualityLevel) => {
    if (!videoElement) return false;

    try {
      const qualityUrl = await getQualityUrl(quality);
      if (!qualityUrl) return false;

      const currentTime = videoElement.currentTime;
      const wasPlaying = !videoElement.paused;
      
      // Preload new quality
      const newVideo = document.createElement('video');
      newVideo.src = qualityUrl;
      newVideo.currentTime = currentTime;
      newVideo.preload = 'auto';
      
      // Wait for enough buffering
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Preload timeout')), 10000);
        
        newVideo.addEventListener('canplaythrough', () => {
          clearTimeout(timeout);
          resolve(true);
        });
        
        newVideo.addEventListener('error', () => {
          clearTimeout(timeout);
          reject(new Error('Preload failed'));
        });
      });

      // Seamless switch
      videoElement.src = qualityUrl;
      videoElement.currentTime = currentTime;
      
      if (wasPlaying) {
        await videoElement.play();
      }

      setState(prev => ({
        ...prev,
        currentQuality: quality
      }));

      console.log(`✅ Quality switched to ${quality}`);
      return true;

    } catch (error) {
      console.error(`Failed to switch to ${quality}:`, error);
      return false;
    }
  }, [videoElement, getQualityUrl]);

  // Initialize with bandwidth-based quality
  useEffect(() => {
    if (state.availableQualities.length > 0 && !state.manualOverride) {
      const recommended = getRecommendedQuality() as QualityLevel;
      const available = state.availableQualities.find(q => q.level === recommended);
      
      if (available) {
        setTargetQuality(recommended);
      } else {
        // Fall back to lowest available quality
        const lowest = state.availableQualities[0];
        if (lowest) {
          setTargetQuality(lowest.level);
        }
      }
    }
  }, [state.availableQualities, getRecommendedQuality, state.manualOverride, setTargetQuality]);

  // Handle quality switching when target changes
  useEffect(() => {
    if (state.targetQuality !== state.currentQuality) {
      const switchDelay = state.bufferHealth.health === 'critical' ? 0 : 2000;
      
      const timeout = setTimeout(() => {
        switchToQuality(state.targetQuality);
      }, switchDelay);

      return () => clearTimeout(timeout);
    }
  }, [state.targetQuality, state.currentQuality, state.bufferHealth.health, switchToQuality]);

  // Start buffer monitoring
  useEffect(() => {
    if (videoElement) {
      bufferCheckInterval.current = setInterval(checkBufferHealth, 1000);
      
      return () => {
        if (bufferCheckInterval.current) {
          clearInterval(bufferCheckInterval.current);
        }
      };
    }
  }, [videoElement, checkBufferHealth]);

  // Load available qualities on mount
  useEffect(() => {
    loadAvailableQualities();
  }, [loadAvailableQualities]);

  return {
    ...state,
    setTargetQuality,
    setManualQuality,
    getQualityUrl,
    switchToQuality,
    bandwidth
  };
};