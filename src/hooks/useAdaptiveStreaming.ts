import { useState, useEffect, useCallback, useRef } from 'react';
import { useNetworkMonitor, NetworkStatus } from './useNetworkMonitor';
import { QualityLevel } from './useSmartQuality';

interface AdaptiveConfig {
  enableAutoSwitch: boolean;
  bufferHealthThreshold: number; // Seconds of buffer below which we downgrade
  upgradeDelayMs: number; // Wait time before upgrading quality
  downgradeDelayMs: number; // Wait time before downgrading quality
  minStablePeriodMs: number; // Minimum stable period before quality changes
}

interface BufferHealth {
  buffered: number; // Seconds of buffered content
  currentTime: number;
  duration: number;
  isBuffering: boolean;
  bufferRatio: number; // Percentage of total duration buffered
}

interface QualityDecision {
  recommendedQuality: QualityLevel;
  reason: 'bandwidth' | 'buffer' | 'stability' | 'user' | 'initial';
  confidence: number; // 0-1 scale
  shouldSwitch: boolean;
}

const QUALITY_BANDWIDTH_MAP: Record<QualityLevel, number> = {
  '360p': 0.8,   // 0.8 Mbps
  '480p': 1.5,   // 1.5 Mbps
  '720p': 4.0,   // 4 Mbps
  '1080p': 8.0,  // 8 Mbps
  '1440p': 16.0, // 16 Mbps
  '4k': 35.0     // 35 Mbps
};

const DEFAULT_CONFIG: AdaptiveConfig = {
  enableAutoSwitch: true,
  bufferHealthThreshold: 3, // 3 seconds
  upgradeDelayMs: 10000,    // 10 seconds
  downgradeDelayMs: 3000,   // 3 seconds
  minStablePeriodMs: 5000   // 5 seconds
};

