import { useState, useEffect, useCallback } from 'react';

interface BandwidthInfo {
  speed: number; // Mbps
  quality: 'slow' | 'medium' | 'fast';
  timestamp: number;
}

interface NetworkInfo {
  effectiveType?: '2g' | '3g' | '4g';
  downlink?: number;
  rtt?: number;
}

export const useBandwidthDetection = () => {
  const [bandwidth, setBandwidth] = useState<BandwidthInfo>({
    speed: 5, // Default to medium speed
    quality: 'medium',
    timestamp: Date.now()
  });
  
  const [isDetecting, setIsDetecting] = useState(false);

  // Get network quality from browser API if available
  const getNetworkInfo = useCallback((): NetworkInfo => {
    const nav = navigator as any;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    
    return {
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink, // Mbps
      rtt: connection?.rtt // ms
    };
  }, []);

  // Perform actual bandwidth test using small video chunk
  const measureBandwidth = useCallback(async (): Promise<number> => {
    setIsDetecting(true);
    
    try {
      // Use a small test file (1MB video chunk) for speed measurement
      const testUrl = '/test-chunk.mp4'; // We'll need to create this
      const startTime = performance.now();
      
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      if (!response.ok) {
        throw new Error('Test file not available');
      }
      
      const blob = await response.blob();
      const endTime = performance.now();
      
      const duration = (endTime - startTime) / 1000; // seconds
      const fileSizeMB = blob.size / (1024 * 1024);
      const speedMbps = (fileSizeMB * 8) / duration; // Convert to Mbps
      
      return Math.max(0.1, speedMbps); // Minimum 0.1 Mbps
    } catch (error) {
      console.warn('Bandwidth measurement failed, using network API fallback:', error);
      
      // Fallback to browser network API
      const networkInfo = getNetworkInfo();
      if (networkInfo.downlink) {
        return networkInfo.downlink;
      }
      
      // Final fallback based on connection type
      if (networkInfo.effectiveType) {
        const speedMap = {
          '2g': 0.5,
          '3g': 2,
          '4g': 10
        };
        return speedMap[networkInfo.effectiveType];
      }
      
      return 5; // Conservative default
    } finally {
      setIsDetecting(false);
    }
  }, [getNetworkInfo]);

  // Classify speed into quality tiers
  const classifySpeed = useCallback((speed: number): 'slow' | 'medium' | 'fast' => {
    if (speed < 1.5) return 'slow';   // <1.5 Mbps - 240p/360p
    if (speed < 5) return 'medium';   // 1.5-5 Mbps - 480p/720p  
    return 'fast';                    // >5 Mbps - 1080p+
  }, []);

  // Update bandwidth info
  const updateBandwidth = useCallback(async () => {
    const speed = await measureBandwidth();
    const quality = classifySpeed(speed);
    
    setBandwidth({
      speed,
      quality,
      timestamp: Date.now()
    });
    
    console.log(`📊 Bandwidth detected: ${speed.toFixed(2)} Mbps (${quality})`);
  }, [measureBandwidth, classifySpeed]);

  // Get recommended quality based on current bandwidth
  const getRecommendedQuality = useCallback(() => {
    const { speed, quality } = bandwidth;
    
    // Map bandwidth to specific quality levels
    if (quality === 'slow') {
      return speed < 0.8 ? '240p' : '360p';
    }
    if (quality === 'medium') {
      return speed < 3 ? '480p' : '720p';
    }
    // fast
    return speed > 15 ? '1080p' : '720p';
  }, [bandwidth]);

  // Auto-detect on mount and periodically
  useEffect(() => {
    // Only run once on mount to prevent infinite loops
    let hasRun = false;
    
    const runInitialDetection = async () => {
      if (hasRun) return;
      hasRun = true;
      
      try {
        await updateBandwidth();
      } catch (error) {
        console.warn('Initial bandwidth detection failed:', error);
      }
    };
    
    runInitialDetection();
    
    // Listen for network changes only
    const handleOnline = () => {
      setBandwidth(prev => ({ ...prev, speed: 5, quality: 'medium' }));
    };
    const handleOffline = () => {
      setBandwidth(prev => ({ ...prev, speed: 0.1, quality: 'slow' }));
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []); // Remove bandwidth.timestamp dependency to prevent loop

  return {
    bandwidth,
    isDetecting,
    getRecommendedQuality,
    updateBandwidth,
    getNetworkInfo
  };
};