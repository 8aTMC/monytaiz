import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMediaAnalytics } from '@/hooks/useMediaAnalytics';
import { useLocalTimeframe } from '@/hooks/useGlobalTimeframe';
import { DateRangePicker } from '@/components/timeframe/DateRangePicker';
import { GranularitySelector } from '@/components/timeframe/GranularitySelector';
import { ScrollableChart } from '@/components/timeframe/ScrollableChart';
import { ChartSelector, ChartMetric } from '@/components/timeframe/ChartSelector';
import { convertAnalyticsData } from '@/utils/bucketize';
import { formatRevenue } from '@/lib/formatRevenue';
import { formatPercentageWithPeriodical } from '@/lib/utils';
import { TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart, Percent } from 'lucide-react';

interface RevenueAnalyticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaId: string;
  mediaTitle: string;
}

export const RevenueAnalyticsDialog = ({ open, onOpenChange, mediaId, mediaTitle }: RevenueAnalyticsDialogProps) => {
  const timeframe = useLocalTimeframe();
  const [selectedMetrics, setSelectedMetrics] = useState<ChartMetric[]>(['revenue']);
  
  const { 
    data, 
    stats, 
    loading, 
    error, 
    fetchAnalytics, 
    clearAnalyticsData 
  } = useMediaAnalytics(mediaId);

  useEffect(() => {
    if (open && mediaId) {
      // Convert timeframe to the format expected by fetchAnalytics
      fetchAnalytics(mediaId, 'custom', true, {
        startDate: timeframe.start,
        endDate: timeframe.end
      });
    }
  }, [open, mediaId, timeframe.start, timeframe.end, fetchAnalytics]);

  useEffect(() => {
    if (!open) {
      clearAnalyticsData();
    }
  }, [open, clearAnalyticsData]);

  // Convert analytics data to multi-metric bucketed format
  const multiMetricData = data ? convertAnalyticsData(data, {
    start: timeframe.start,
    end: timeframe.end,
    granularity: timeframe.granularity,
    timezone: timeframe.timezone
  }) : { revenue: [], sent: [], purchased: [] };

  // Prepare data for chart based on selected metrics
  const chartMetrics = selectedMetrics.map(metric => ({
    metric,
    data: multiMetricData[metric],
    format: metric === 'revenue' 
      ? (value: number) => formatRevenue(value * 100)
      : (value: number) => value.toLocaleString()
  }));

  const getChartTitle = () => {
    if (selectedMetrics.length === 1) {
      const metricNames = {
        revenue: 'Revenue',
        sent: 'Times Sent', 
        purchased: 'Times Purchased'
      };
      return `${metricNames[selectedMetrics[0]]} Over Time`;
    }
    return 'Analytics Over Time';
  };

  const renderTrend = (trend: number) => {
    if (trend === 0) return null;
    
    const Icon = trend > 0 ? TrendingUp : TrendingDown;
    const colorClass = trend > 0 ? 'text-green-600' : 'text-red-600';
    
    return (
      <div className={`flex items-center gap-1 ${colorClass}`}>
        <Icon className="h-3 w-3" />
        <span className="text-xs font-medium">
          {Math.abs(trend).toFixed(1)}%
        </span>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Analytics: {mediaTitle}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-full">
          <div className="space-y-4 pr-4">
          {/* Date Range and Granularity Controls */}
          <div className="flex flex-wrap gap-4 items-center">
            <DateRangePicker
              value={{ start: timeframe.start, end: timeframe.end }}
              onChange={(range) => timeframe.setRange(range.start, range.end)}
              timezone={timeframe.timezone}
            />
            <GranularitySelector
              allowed={timeframe.getAllowedGranularities()}
              value={timeframe.granularity}
              onChange={timeframe.setGranularity}
            />
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="pt-4">
                <p className="text-destructive text-sm">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Stats Cards */}
          {!loading && !error && stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                  <CardTitle className="text-sm font-medium">Times Sent</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-xl font-bold">{stats.total_sent.toLocaleString()}</div>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <span>Total deliveries</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                  <CardTitle className="text-sm font-medium">Times Purchased</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-xl font-bold">{stats.total_purchased.toLocaleString()}</div>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <span>Total sales</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-xl font-bold">
                    {formatRevenue(stats.total_revenue_cents)}
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <span>Gross earnings</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                  <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-xl font-bold">
                    {formatPercentageWithPeriodical(stats.conversion_rate)}
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <span>Purchase rate</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Chart Selector */}
          {!loading && !error && (
            <ChartSelector
              selectedMetrics={selectedMetrics}
              onSelectionChange={setSelectedMetrics}
            />
          )}

          {/* Chart */}
          {!loading && !error && selectedMetrics.length > 0 && multiMetricData.revenue.length > 0 && (
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-lg">{getChartTitle()}</CardTitle>
                <CardDescription>
                  Showing analytics trends for the selected period ({timeframe.granularity})
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <ScrollableChart
                  metrics={chartMetrics}
                  className="h-64"
                />
              </CardContent>
            </Card>
          )}

          {/* No Metrics Selected */}
          {!loading && !error && selectedMetrics.length === 0 && multiMetricData.revenue.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <div className="text-center py-4">
                  <ShoppingCart className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <h3 className="text-base font-semibold mb-2">No Metrics Selected</h3>
                  <p className="text-muted-foreground text-sm">
                    Please select at least one metric to display the chart.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!loading && !error && multiMetricData.revenue.length === 0 && (
            <Card>
              <CardContent className="pt-4">
                <div className="text-center py-4">
                  <DollarSign className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <h3 className="text-base font-semibold mb-2">No Data Available</h3>
                  <p className="text-muted-foreground text-sm">
                    There's no analytics data for the selected time period.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};