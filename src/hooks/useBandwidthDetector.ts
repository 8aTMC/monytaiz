import { useState, useCallback, useRef, useEffect } from 'react';

interface BandwidthMeasurement {
  speedMbps: number;
  latencyMs: number;
  timestamp: Date;
  testSize: number;
  testDuration: number;
}

interface BandwidthStats {
  current: number;
  average: number;
  min: number;
  max: number;
  samples: number;
  reliability: 'high' | 'medium' | 'low';
}

const BANDWIDTH_TEST_SIZES = [
  { name: 'small', url: '/favicon.ico', expectedSize: 1024 },
  { name: 'medium', url: '/manifest.json', expectedSize: 2048 },
  // Add more test resources as needed
];

export const useBandwidthDetector = () => {
  const [measurements, setMeasurements] = useState<BandwidthMeasurement[]>([]);
  const [isTestingBandwidth, setIsTestingBandwidth] = useState(false);
  const [stats, setStats] = useState<BandwidthStats>({
    current: 0,
    average: 0,
    min: 0,
    max: 0,
    samples: 0,
    reliability: 'low'
  });

  const measurementsRef = useRef<BandwidthMeasurement[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Single bandwidth measurement
  const measureBandwidth = useCallback(async (
    testResource = BANDWIDTH_TEST_SIZES[0],
    timeout = 10000
  ): Promise<BandwidthMeasurement | null> => {
    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const startTime = performance.now();
      
      // Measure latency first with a HEAD request
      const latencyStart = performance.now();
      await fetch(testResource.url, {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      });
      const latency = performance.now() - latencyStart;

      // Measure bandwidth with actual download
      const downloadStart = performance.now();
      const response = await fetch(`${testResource.url}?t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-cache',
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.blob();
      const downloadEnd = performance.now();

      const testDuration = (downloadEnd - downloadStart) / 1000; // Convert to seconds
      const actualSize = data.size || testResource.expectedSize;
      const sizeMB = actualSize / (1024 * 1024);
      const speedMbps = (sizeMB * 8) / testDuration; // Convert to Mbps

      const measurement: BandwidthMeasurement = {
        speedMbps: Math.max(speedMbps, 0.01), // Minimum speed
        latencyMs: latency,
        timestamp: new Date(),
        testSize: actualSize,
        testDuration
      };

      return measurement;

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Bandwidth test aborted');
        return null;
      }
      
      console.warn('Bandwidth measurement failed:', error);
      
      // Return a conservative fallback measurement
      return {
        speedMbps: 1,
        latencyMs: 100,
        timestamp: new Date(),
        testSize: testResource.expectedSize,
        testDuration: 1
      };
    } finally {
      abortControllerRef.current = null;
    }
  }, []);

  // Run comprehensive bandwidth test with multiple measurements
  const runBandwidthTest = useCallback(async (
    iterations = 3,
    interval = 1000
  ): Promise<BandwidthMeasurement[]> => {
    setIsTestingBandwidth(true);
    const results: BandwidthMeasurement[] = [];

    try {
      for (let i = 0; i < iterations; i++) {
        if (abortControllerRef.current?.signal.aborted) break;

        // Alternate between different test resources
        const testResource = BANDWIDTH_TEST_SIZES[i % BANDWIDTH_TEST_SIZES.length];
        const measurement = await measureBandwidth(testResource);
        
        if (measurement) {
          results.push(measurement);
          
          // Update measurements in real-time
          setMeasurements(prev => {
            const updated = [...prev, measurement];
            measurementsRef.current = updated;
            return updated.slice(-20); // Keep last 20 measurements
          });
        }

        // Wait between measurements (except for the last one)
        if (i < iterations - 1) {
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      }

      return results;

    } finally {
      setIsTestingBandwidth(false);
    }
  }, [measureBandwidth]);

  // Calculate statistics from measurements
  const calculateStats = useCallback((measurements: BandwidthMeasurement[]): BandwidthStats => {
    if (measurements.length === 0) {
      return {
        current: 0,
        average: 0,
        min: 0,
        max: 0,
        samples: 0,
        reliability: 'low'
      };
    }

    const speeds = measurements.map(m => m.speedMbps);
    const current = speeds[speeds.length - 1];
    const average = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
    const min = Math.min(...speeds);
    const max = Math.max(...speeds);

    // Calculate reliability based on consistency and sample size
    let reliability: 'high' | 'medium' | 'low' = 'low';
    
    if (measurements.length >= 5) {
      const variance = speeds.reduce((sum, speed) => sum + Math.pow(speed - average, 2), 0) / speeds.length;
      const coefficientOfVariation = Math.sqrt(variance) / average;
      
      if (coefficientOfVariation < 0.2) reliability = 'high';
      else if (coefficientOfVariation < 0.4) reliability = 'medium';
    } else if (measurements.length >= 3) {
      reliability = 'medium';
    }

    return {
      current,
      average,
      min,
      max,
      samples: measurements.length,
      reliability
    };
  }, []);

  // Update stats when measurements change
  useEffect(() => {
    const newStats = calculateStats(measurements);
    setStats(newStats);
  }, [measurements, calculateStats]);

  // Auto-test bandwidth on mount and periodically
  useEffect(() => {
    // Initial test
    runBandwidthTest(2, 500);

    // Periodic testing every 5 minutes
    const interval = setInterval(() => {
      if (!isTestingBandwidth) {
        measureBandwidth().then(measurement => {
          if (measurement) {
            setMeasurements(prev => {
              const updated = [...prev, measurement];
              return updated.slice(-20);
            });
          }
        });
      }
    }, 300000); // 5 minutes

    return () => {
      clearInterval(interval);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Get bandwidth category
  const getBandwidthCategory = useCallback((speedMbps: number): 'excellent' | 'good' | 'fair' | 'poor' => {
    if (speedMbps >= 25) return 'excellent';
    if (speedMbps >= 10) return 'good';
    if (speedMbps >= 4) return 'fair';
    return 'poor';
  }, []);

  // Stop any ongoing tests
  const stopTest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsTestingBandwidth(false);
  }, []);

  // Clear measurement history
  const clearMeasurements = useCallback(() => {
    setMeasurements([]);
    measurementsRef.current = [];
    setStats({
      current: 0,
      average: 0,
      min: 0,
      max: 0,
      samples: 0,
      reliability: 'low'
    });
  }, []);

  return {
    measurements,
    stats,
    isTestingBandwidth,
    measureBandwidth,
    runBandwidthTest,
    getBandwidthCategory,
    stopTest,
    clearMeasurements
  };
};