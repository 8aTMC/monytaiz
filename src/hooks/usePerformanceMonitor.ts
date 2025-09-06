import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface VideoPerformanceMetrics {
  mediaId: string;
  sessionId: string;
  loadTimeMs: number;
  bufferEvents: number;
  qualitySwitches: number;
  initialQuality: string;
  finalQuality: string;
  watchDurationSeconds: number;
  completionPercentage: number;
  networkQuality: string;
  cacheHit: boolean;
  errorCount: number;
}

export interface UserBehaviorEvent {
  eventType: 'play' | 'pause' | 'seek' | 'quality_change' | 'fullscreen' | 'exit';
  mediaId?: string;
  interactionData: Record<string, any>;
  pageUrl: string;
  deviceInfo: Record<string, any>;
}

export const usePerformanceMonitor = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const metricsRef = useRef<Partial<VideoPerformanceMetrics>>({});
  const startTime = useRef<number>(0);
  const { toast } = useToast();

  const getDeviceInfo = useCallback(() => {
    return {
      userAgent: navigator.userAgent,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      connection: (navigator as any).connection ? {
        effectiveType: (navigator as any).connection.effectiveType,
        downlink: (navigator as any).connection.downlink,
        rtt: (navigator as any).connection.rtt
      } : null
    };
  }, []);

  const getNetworkQuality = useCallback(() => {
    const connection = (navigator as any).connection;
    if (!connection) return 'unknown';
    
    const { effectiveType, downlink } = connection;
    
    if (effectiveType === '4g' && downlink > 10) return 'excellent';
    if (effectiveType === '4g' && downlink > 5) return 'good';
    if (effectiveType === '3g' || (effectiveType === '4g' && downlink > 1)) return 'fair';
    return 'poor';
  }, []);

  const startTracking = useCallback((mediaId: string) => {
    setIsTracking(true);
    startTime.current = performance.now();
    
    metricsRef.current = {
      mediaId,
      sessionId,
      bufferEvents: 0,
      qualitySwitches: 0,
      errorCount: 0,
      networkQuality: getNetworkQuality(),
      cacheHit: false
    };
  }, [sessionId, getNetworkQuality]);

  const trackVideoEvent = useCallback((eventType: string, data: Record<string, any> = {}) => {
    if (!isTracking) return;

    switch (eventType) {
      case 'loadstart':
        startTime.current = performance.now();
        break;
      case 'canplaythrough':
        const loadTime = performance.now() - startTime.current;
        metricsRef.current.loadTimeMs = Math.round(loadTime);
        break;
      case 'waiting':
        metricsRef.current.bufferEvents = (metricsRef.current.bufferEvents || 0) + 1;
        break;
      case 'qualitychange':
        metricsRef.current.qualitySwitches = (metricsRef.current.qualitySwitches || 0) + 1;
        if (!metricsRef.current.initialQuality) {
          metricsRef.current.initialQuality = data.quality;
        }
        metricsRef.current.finalQuality = data.quality;
        break;
      case 'error':
        metricsRef.current.errorCount = (metricsRef.current.errorCount || 0) + 1;
        break;
      case 'cachehit':
        metricsRef.current.cacheHit = true;
        break;
    }
  }, [isTracking]);

  const trackBehaviorEvent = useCallback(async (event: UserBehaviorEvent) => {
    try {
      const { error } = await supabase
        .from('user_behavior_analytics')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          session_id: sessionId,
          event_type: event.eventType,
          media_id: event.mediaId,
          interaction_data: event.interactionData,
          timestamp_ms: Date.now(),
          page_url: event.pageUrl,
          device_info: event.deviceInfo
        });

      if (error) throw error;
    } catch (err) {
      console.error('Failed to track behavior event:', err);
    }
  }, [sessionId]);

  const stopTracking = useCallback(async (watchDurationSeconds: number, completionPercentage: number) => {
    if (!isTracking || !metricsRef.current.mediaId) return;

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      const finalMetrics: VideoPerformanceMetrics = {
        ...metricsRef.current as VideoPerformanceMetrics,
        watchDurationSeconds,
        completionPercentage,
        loadTimeMs: metricsRef.current.loadTimeMs || 0,
        initialQuality: metricsRef.current.initialQuality || 'auto',
        finalQuality: metricsRef.current.finalQuality || 'auto'
      };

      const { error } = await supabase
        .from('video_performance_metrics')
        .insert({
          media_id: finalMetrics.mediaId,
          user_id: user.data.user.id,
          session_id: finalMetrics.sessionId,
          load_time_ms: finalMetrics.loadTimeMs,
          buffer_events: finalMetrics.bufferEvents,
          quality_switches: finalMetrics.qualitySwitches,
          initial_quality: finalMetrics.initialQuality,
          final_quality: finalMetrics.finalQuality,
          watch_duration_seconds: finalMetrics.watchDurationSeconds,
          completion_percentage: finalMetrics.completionPercentage,
          network_quality: finalMetrics.networkQuality,
          cache_hit: finalMetrics.cacheHit,
          error_count: finalMetrics.errorCount
        });

      if (error) throw error;

      // Track behavior event for video completion
      await trackBehaviorEvent({
        eventType: 'exit',
        mediaId: finalMetrics.mediaId,
        interactionData: {
          watchDuration: watchDurationSeconds,
          completion: completionPercentage,
          quality: finalMetrics.finalQuality
        },
        pageUrl: window.location.href,
        deviceInfo: getDeviceInfo()
      });

    } catch (err) {
      console.error('Failed to save performance metrics:', err);
      toast({
        title: "Performance tracking error",
        description: "Failed to save performance metrics",
        variant: "destructive",
      });
    } finally {
      setIsTracking(false);
      metricsRef.current = {};
    }
  }, [isTracking, trackBehaviorEvent, getDeviceInfo, toast]);

  return {
    isTracking,
    sessionId,
    startTracking,
    stopTracking,
    trackVideoEvent,
    trackBehaviorEvent,
    getDeviceInfo,
    getNetworkQuality
  };
};