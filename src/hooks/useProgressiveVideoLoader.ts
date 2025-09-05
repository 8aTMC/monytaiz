import { useState, useCallback, useEffect, useRef } from 'react';
import { useVideoQualityLoader } from './useVideoQualityLoader';
import { QualityLevel } from './useSmartQuality';

interface ProgressiveLoadingState {
  currentQuality: string | null;
  targetQuality: string | null;
  isUpgrading: boolean;
  preloadedQualities: string[];
  loadingProgress: number;
}

interface QualityTransition {
  from: string;
  to: string;
  timestamp: number;
}

export const useProgressiveVideoLoader = (
  mediaId: string | undefined,
  targetQuality: QualityLevel,
  videoRef: React.RefObject<HTMLVideoElement>
) => {
  const [loadingState, setLoadingState] = useState<ProgressiveLoadingState>({
    currentQuality: null,
    targetQuality: null,
    isUpgrading: false,
    preloadedQualities: [],
    loadingProgress: 0
  });

  const [recentTransitions, setRecentTransitions] = useState<QualityTransition[]>([]);
  const preloadCacheRef = useRef<Map<string, string>>(new Map());
  const upgradeTimeoutRef = useRef<NodeJS.Timeout>();

  const { availableQualities, getQualityByHeight, loading } = useVideoQualityLoader(mediaId);

  // Get quality order from lowest to highest
  const qualityOrder = ['360p', '480p', '720p', '1080p', '1440p', '4k'];
  
  const getQualityHeight = (quality: string) => {
    return parseInt(quality.replace('p', ''));
  };

  const sortQualitiesByHeight = useCallback((qualities: any[]) => {
    return qualities.sort((a, b) => getQualityHeight(a.quality) - getQualityHeight(b.quality));
  }, []);

  // Get the best starting quality (lowest available)
  const getStartingQuality = useCallback(() => {
    if (!availableQualities.length) return null;
    const sorted = sortQualitiesByHeight(availableQualities);
    return sorted[0];
  }, [availableQualities, sortQualitiesByHeight]);

  // Get target quality based on user selection
  const getTargetQuality = useCallback(() => {
    if (!availableQualities.length) return null;
    
    const targetHeight = targetQuality === '360p' ? 360 :
                        targetQuality === '480p' ? 480 :
                        targetQuality === '720p' ? 720 :
                        targetQuality === '1080p' ? 1080 :
                        targetQuality === '1440p' ? 1440 :
                        targetQuality === '4k' ? 2160 : 720;
    
    return getQualityByHeight(targetHeight);
  }, [availableQualities, targetQuality, getQualityByHeight]);

  // Preload a specific quality
  const preloadQuality = useCallback(async (qualityUrl: string, qualityName: string) => {
    if (preloadCacheRef.current.has(qualityName)) return;

    try {
      console.log(`🔄 Preloading ${qualityName}...`);
      
      // Create invisible video element for preloading
      const preloadVideo = document.createElement('video');
      preloadVideo.preload = 'auto';
      preloadVideo.muted = true;
      
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          preloadVideo.remove();
          reject(new Error(`Preload timeout for ${qualityName}`));
        }, 30000); // 30 second timeout

        preloadVideo.addEventListener('canplay', () => {
          clearTimeout(timeout);
          preloadCacheRef.current.set(qualityName, qualityUrl);
          setLoadingState(prev => ({
            ...prev,
            preloadedQualities: [...prev.preloadedQualities, qualityName]
          }));
          preloadVideo.remove();
          console.log(`✅ Preloaded ${qualityName}`);
          resolve();
        });

        preloadVideo.addEventListener('error', () => {
          clearTimeout(timeout);
          preloadVideo.remove();
          console.warn(`❌ Failed to preload ${qualityName}`);
          reject(new Error(`Failed to preload ${qualityName}`));
        });

        preloadVideo.src = qualityUrl;
      });
    } catch (error) {
      console.warn(`Preload failed for ${qualityName}:`, error);
    }
  }, []);

  // Seamlessly switch video quality
  const switchQuality = useCallback(async (newQuality: any) => {
    if (!videoRef.current || !newQuality) return false;

    const video = videoRef.current;
    const currentTime = video.currentTime;
    const wasPlaying = !video.paused;
    const currentVolume = video.volume;
    const wasMuted = video.muted;

    try {
      console.log(`🔄 Switching to ${newQuality.quality}...`);
      
      setLoadingState(prev => ({
        ...prev,
        isUpgrading: true,
        targetQuality: newQuality.quality
      }));

      // Use preloaded URL if available, otherwise use direct URL
      const qualityUrl = preloadCacheRef.current.get(newQuality.quality) || newQuality.url;
      
      // Switch video source
      video.src = qualityUrl;
      video.currentTime = currentTime;
      video.volume = currentVolume;
      video.muted = wasMuted;

      // Wait for video to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Quality switch timeout'));
        }, 10000);

        const handleCanPlay = () => {
          clearTimeout(timeout);
          video.removeEventListener('canplay', handleCanPlay);
          video.removeEventListener('error', handleError);
          resolve();
        };

        const handleError = () => {
          clearTimeout(timeout);
          video.removeEventListener('canplay', handleCanPlay);
          video.removeEventListener('error', handleError);
          reject(new Error('Quality switch failed'));
        };

        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('error', handleError);
        video.load();
      });

      // Resume playback if it was playing
      if (wasPlaying) {
        await video.play();
      }

      // Update state and track transition
      setLoadingState(prev => ({
        ...prev,
        currentQuality: newQuality.quality,
        isUpgrading: false,
        loadingProgress: 100
      }));

      setRecentTransitions(prev => [
        ...prev.slice(-2), // Keep last 3 transitions
        {
          from: loadingState.currentQuality || 'initial',
          to: newQuality.quality,
          timestamp: Date.now()
        }
      ]);

      console.log(`✅ Successfully switched to ${newQuality.quality}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to switch to ${newQuality.quality}:`, error);
      setLoadingState(prev => ({
        ...prev,
        isUpgrading: false
      }));
      return false;
    }
  }, [videoRef, loadingState.currentQuality]);

  // Progressive loading logic
  const startProgressiveLoading = useCallback(async () => {
    if (!availableQualities.length || loading) return;

    const startingQuality = getStartingQuality();
    const finalTargetQuality = getTargetQuality();

    if (!startingQuality || !finalTargetQuality) return;

    console.log(`🚀 Starting progressive loading: ${startingQuality.quality} → ${finalTargetQuality.quality}`);

    // Start with lowest quality immediately
    await switchQuality(startingQuality);

    // If we're already at target quality, no need to upgrade
    if (startingQuality.quality === finalTargetQuality.quality) return;

    // Start preloading higher qualities in background
    const sorted = sortQualitiesByHeight(availableQualities);
    const currentIndex = sorted.findIndex(q => q.quality === startingQuality.quality);
    const targetIndex = sorted.findIndex(q => q.quality === finalTargetQuality.quality);

    // Preload intermediate qualities
    for (let i = currentIndex + 1; i <= targetIndex; i++) {
      const quality = sorted[i];
      if (quality) {
        preloadQuality(quality.url, quality.quality).catch(console.warn);
      }
    }

    // Wait a bit for initial playback to stabilize, then upgrade
    upgradeTimeoutRef.current = setTimeout(() => {
      if (preloadCacheRef.current.has(finalTargetQuality.quality) || finalTargetQuality.url) {
        switchQuality(finalTargetQuality);
      }
    }, 2000); // Wait 2 seconds before upgrading

  }, [availableQualities, loading, getStartingQuality, getTargetQuality, switchQuality, sortQualitiesByHeight, preloadQuality]);

  // Start progressive loading when qualities are available
  useEffect(() => {
    if (availableQualities.length > 0 && !loadingState.currentQuality) {
      startProgressiveLoading();
    }
  }, [availableQualities, loadingState.currentQuality, startProgressiveLoading]);

  // Update target when user changes quality selection
  useEffect(() => {
    const newTarget = getTargetQuality();
    if (newTarget && loadingState.currentQuality && newTarget.quality !== loadingState.currentQuality) {
      // User manually changed quality - switch immediately
      clearTimeout(upgradeTimeoutRef.current);
      switchQuality(newTarget);
    }
  }, [targetQuality, getTargetQuality, loadingState.currentQuality, switchQuality]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (upgradeTimeoutRef.current) {
        clearTimeout(upgradeTimeoutRef.current);
      }
    };
  }, []);

  const getCurrentVideoUrl = useCallback(() => {
    const current = availableQualities.find(q => q.quality === loadingState.currentQuality);
    return current?.url || '';
  }, [availableQualities, loadingState.currentQuality]);

  return {
    loadingState,
    recentTransitions,
    getCurrentVideoUrl,
    switchQuality,
    startProgressiveLoading,
    isReady: availableQualities.length > 0 && loadingState.currentQuality !== null
  };
};