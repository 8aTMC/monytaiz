import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  TrendingUp, 
  TrendingDown, 
  Send, 
  ShoppingCart, 
  DollarSign, 
  Percent,
  BarChart3,
  X
} from 'lucide-react';
import { useMediaAnalytics, TimePeriod } from '@/hooks/useMediaAnalytics';
import { formatRevenue } from '@/lib/formatRevenue';
import { SimpleMediaItem } from '@/hooks/useSimpleMedia';
import { seedAnalyticsData, restoreRealData } from '@/utils/seedAnalyticsData';
import { supabase } from '@/integrations/supabase/client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface RevenueAnalyticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaItem: SimpleMediaItem | null;
}

interface ChartProps {
  data: any[];
  showSent: boolean;
  showPurchased: boolean;
  maxValue: number;
  selectedPeriod: TimePeriod;
}

const CustomChart: React.FC<ChartProps> = ({ data, showSent, showPurchased, maxValue, selectedPeriod }) => {
  const chartHeight = 200;
  const chartWidth = 600;
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    show: boolean;
    x: number;
    y: number;
    data: {
      date: string;
      sent?: number;
      purchased?: number;
      revenue?: number;
      type: 'sent' | 'purchased';
    };
  }>({
    show: false,
    x: 0,
    y: 0,
    data: { date: '', type: 'sent' }
  });

  if (!data || data.length === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-gradient-to-br from-muted/30 to-muted/10 rounded-lg border-2 border-dashed border-muted"
        style={{ height: chartHeight, width: chartWidth }}
      >
        <div className="text-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No data available for this period</p>
        </div>
      </div>
    );
  }

  const getPath = (values: number[], color: string) => {
    if (values.length === 0) return '';
    
    let path = '';
    values.forEach((value, index) => {
      const x = (index / (values.length - 1)) * innerWidth;
      const y = innerHeight - ((value / maxValue) * innerHeight);
      
      if (index === 0) {
        path += `M ${x} ${y}`;
      } else {
        path += ` L ${x} ${y}`;
      }
    });
    
    return path;
  };

  const sentValues = data.map(d => d.sent);
  const purchasedValues = data.map(d => d.purchased);

  // Format x-axis labels based on selected period
  const formatXAxisLabel = (rawDateString: string, index: number, totalPoints: number) => {
    const date = new Date(rawDateString);
    
    switch (selectedPeriod) {
      case '1day':
        // Show hours for daily view
        return date.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          hour12: true 
        });
      
      case '1week':
        // Show weekday names
        return date.toLocaleDateString('en-US', { 
          weekday: 'short' 
        });
      
      case '1month':
        // Show day of month with month context for better readability
        if (index === 0 || index === totalPoints - 1 || date.getDate() === 1 || date.getDate() % 5 === 0) {
          return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          });
        }
        return date.getDate().toString();
      
      case '3months':
        // Show month abbreviation for every few points
        if (totalPoints > 12 && index % Math.ceil(totalPoints / 6) !== 0) return '';
        return date.toLocaleDateString('en-US', { 
          month: 'short' 
        });
      
      case '6months':
        // Show month abbreviation for every few points
        if (totalPoints > 8 && index % Math.ceil(totalPoints / 4) !== 0) return '';
        return date.toLocaleDateString('en-US', { 
          month: 'short' 
        });
      
      case '1year':
        // Show month abbreviation for every few points
        if (totalPoints > 12 && index % Math.ceil(totalPoints / 6) !== 0) return '';
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          year: '2-digit' 
        });
      
      case 'all':
        // Show year for every few points
        if (totalPoints > 8 && index % Math.ceil(totalPoints / 4) !== 0) return '';
        return date.toLocaleDateString('en-US', { 
          year: 'numeric' 
        });
      
      default:
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        });
    }
  };

  return (
    <div className="bg-gradient-to-br from-background to-muted/20 p-4 rounded-lg border shadow-sm">
      <svg width={chartWidth} height={chartHeight} className="overflow-visible">
        {/* Grid lines */}
        <defs>
          <linearGradient id="sentGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="purchasedGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        
        <g transform={`translate(${padding.left}, ${padding.top})`}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
            <g key={ratio}>
              <line
                x1="0"
                y1={innerHeight * ratio}
                x2={innerWidth}
                y2={innerHeight * ratio}
                stroke="#e5e7eb"
                strokeWidth="1"
                opacity="0.5"
              />
              <text
                x="-10"
                y={innerHeight * ratio + 4}
                fontSize="10"
                fill="#6b7280"
                textAnchor="end"
              >
                {Math.round(maxValue * (1 - ratio))}
              </text>
            </g>
          ))}
          
          {/* Data lines */}
          {showSent && (
            <>
              <path
                d={getPath(sentValues, '#3b82f6')}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-sm"
              />
              {/* Sent data points */}
              {sentValues.map((value, index) => {
                const cx = (index / (sentValues.length - 1)) * innerWidth;
                const cy = innerHeight - ((value / maxValue) * innerHeight);
                
                return (
                  <circle
                    key={`sent-${index}`}
                    cx={cx}
                    cy={cy}
                    r="4"
                    fill="#3b82f6"
                    stroke="white"
                    strokeWidth="2"
                    className="drop-shadow-sm hover:r-6 transition-all cursor-pointer"
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const containerRect = e.currentTarget.closest('svg')?.getBoundingClientRect();
                      if (containerRect) {
                        setTooltip({
                          show: true,
                          x: rect.left - containerRect.left + rect.width / 2,
                          y: rect.top - containerRect.top - 10,
                          data: {
                            date: data[index]?.date || '',
                            sent: value,
                            purchased: data[index]?.purchased,
                            revenue: data[index]?.revenue,
                            type: 'sent'
                          }
                        });
                      }
                    }}
                    onMouseLeave={() => setTooltip(prev => ({ ...prev, show: false }))}
                  />
                );
              })}
            </>
          )}
          
          {showPurchased && (
            <>
              <path
                d={getPath(purchasedValues, '#10b981')}
                fill="none"
                stroke="#10b981"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-sm"
              />
              {/* Purchased data points */}
              {purchasedValues.map((value, index) => {
                const cx = (index / (purchasedValues.length - 1)) * innerWidth;
                const cy = innerHeight - ((value / maxValue) * innerHeight);
                
                return (
                  <circle
                    key={`purchased-${index}`}
                    cx={cx}
                    cy={cy}
                    r="4"
                    fill="#10b981"
                    stroke="white"
                    strokeWidth="2"
                    className="drop-shadow-sm hover:r-6 transition-all cursor-pointer"
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const containerRect = e.currentTarget.closest('svg')?.getBoundingClientRect();
                      if (containerRect) {
                        setTooltip({
                          show: true,
                          x: rect.left - containerRect.left + rect.width / 2,
                          y: rect.top - containerRect.top - 10,
                          data: {
                            date: data[index]?.date || '',
                            sent: data[index]?.sent,
                            purchased: value,
                            revenue: data[index]?.revenue,
                            type: 'purchased'
                          }
                        });
                      }
                    }}
                    onMouseLeave={() => setTooltip(prev => ({ ...prev, show: false }))}
                  />
                );
              })}
            </>
          )}
          
          {/* X-axis labels */}
          {data.map((point, index) => {
            const formattedLabel = formatXAxisLabel(point.rawDate, index, data.length);
            if (!formattedLabel) return null;
            
            return (
              <text
                key={index}
                x={(index / (data.length - 1)) * innerWidth}
                y={innerHeight + 20}
                fontSize="10"
                fill="#6b7280"
                textAnchor="middle"
                className="select-none"
              >
                {formattedLabel}
              </text>
            );
          })}
        </g>
      </svg>
      
      {/* Tooltip */}
      {tooltip.show && (
        <div
          className="absolute z-50 bg-gray-900/95 text-white text-xs rounded-lg py-2 px-3 pointer-events-none shadow-lg border border-gray-700 transition-opacity duration-200"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="space-y-1">
            <div className="font-semibold border-b border-gray-700 pb-1 mb-1">
              {tooltip.data.date}
            </div>
            {tooltip.data.sent !== undefined && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Times Sent: {tooltip.data.sent.toLocaleString()}</span>
              </div>
            )}
            {tooltip.data.purchased !== undefined && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Times Purchased: {tooltip.data.purchased.toLocaleString()}</span>
              </div>
            )}
            {tooltip.data.revenue !== undefined && tooltip.data.revenue > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>Revenue: {formatRevenue(tooltip.data.revenue)}</span>
              </div>
            )}
          </div>
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900/95"></div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number;
  subtitle?: string;
  gradient: string;
}> = ({ title, value, icon, trend, subtitle, gradient }) => (
  <Card className={`relative overflow-hidden border-0 shadow-lg ${gradient}`}>
    <CardHeader className="pb-2">
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm font-medium text-white/90">{title}</CardTitle>
        <div className="text-white/80">{icon}</div>
      </div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      {subtitle && (
        <p className="text-xs text-white/70 mb-2">{subtitle}</p>
      )}
      {trend !== undefined && (
        <div className="flex items-center">
          {trend >= 0 ? (
            <TrendingUp className="h-3 w-3 text-green-300 mr-1" />
          ) : (
            <TrendingDown className="h-3 w-3 text-red-300 mr-1" />
          )}
          <span className="text-xs text-white/80">
            {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
        </div>
      )}
    </CardContent>
  </Card>
);

export const RevenueAnalyticsDialog: React.FC<RevenueAnalyticsDialogProps> = ({
  open,
  onOpenChange,
  mediaItem
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('all');
  const [showSent, setShowSent] = useState(true);
  const [showPurchased, setShowPurchased] = useState(true);
  const [previousChartData, setPreviousChartData] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();
  
  const { 
    chartData, 
    stats, 
    trends, 
    loading, 
    error, 
    fetchAnalytics,
    clearAnalyticsData,
    actualDateRange
  } = useMediaAnalytics(mediaItem?.id || null);

  // Check user role
  useEffect(() => {
    const checkUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        
        if (userRoles && userRoles.length > 0) {
          const roles = userRoles.map(r => r.role);
          if (roles.includes('owner')) {
            setUserRole('owner');
          } else if (roles.includes('superadmin')) {
            setUserRole('superadmin');
          } else if (roles.includes('admin')) {
            setUserRole('admin');
          } else if (roles.includes('manager')) {
            setUserRole('manager');
          } else {
            setUserRole(roles[0]);
          }
        }
      }
    };

    if (open) {
      checkUserRole();
    }
  }, [open]);

  // Keep track of previous chart data for smooth transitions
  useEffect(() => {
    if (chartData && chartData.length > 0 && !loading) {
      setPreviousChartData(chartData);
    }
  }, [chartData, loading]);

  useEffect(() => {
    if (mediaItem?.id && open) {
      // Clear any existing debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      
      // Debounce the fetch to prevent rapid API calls
      debounceRef.current = setTimeout(() => {
        fetchAnalytics(mediaItem.id, selectedPeriod);
      }, 100);
    }
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [mediaItem?.id, selectedPeriod, open]);

  const maxValue = Math.max(
    ...chartData.map(d => Math.max(d.sent, d.purchased)),
    10
  );

  const periods = [
    { value: 'all' as TimePeriod, label: 'All Time' },
    { value: '1year' as TimePeriod, label: '1 Year' },
    { value: '6months' as TimePeriod, label: '6 Months' },
    { value: '3months' as TimePeriod, label: '3 Months' },
    { value: '1month' as TimePeriod, label: '1 Month' },
    { value: '1week' as TimePeriod, label: '1 Week' },
    { value: '1day' as TimePeriod, label: '1 Day' },
  ];

  if (!mediaItem) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <DollarSign className="h-6 w-6 text-green-600" />
              Revenue Analytics
            </DialogTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {mediaItem.title || mediaItem.original_filename}
          </p>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto pr-2">
          {/* Time Period Selector */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Time Period</Label>
              {actualDateRange && actualDateRange.minDate && actualDateRange.maxDate && selectedPeriod === 'all' && (
                <div className="text-xs text-muted-foreground">
                  Showing: {actualDateRange.minDate.toLocaleDateString()} - {actualDateRange.maxDate.toLocaleDateString()}
                </div>
              )}
            </div>
            <Tabs value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as TimePeriod)}>
              <TabsList className="grid w-full grid-cols-7">
                {periods.map(period => (
                  <TabsTrigger 
                    key={period.value} 
                    value={period.value}
                    className="text-xs"
                  >
                    {period.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Chart Controls */}
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-sent"
                  checked={showSent}
                  onCheckedChange={setShowSent}
                />
                <Label htmlFor="show-sent" className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  Times Sent
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-purchased"
                  checked={showPurchased}
                  onCheckedChange={setShowPurchased}
                />
                <Label htmlFor="show-purchased" className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  Times Purchased
                </Label>
              </div>
            </div>
            
            {/* Admin Controls */}
            {(userRole === 'owner' || userRole === 'superadmin' || userRole === 'admin' || userRole === 'manager') && (
              <div className="flex items-center gap-2">
                {(!chartData || chartData.length === 0) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (mediaItem?.id) {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user) {
                          await seedAnalyticsData(mediaItem.id, user.id);
                          fetchAnalytics(mediaItem.id, selectedPeriod);
                        }
                      }
                    }}
                    className="text-xs"
                  >
                    Generate Sample Data
                  </Button>
                )}
                
                {(chartData && chartData.length > 0) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        Restore Real Data
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="z-[300]">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Restore Real Data</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove any sample/demo analytics data and restore the view to show only real user interactions and purchases. Real data will be preserved.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          disabled={isRestoring || loading}
                          onClick={async () => {
                            if (mediaItem?.id) {
                              try {
                                console.log('Starting restore real data process for media:', mediaItem.id);
                                
                                // Set restoring state and immediately clear UI data
                                setIsRestoring(true);
                                clearAnalyticsData();
                                setPreviousChartData([]);
                                
                                const success = await restoreRealData(mediaItem.id);
                                console.log('Restore real data result:', success);
                                
                                if (success) {
                                  // Force refresh analytics data with cache busting
                                  console.log('Forcing fresh analytics data fetch after restore...');
                                  await fetchAnalytics(mediaItem.id, selectedPeriod, true);
                                  setIsRestoring(false);
                                  console.log('Analytics data refreshed after restore');
                                  
                                  toast({
                                    title: "Real Data Restored",
                                    description: "All sample data has been removed. Showing real analytics only.",
                                  });
                                } else {
                                  setIsRestoring(false);
                                  toast({
                                    title: "Error",
                                    description: "Failed to restore real data. Please check console for details.",
                                    variant: "destructive",
                                  });
                                }
                              } catch (error) {
                                console.error('Error during restore process:', error);
                                setIsRestoring(false);
                                // Restore analytics in case of error
                                await fetchAnalytics(mediaItem.id, selectedPeriod, true);
                                toast({
                                  title: "Error",
                                  description: "An unexpected error occurred while restoring data.",
                                  variant: "destructive",
                                });
                              }
                            }
                          }}
                          className="bg-blue-600 text-white hover:bg-blue-700"
                        >
                          Restore Real Data
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )}
          </div>

          {/* Chart */}
          <div className="flex justify-center relative">
            {loading && previousChartData.length === 0 ? (
              <div className="flex items-center justify-center h-48 w-full bg-muted/20 rounded-lg">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-48 w-full bg-red-50 rounded-lg border border-red-200">
                <p className="text-red-600">Failed to load analytics data</p>
              </div>
            ) : (
              <div className="relative">
                <CustomChart 
                  data={chartData.length > 0 ? chartData : previousChartData} 
                  showSent={showSent} 
                  showPurchased={showPurchased}
                  maxValue={maxValue}
                  selectedPeriod={selectedPeriod}
                />
                {loading && chartData.length === 0 && previousChartData.length > 0 && (
                  <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Statistics Cards */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Statistics</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Sent"
                value={stats?.total_sent?.toLocaleString() || '0'}
                icon={<Send className="h-5 w-5" />}
                trend={trends.sentTrend}
                gradient="bg-gradient-to-br from-blue-500 to-blue-600"
              />
              <StatCard
                title="Total Purchased"
                value={stats?.total_purchased?.toLocaleString() || '0'}
                icon={<ShoppingCart className="h-5 w-5" />}
                trend={trends.purchasedTrend}
                gradient="bg-gradient-to-br from-green-500 to-green-600"
              />
              <StatCard
                title="Total Revenue"
                value={formatRevenue(stats?.total_revenue_cents || 0)}
                icon={<DollarSign className="h-5 w-5" />}
                trend={trends.revenueTrend}
                gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
              />
              <StatCard
                title="Conversion Rate"
                value={`${stats?.conversion_rate?.toFixed(1) || '0.0'}%`}
                icon={<Percent className="h-5 w-5" />}
                subtitle={stats?.total_sent ? `${stats.total_purchased}/${stats.total_sent}` : '0/0'}
                gradient="bg-gradient-to-br from-purple-500 to-purple-600"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};