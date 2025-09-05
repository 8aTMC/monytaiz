import { useState, useEffect, useCallback, useRef } from 'react';

export interface NetworkQuality {
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';
  downlink: number; // Mbps
  rtt: number; // Round trip time in ms
  saveData: boolean;
}

export interface NetworkStatus {
  isOnline: boolean;
  quality: NetworkQuality;
  speed: 'fast' | 'medium' | 'slow' | 'very-slow';
  lastMeasured: Date;
  isStable: boolean;
}

interface NetworkConnection extends EventTarget {
  effectiveType?: '4g' | '3g' | '2g' | 'slow-2g';
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

declare global {
  interface Navigator {
    connection?: NetworkConnection;
    mozConnection?: NetworkConnection;
    webkitConnection?: NetworkConnection;
  }
}

export const useNetworkMonitor = () => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    quality: {
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0,
      saveData: false
    },
    speed: 'medium',
    lastMeasured: new Date(),
    isStable: true
  });

  const [measurements, setMeasurements] = useState<number[]>([]);
  const measurementRef = useRef<number[]>([]);

  const getNetworkConnection = useCallback((): NetworkConnection | null => {
    return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  }, []);

  const categorizeSpeed = useCallback((downlink: number): 'fast' | 'medium' | 'slow' | 'very-slow' => {
    if (downlink >= 10) return 'fast';
    if (downlink >= 4) return 'medium';
    if (downlink >= 1.5) return 'slow';
    return 'very-slow';
  }, []);

  const isConnectionStable = useCallback((measurements: number[]): boolean => {
    if (measurements.length < 3) return true;
    
    const recent = measurements.slice(-3);
    const avg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const variance = recent.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / recent.length;
    
    // Connection is stable if variance is low relative to average
    return variance / avg < 0.3;
  }, []);

  const updateNetworkStatus = useCallback(() => {
    const connection = getNetworkConnection();
    const isOnline = navigator.onLine;

    if (connection) {
      const quality: NetworkQuality = {
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 0,
        rtt: connection.rtt || 0,
        saveData: connection.saveData || false
      };

      const speed = categorizeSpeed(quality.downlink);
      
      // Track measurements for stability analysis
      measurementRef.current.push(quality.downlink);
      if (measurementRef.current.length > 10) {
        measurementRef.current = measurementRef.current.slice(-10);
      }

      const isStable = isConnectionStable(measurementRef.current);

      setNetworkStatus({
        isOnline,
        quality,
        speed,
        lastMeasured: new Date(),
        isStable
      });

      setMeasurements([...measurementRef.current]);
    } else {
      // Fallback when Network Information API is not available
      setNetworkStatus(prev => ({
        ...prev,
        isOnline,
        lastMeasured: new Date()
      }));
    }
  }, [getNetworkConnection, categorizeSpeed, isConnectionStable]);

  // Manual bandwidth test using a small resource
  const measureBandwidth = useCallback(async (): Promise<number> => {
    try {
      const testUrl = '/favicon.ico'; // Small file for testing
      const startTime = performance.now();
      
      const response = await fetch(`${testUrl}?t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-cache'
      });

      if (!response.ok) throw new Error('Network test failed');

      await response.blob();
      const endTime = performance.now();
      const duration = (endTime - startTime) / 1000; // Convert to seconds
      const sizeBytes = parseInt(response.headers.get('content-length') || '1024');
      const sizeMB = sizeBytes / (1024 * 1024);
      const speedMbps = (sizeMB * 8) / duration; // Convert to Mbps

      return Math.max(speedMbps, 0.1); // Minimum 0.1 Mbps
    } catch (error) {
      console.warn('Bandwidth measurement failed:', error);
      return 1; // Fallback speed
    }
  }, []);

  // Monitor network changes
  useEffect(() => {
    const connection = getNetworkConnection();

    updateNetworkStatus();

    const handleOnline = () => updateNetworkStatus();
    const handleOffline = () => updateNetworkStatus();
    const handleConnectionChange = () => updateNetworkStatus();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    // Periodic updates every 30 seconds
    const interval = setInterval(updateNetworkStatus, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
      
      clearInterval(interval);
    };
  }, [updateNetworkStatus, getNetworkConnection]);

  return {
    networkStatus,
    measurements,
    updateNetworkStatus,
    measureBandwidth,
    isSupported: !!getNetworkConnection()
  };
};