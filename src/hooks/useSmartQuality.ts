import { useState, useEffect, useMemo } from 'react';

export type QualityLevel = '360p' | '480p' | '720p' | '1080p' | '1440p' | '4k';

interface SmartQualityConfig {
  auto: boolean;
  preferred: QualityLevel;
  availableQualities: QualityLevel[];
}

interface QualityMetrics {
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  connection: 'slow' | 'fast' | 'unknown';
}

const getOptimalQuality = (metrics: QualityMetrics): QualityLevel => {
  const { screenWidth, screenHeight, pixelRatio, connection } = metrics;
  const effectiveWidth = screenWidth * pixelRatio;
  const effectiveHeight = screenHeight * pixelRatio;
  
  // Prioritize performance for mobile and slow connections
  if (connection === 'slow' || screenWidth < 768) {
    return effectiveWidth <= 640 ? '360p' : '480p';
  }
  
  // Desktop optimization based on actual screen resolution
  if (effectiveWidth >= 3840 && effectiveHeight >= 2160) return '4k';
  if (effectiveWidth >= 2560 && effectiveHeight >= 1440) return '1440p';
  if (effectiveWidth >= 1920 && effectiveHeight >= 1080) return '1080p';
  if (effectiveWidth >= 1280 && effectiveHeight >= 720) return '720p';
  
  return '720p'; // Safe default
};

const detectConnection = (): 'slow' | 'fast' | 'unknown' => {
  const navigator = window.navigator as any;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  
  if (!connection) return 'unknown';
  
  // Consider slow: 2G, slow-2g, or effective type slow-2g/2g
  if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
    return 'slow';
  }
  
  // Consider fast: 4G
  if (connection.effectiveType === '4g' || connection.downlink > 10) {
    return 'fast';
  }
  
  return 'unknown';
};

export const useSmartQuality = (initialConfig?: Partial<SmartQualityConfig>) => {
  const [config, setConfig] = useState<SmartQualityConfig>({
    auto: true,
    preferred: '720p',
    availableQualities: ['360p', '480p', '720p', '1080p'],
    ...initialConfig
  });

  const metrics = useMemo((): QualityMetrics => ({
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    pixelRatio: window.devicePixelRatio || 1,
    connection: detectConnection()
  }), []);

  const optimalQuality = useMemo(() => {
    if (!config.auto) return config.preferred;
    return getOptimalQuality(metrics);
  }, [config.auto, config.preferred, metrics]);

  const selectedQuality = useMemo(() => {
    // Ensure the optimal quality is available, fallback to closest available
    if (config.availableQualities.includes(optimalQuality)) {
      return optimalQuality;
    }
    
    // Fallback logic - find closest available quality
    const qualityOrder: QualityLevel[] = ['360p', '480p', '720p', '1080p', '1440p', '4k'];
    const optimalIndex = qualityOrder.indexOf(optimalQuality);
    
    // Look for closest available quality
    for (let i = 0; i < qualityOrder.length; i++) {
      const lowerQuality = qualityOrder[Math.max(0, optimalIndex - i)];
      const higherQuality = qualityOrder[Math.min(qualityOrder.length - 1, optimalIndex + i)];
      
      if (config.availableQualities.includes(lowerQuality)) return lowerQuality;
      if (config.availableQualities.includes(higherQuality)) return higherQuality;
    }
    
    return config.availableQualities[0] || '720p';
  }, [optimalQuality, config.availableQualities]);

  // Listen for viewport changes
  useEffect(() => {
    const handleResize = () => {
      // Force re-evaluation on significant size changes
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      
      if (Math.abs(newWidth - metrics.screenWidth) > 100 || 
          Math.abs(newHeight - metrics.screenHeight) > 100) {
        // Trigger re-render by updating config
        setConfig(prev => ({ ...prev }));
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [metrics.screenWidth, metrics.screenHeight]);

  const setQuality = (quality: QualityLevel) => {
    setConfig(prev => ({
      ...prev,
      auto: false,
      preferred: quality
    }));
  };

  const enableAutoQuality = () => {
    setConfig(prev => ({ ...prev, auto: true }));
  };

  return {
    selectedQuality,
    optimalQuality,
    metrics,
    config,
    setQuality,
    enableAutoQuality,
    isAutoMode: config.auto
  };
};