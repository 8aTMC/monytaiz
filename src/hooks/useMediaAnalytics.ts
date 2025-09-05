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
  const [actualDateRange, setActualDateRange] = useState<{
    minDate: Date | null;
    maxDate: Date | null;
    totalDays: number;
  } | null>(null);
  const { toast } = useToast();

  const fetchAnalytics = useCallback(async (mediaId: string, period: TimePeriod, forceRefresh: boolean = false) => {
    if (!mediaId) return;
    
    setLoading(true);
    setError(null);
    
    // Clear existing data immediately if this is a forced refresh
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
      // First, fetch the actual date range for the media item synchronously
      let currentActualRange = actualDateRange;
      
      // If we don't have the range yet or it's a forced refresh, fetch it
      if (!currentActualRange || forceRefresh) {
        const { data: dateRangeData, error: dateRangeError } = await supabase.rpc('get_media_analytics_date_range', {
          p_media_id: mediaId
        });

        if (dateRangeError) {
          throw dateRangeError;
        }

        if (dateRangeData && dateRangeData.length > 0) {
          const range = dateRangeData[0];
          currentActualRange = {
            minDate: range.min_date ? new Date(range.min_date) : null,
            maxDate: range.max_date ? new Date(range.max_date) : null,
            totalDays: range.total_days || 0
          };
          setActualDateRange(currentActualRange);
        } else {
          currentActualRange = { minDate: null, maxDate: null, totalDays: 0 };
          setActualDateRange(currentActualRange);
        }
      }
      
      // Now get the date range using the current actual range
      const { startDate, endDate } = getSmartDateRange(period, currentActualRange);
      
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
  }, [toast, actualDateRange]);

  // Smart date range calculation that considers actual data
  const getSmartDateRange = (period: TimePeriod, currentActualRange: typeof actualDateRange): { startDate: Date | null; endDate: Date } => {
    const now = new Date();
    
    // For "all time", use actual data range if available
    if (period === 'all' && currentActualRange?.minDate && currentActualRange?.maxDate) {
      return {
        startDate: currentActualRange.minDate,
        endDate: currentActualRange.maxDate
      };
    }

    // Calculate traditional backwards date range
    let startDate: Date | null = null;
    let endDate = now;

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

    // Smart fallback: if requested period is longer than actual data span,
    // use the actual data range instead to avoid empty charts
    if (currentActualRange?.minDate && currentActualRange?.maxDate && startDate) {
      const requestedDays = Math.ceil((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
      const actualDays = currentActualRange.totalDays;
      
      if (actualDays > 0 && requestedDays > actualDays * 2) {
        // If requested period is more than double the actual data span, use actual range
        return {
          startDate: currentActualRange.minDate,
          endDate: currentActualRange.maxDate
        };
      }
    }

    return { startDate, endDate };
  };
  
  // Helper function to clear all data
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

    return data.map((point, index) => {
      // Debug: Log the original date_period format
      console.log('Raw date_period from DB:', point.date_period, 'Type:', typeof point.date_period);
      
      const parsedDate = new Date(point.date_period);
      console.log('Parsed date:', parsedDate, 'ISO:', parsedDate.toISOString());
      
      return {
        // Preserve original date for proper parsing - convert to ISO string for consistency
        rawDate: point.date_period,
        // Keep formatted version for display
        date: parsedDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        }),
        sent: Number(point.sent_count),
        purchased: Number(point.purchased_count),
        revenue: Number(point.revenue_cents) / 100, // Convert to dollars
        index
      };
    });
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
    trackEvent,
    clearAnalyticsData,
    actualDateRange
  };
};