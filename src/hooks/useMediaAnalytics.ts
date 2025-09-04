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

  const getDateRange = (period: TimePeriod): { startDate: Date | null; endDate: Date } => {
    const now = new Date();
    const endDate = now;
    let startDate: Date | null = null;

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
      case '3months':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case '6months':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case '1year':
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case 'all':
      default:
        startDate = null;
        break;
    }

    return { startDate, endDate };
  };

  const fetchAnalytics = useCallback(async (mediaId: string, period: TimePeriod) => {
    if (!mediaId) return;
    
    setLoading(true);
    setError(null);

    try {
      const { startDate, endDate } = getDateRange(period);
      
      // Call the database function to get analytics data
      const { data: analyticsData, error: analyticsError } = await supabase.rpc('get_media_analytics', {
        p_media_id: mediaId,
        p_start_date: startDate?.toISOString() || null,
        p_end_date: endDate.toISOString()
      });

      if (analyticsError) {
        throw analyticsError;
      }

      // Call the database function to get stats
      const { data: statsData, error: statsError } = await supabase.rpc('get_media_stats', {
        p_media_id: mediaId,
        p_start_date: startDate?.toISOString() || null,
        p_end_date: endDate.toISOString()
      });

      if (statsError) {
        throw statsError;
      }

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

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error('Failed to track analytics event:', err);
    }
  };

  // Generate chart data with proper formatting
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }

    return data.map((point, index) => ({
      date: new Date(point.date_period).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      }),
      sent: Number(point.sent_count),
      purchased: Number(point.purchased_count),
      revenue: Number(point.revenue_cents) / 100, // Convert to dollars
      index
    }));
  }, [data]);

  // Calculate trends for stats
  const trends = useMemo(() => {
    if (!data || data.length < 2) {
      return {
        sentTrend: 0,
        purchasedTrend: 0,
        revenueTrend: 0
      };
    }

    const recent = data.slice(-7); // Last 7 days
    const previous = data.slice(-14, -7); // Previous 7 days

    const recentSent = recent.reduce((sum, d) => sum + Number(d.sent_count), 0);
    const previousSent = previous.reduce((sum, d) => sum + Number(d.sent_count), 0);

    const recentPurchased = recent.reduce((sum, d) => sum + Number(d.purchased_count), 0);
    const previousPurchased = previous.reduce((sum, d) => sum + Number(d.purchased_count), 0);

    const recentRevenue = recent.reduce((sum, d) => sum + Number(d.revenue_cents), 0);
    const previousRevenue = previous.reduce((sum, d) => sum + Number(d.revenue_cents), 0);

    return {
      sentTrend: previousSent > 0 ? ((recentSent - previousSent) / previousSent) * 100 : 0,
      purchasedTrend: previousPurchased > 0 ? ((recentPurchased - previousPurchased) / previousPurchased) * 100 : 0,
      revenueTrend: previousRevenue > 0 ? ((recentRevenue - previousRevenue) / previousRevenue) * 100 : 0
    };
  }, [data]);

  return {
    data,
    stats,
    chartData,
    trends,
    loading,
    error,
    fetchAnalytics,
    trackEvent
  };
};