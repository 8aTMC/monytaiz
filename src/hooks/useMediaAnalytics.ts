import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type TimePeriod = 'all' | '1year' | '6months' | '3months' | '1month' | '1week' | '1day';

export interface AnalyticsDataPoint {
  date_period: string;
  sent_count: number;
  purchased_count: number;
  revenue_cents: number;
}

export interface MediaStats {
  total_sent: number;
  total_purchased: number;
  total_revenue_cents: number;
  conversion_rate: number;
}

export const useMediaAnalytics = (mediaId: string | null) => {
  const [data, setData] = useState<AnalyticsDataPoint[]>([]);
  const [stats, setStats] = useState<MediaStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchAnalytics = useCallback(async (
    mediaId: string, 
    period: TimePeriod | 'custom', 
    forceRefresh: boolean = false,
    customRange?: { startDate: Date; endDate: Date }
  ) => {
    if (!mediaId) return;
    
    setLoading(true);
    setError(null);
    
    if (forceRefresh) {
      setData([]);
      setStats({
        total_sent: 0,
        total_purchased: 0,
        total_revenue_cents: 0,
        conversion_rate: 0
      });
    }

    try {
      let startDate: Date | null = null;
      let endDate: Date = new Date();

      if (period === 'custom' && customRange) {
        startDate = customRange.startDate;
        endDate = customRange.endDate;
      } else {
        const now = new Date();
        switch (period) {
          case '1day':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case '1week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '1month':
            startDate = new Date(now);
            startDate.setMonth(startDate.getMonth() - 1);
            break;
          default:
            startDate = null;
        }
      }
      
      const { data: analyticsData, error: analyticsError } = await supabase.rpc('get_media_analytics', {
        p_media_id: mediaId,
        p_start_date: startDate?.toISOString() || null,
        p_end_date: endDate.toISOString()
      });

      if (analyticsError) throw analyticsError;

      const { data: statsData, error: statsError } = await supabase.rpc('get_media_stats', {
        p_media_id: mediaId,
        p_start_date: startDate?.toISOString() || null,
        p_end_date: endDate.toISOString()
      });

      if (statsError) throw statsError;

      setData(analyticsData || []);
      setStats(statsData?.[0] || {
        total_sent: 0,
        total_purchased: 0,
        total_revenue_cents: 0,
        conversion_rate: 0
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch analytics data';
      setError(errorMessage);
      toast({
        title: "Error loading analytics",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const clearAnalyticsData = useCallback(() => {
    setData([]);
    setStats({
      total_sent: 0,
      total_purchased: 0,
      total_revenue_cents: 0,
      conversion_rate: 0
    });
  }, []);

  const trackEvent = async (
    mediaId: string, 
    eventType: 'sent' | 'purchased', 
    amountCents: number = 0,
    userId: string
  ) => {
    try {
      const { error } = await supabase
        .from('media_analytics')
        .insert({
          media_id: mediaId,
          event_type: eventType,
          amount_cents: amountCents,
          user_id: userId
        });

      if (error) throw error;
    } catch (err) {
      console.error('Failed to track analytics event:', err);
    }
  };

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map((point, index) => ({
      rawDate: point.date_period,
      date: new Date(point.date_period).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      }),
      sent: Number(point.sent_count),
      purchased: Number(point.purchased_count),
      revenue: Number(point.revenue_cents) / 100,
      index
    }));
  }, [data]);

  return {
    data,
    stats,
    chartData,
    loading,
    error,
    fetchAnalytics,
    trackEvent,
    clearAnalyticsData
  };
};