export const useAdaptiveStreaming = (
  videoElement: HTMLVideoElement | null,
  availableQualities: QualityLevel[],
  config: Partial<AdaptiveConfig> = {}
) => {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const { networkStatus, measureBandwidth } = useNetworkMonitor();
  
  const [currentQuality, setCurrentQuality] = useState<QualityLevel>('720p');
  const [bufferHealth, setBufferHealth] = useState<BufferHealth>({
    buffered: 0,
    currentTime: 0,
    duration: 0,
    isBuffering: false,
    bufferRatio: 0
  });
  
  const [lastQualityChange, setLastQualityChange] = useState<Date>(new Date());
  const [qualityHistory, setQualityHistory] = useState<Array<{ quality: QualityLevel; timestamp: Date; reason: string }>>([]);
  const [adaptiveEnabled, setAdaptiveEnabled] = useState(fullConfig.enableAutoSwitch);
  
  const lastDecisionRef = useRef<QualityDecision | null>(null);
  const bandwidthSamplesRef = useRef<number[]>([]);
  
  // Calculate buffer health
  const updateBufferHealth = useCallback(() => {
    if (!videoElement) return;
    
    try {
      const buffered = videoElement.buffered;
      const currentTime = videoElement.currentTime;
      const duration = videoElement.duration || 0;
      const isBuffering = videoElement.readyState < 3; // HAVE_FUTURE_DATA
      
      let totalBuffered = 0;
      for (let i = 0; i < buffered.length; i++) {
        const start = buffered.start(i);
        const end = buffered.end(i);
        
        // Only count buffered ranges ahead of current time
        if (end > currentTime) {
          totalBuffered += end - Math.max(start, currentTime);
        }
      }
      
      setBufferHealth({
        buffered: totalBuffered,
        currentTime,
        duration,
        isBuffering,
        bufferRatio: duration > 0 ? (totalBuffered / duration) * 100 : 0
      });
    } catch (error) {
      console.warn('Error calculating buffer health:', error);
    }
  }, [videoElement]);
  
  // Get optimal quality based on network and buffer conditions
  const getOptimalQuality = useCallback((
    networkStatus: NetworkStatus,
    bufferHealth: BufferHealth,
    currentQuality: QualityLevel
  ): QualityDecision => {
    if (!adaptiveEnabled || availableQualities.length === 0) {
      return {
        recommendedQuality: currentQuality,
        reason: 'user',
        confidence: 1,
        shouldSwitch: false
      };
    }
    
    const sortedQualities = [...availableQualities].sort((a, b) => {
      return QUALITY_BANDWIDTH_MAP[a] - QUALITY_BANDWIDTH_MAP[b];
    });
    
    const currentBandwidth = networkStatus.quality.downlink || 1;
    const isStable = networkStatus.isStable;
    const timeSinceLastChange = Date.now() - lastQualityChange.getTime();
    
    // Buffer-based decisions (urgent)
    if (bufferHealth.isBuffering || bufferHealth.buffered < fullConfig.bufferHealthThreshold) {
      const currentIndex = sortedQualities.indexOf(currentQuality);
      if (currentIndex > 0) {
        return {
          recommendedQuality: sortedQualities[Math.max(0, currentIndex - 1)],
          reason: 'buffer',
          confidence: 0.9,
          shouldSwitch: timeSinceLastChange > fullConfig.downgradeDelayMs
        };
      }
    }
    
    // Bandwidth-based decisions
    let optimalQuality = sortedQualities[0]; // Start with lowest
    
    for (const quality of sortedQualities) {
      const requiredBandwidth = QUALITY_BANDWIDTH_MAP[quality];
      const safetyMargin = isStable ? 1.2 : 1.5; // More conservative if unstable
      
      if (currentBandwidth > requiredBandwidth * safetyMargin) {
        optimalQuality = quality;
      } else {
        break;
      }
    }
    
    // Determine if we should switch
    const currentQualityBandwidth = QUALITY_BANDWIDTH_MAP[currentQuality];
    const optimalQualityBandwidth = QUALITY_BANDWIDTH_MAP[optimalQuality];
    
    let shouldSwitch = false;
    let reason: QualityDecision['reason'] = 'bandwidth';
    
    if (optimalQualityBandwidth > currentQualityBandwidth) {
      // Upgrade: be more conservative
      shouldSwitch = timeSinceLastChange > fullConfig.upgradeDelayMs && 
                    isStable && 
                    bufferHealth.buffered > fullConfig.bufferHealthThreshold * 2;
    } else if (optimalQualityBandwidth < currentQualityBandwidth) {
      // Downgrade: be more aggressive
      shouldSwitch = timeSinceLastChange > fullConfig.downgradeDelayMs;
    }
    
    // Stability check
    if (!isStable && shouldSwitch && optimalQualityBandwidth > currentQualityBandwidth) {
      shouldSwitch = false;
      reason = 'stability';
    }
    
    const confidence = isStable ? 
      Math.min(currentBandwidth / (optimalQualityBandwidth * 1.2), 1) : 0.5;
    
    return {
      recommendedQuality: optimalQuality,
      reason,
      confidence,
      shouldSwitch: shouldSwitch && optimalQuality !== currentQuality
    };
  }, [adaptiveEnabled, availableQualities, fullConfig, lastQualityChange]);
  
  // Execute quality switch
  const switchQuality = useCallback((
    newQuality: QualityLevel, 
    reason: string,
    forced = false
  ) => {
    if (!forced && newQuality === currentQuality) return;
    
    setCurrentQuality(newQuality);
    setLastQualityChange(new Date());
    
    setQualityHistory(prev => [
      ...prev.slice(-9), // Keep last 10 entries
      { quality: newQuality, timestamp: new Date(), reason }
    ]);
  }, [currentQuality]);
  
  // Main adaptive logic
  useEffect(() => {
    if (!videoElement || !adaptiveEnabled) return;
    
    const decision = getOptimalQuality(networkStatus, bufferHealth, currentQuality);
    lastDecisionRef.current = decision;
    
    if (decision.shouldSwitch) {
      switchQuality(decision.recommendedQuality, decision.reason);
    }
  }, [networkStatus, bufferHealth, currentQuality, getOptimalQuality, switchQuality, videoElement, adaptiveEnabled]);
  
  // Monitor buffer health
  useEffect(() => {
    if (!videoElement) return;
    
    const interval = setInterval(updateBufferHealth, 1000);
    
    const handleWaiting = () => updateBufferHealth();
    const handleCanPlay = () => updateBufferHealth();
    const handleProgress = () => updateBufferHealth();
    
    videoElement.addEventListener('waiting', handleWaiting);
    videoElement.addEventListener('canplay', handleCanPlay);
    videoElement.addEventListener('progress', handleProgress);
    
    return () => {
      clearInterval(interval);
      videoElement.removeEventListener('waiting', handleWaiting);
      videoElement.removeEventListener('canplay', handleCanPlay);
      videoElement.removeEventListener('progress', handleProgress);
    };
  }, [videoElement, updateBufferHealth]);
  
  // Manual quality override
  const setManualQuality = useCallback((quality: QualityLevel) => {
    switchQuality(quality, 'user', true);
    setAdaptiveEnabled(false);
  }, [switchQuality]);
  
  // Enable auto mode
  const enableAutoMode = useCallback(() => {
    setAdaptiveEnabled(true);
  }, []);
  
  // Get current stats for debugging
  const getStats = useCallback(() => ({
    currentQuality,
    networkStatus,
    bufferHealth,
    lastDecision: lastDecisionRef.current,
    qualityHistory: qualityHistory.slice(-5),
    adaptiveEnabled,
    timeSinceLastChange: Date.now() - lastQualityChange.getTime()
  }), [currentQuality, networkStatus, bufferHealth, qualityHistory, adaptiveEnabled, lastQualityChange]);
  
  return {
    currentQuality,
    recommendedQuality: lastDecisionRef.current?.recommendedQuality || currentQuality,
    bufferHealth,
    networkStatus,
    adaptiveEnabled,
    qualityHistory,
    setManualQuality,
    enableAutoMode,
    switchQuality,
    getStats,
    lastDecision: lastDecisionRef.current
  };
};