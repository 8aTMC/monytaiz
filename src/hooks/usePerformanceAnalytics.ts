import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PerformanceAnalyticsData {
  datePeriod: string;
  avgLoadTimeMs: number;
  totalViews: number;
  bufferEventsTotal: number;
  qualitySwitchesTotal: number;
  avgWatchDuration: number;
  cacheHitRate: number;
}

export interface SystemHealthMetric {
  metricType: string;
  metricValue: number;
  metricUnit: string;
  metadata: Record<string, any>;
  recordedAt: string;
}

export interface PerformanceAlert {
  id: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  metadata: Record<string, any>;
  resolved: boolean;
  createdAt: string;
}

export const usePerformanceAnalytics = () => {
  const [analyticsData, setAnalyticsData] = useState<PerformanceAnalyticsData[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealthMetric[]>([]);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPerformanceAnalytics = useCallback(async (
    startDate?: Date,
    endDate?: Date,
    mediaId?: string
  ) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('get_performance_analytics', {
        p_start_date: startDate?.toISOString() || null,
        p_end_date: endDate?.toISOString() || null,
        p_media_id: mediaId || null
      });

      if (error) throw error;

      const formattedData: PerformanceAnalyticsData[] = data.map((item: any) => ({
        datePeriod: item.date_period,
        avgLoadTimeMs: parseFloat(item.avg_load_time_ms) || 0,
        totalViews: parseInt(item.total_views) || 0,
        bufferEventsTotal: parseInt(item.buffer_events_total) || 0,
        qualitySwitchesTotal: parseInt(item.quality_switches_total) || 0,
        avgWatchDuration: parseFloat(item.avg_watch_duration) || 0,
        cacheHitRate: parseFloat(item.cache_hit_rate) || 0
      }));

      setAnalyticsData(formattedData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch analytics';
      setError(errorMessage);
      toast({
        title: "Analytics Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchSystemHealth = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('system_health_metrics')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const formattedHealth: SystemHealthMetric[] = data.map((item: any) => ({
        metricType: item.metric_type,
        metricValue: parseFloat(item.metric_value),
        metricUnit: item.metric_unit,
        metadata: item.metadata || {},
        recordedAt: item.recorded_at
      }));

      setSystemHealth(formattedHealth);
    } catch (err) {
      console.error('Failed to fetch system health:', err);
    }
  }, []);

  const fetchPerformanceAlerts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('performance_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const formattedAlerts: PerformanceAlert[] = data.map((item: any) => ({
        id: item.id,
        alertType: item.alert_type,
        severity: item.severity,
        title: item.title,
        description: item.description,
        metadata: item.metadata || {},
        resolved: item.resolved,
        createdAt: item.created_at
      }));

      setAlerts(formattedAlerts);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
  }, []);

  const recordSystemMetric = useCallback(async (
    metricType: string,
    value: number,
    unit: string,
    metadata: Record<string, any> = {}
  ) => {
    try {
      const { error } = await supabase
        .from('system_health_metrics')
        .insert({
          metric_type: metricType,
          metric_value: value,
          metric_unit: unit,
          metadata
        });

      if (error) throw error;
    } catch (err) {
      console.error('Failed to record system metric:', err);
    }
  }, []);

  const createPerformanceAlert = useCallback(async (
    alertType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    title: string,
    description: string,
    metadata: Record<string, any> = {}
  ) => {
    try {
      const { error } = await supabase
        .from('performance_alerts')
        .insert({
          alert_type: alertType,
          severity,
          title,
          description,
          metadata
        });

      if (error) throw error;
      
      // Refresh alerts to show the new one
      await fetchPerformanceAlerts();
    } catch (err) {
      console.error('Failed to create alert:', err);
    }
  }, [fetchPerformanceAlerts]);

  const resolveAlert = useCallback(async (alertId: string) => {
    try {
      const user = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('performance_alerts')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user.data.user?.id
        })
        .eq('id', alertId);

      if (error) throw error;
      
      // Refresh alerts
      await fetchPerformanceAlerts();
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  }, [fetchPerformanceAlerts]);

  const getPerformanceScore = useCallback(() => {
    if (analyticsData.length === 0) return null;
    
    const latest = analyticsData[analyticsData.length - 1];
    if (!latest) return null;

    // Calculate performance score based on multiple metrics
    let score = 100;

    // Load time penalty (target: <2000ms)
    if (latest.avgLoadTimeMs > 5000) score -= 30;
    else if (latest.avgLoadTimeMs > 3000) score -= 20;
    else if (latest.avgLoadTimeMs > 2000) score -= 10;

    // Buffer events penalty
    const bufferRate = latest.totalViews > 0 ? latest.bufferEventsTotal / latest.totalViews : 0;
    if (bufferRate > 0.5) score -= 25;
    else if (bufferRate > 0.3) score -= 15;
    else if (bufferRate > 0.1) score -= 5;

    // Cache hit rate bonus
    if (latest.cacheHitRate > 90) score += 5;
    else if (latest.cacheHitRate < 50) score -= 15;
    else if (latest.cacheHitRate < 70) score -= 10;

    // Quality switches penalty (too many indicates network issues)
    const qualityRate = latest.totalViews > 0 ? latest.qualitySwitchesTotal / latest.totalViews : 0;
    if (qualityRate > 3) score -= 15;
    else if (qualityRate > 2) score -= 10;
    else if (qualityRate > 1) score -= 5;

    return Math.max(0, Math.min(100, score));
  }, [analyticsData]);

  const getRecommendations = useCallback(() => {
    const recommendations = [];
    
    if (analyticsData.length === 0) return recommendations;
    
    const latest = analyticsData[analyticsData.length - 1];
    if (!latest) return recommendations;

    if (latest.avgLoadTimeMs > 3000) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        title: 'Optimize Video Load Times',
        description: `Average load time is ${latest.avgLoadTimeMs}ms. Consider implementing more aggressive preloading or reducing initial quality.`
      });
    }

    if (latest.cacheHitRate < 70) {
      recommendations.push({
        type: 'caching',
        priority: 'medium',
        title: 'Improve Cache Hit Rate',
        description: `Cache hit rate is only ${latest.cacheHitRate}%. Review caching strategies and preload algorithms.`
      });
    }

    const bufferRate = latest.totalViews > 0 ? latest.bufferEventsTotal / latest.totalViews : 0;
    if (bufferRate > 0.3) {
      recommendations.push({
        type: 'streaming',
        priority: 'high',
        title: 'Reduce Buffer Events',
        description: `${(bufferRate * 100).toFixed(1)}% of views experience buffering. Optimize adaptive streaming thresholds.`
      });
    }

    return recommendations;
  }, [analyticsData]);

  // Auto-fetch data on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      await Promise.all([
        fetchPerformanceAnalytics(),
        fetchSystemHealth(),
        fetchPerformanceAlerts()
      ]);
    };

    fetchInitialData();
  }, [fetchPerformanceAnalytics, fetchSystemHealth, fetchPerformanceAlerts]);

  return {
    analyticsData,
    systemHealth,
    alerts,
    loading,
    error,
    fetchPerformanceAnalytics,
    fetchSystemHealth,
    fetchPerformanceAlerts,
    recordSystemMetric,
    createPerformanceAlert,
    resolveAlert,
    getPerformanceScore,
    getRecommendations
  };
};