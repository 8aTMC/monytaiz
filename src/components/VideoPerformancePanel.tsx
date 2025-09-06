import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Clock, Activity, Zap, AlertTriangle } from 'lucide-react';

interface VideoPerformancePanelProps {
  mediaId?: string;
  performanceData?: {
    loadTime: number;
    bufferEvents: number;
    qualitySwitches: number;
    watchDuration: number;
    completionRate: number;
    cacheHit: boolean;
    networkQuality: string;
  };
  trends?: Array<{
    timestamp: string;
    loadTime: number;
    bufferEvents: number;
    quality: string;
  }>;
  isLive?: boolean;
}

export const VideoPerformancePanel: React.FC<VideoPerformancePanelProps> = ({
  mediaId,
  performanceData,
  trends = [],
  isLive = false
}) => {
  const getNetworkQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'fair': return 'bg-yellow-500';
      case 'poor': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getLoadTimeStatus = (loadTime: number) => {
    if (loadTime < 2000) return { status: 'excellent', color: 'text-green-600' };
    if (loadTime < 3000) return { status: 'good', color: 'text-blue-600' };
    if (loadTime < 5000) return { status: 'fair', color: 'text-yellow-600' };
    return { status: 'poor', color: 'text-red-600' };
  };

  const getPerformanceScore = () => {
    if (!performanceData) return null;
    
    let score = 100;
    
    // Load time impact
    if (performanceData.loadTime > 5000) score -= 30;
    else if (performanceData.loadTime > 3000) score -= 15;
    else if (performanceData.loadTime > 2000) score -= 5;
    
    // Buffer events impact
    if (performanceData.bufferEvents > 5) score -= 25;
    else if (performanceData.bufferEvents > 2) score -= 10;
    else if (performanceData.bufferEvents > 0) score -= 5;
    
    // Quality switches impact
    if (performanceData.qualitySwitches > 10) score -= 20;
    else if (performanceData.qualitySwitches > 5) score -= 10;
    else if (performanceData.qualitySwitches > 2) score -= 5;
    
    // Cache hit bonus
    if (performanceData.cacheHit) score += 5;
    
    return Math.max(0, score);
  };

  const performanceScore = getPerformanceScore();
  const loadTimeStatus = performanceData ? getLoadTimeStatus(performanceData.loadTime) : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Video Performance
              {isLive && (
                <Badge variant="secondary" className="animate-pulse">
                  LIVE
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Real-time performance metrics for {mediaId ? `media ${mediaId.slice(0, 8)}...` : 'current video'}
            </CardDescription>
          </div>
          {performanceScore !== null && (
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{performanceScore}/100</div>
              <div className="text-sm text-muted-foreground">Performance Score</div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {performanceData ? (
          <>
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Load Time</span>
                </div>
                <div className={`text-lg font-bold ${loadTimeStatus?.color}`}>
                  {performanceData.loadTime}ms
                </div>
                <div className="text-xs text-muted-foreground capitalize">
                  {loadTimeStatus?.status}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Buffer Events</span>
                </div>
                <div className="text-lg font-bold">
                  {performanceData.bufferEvents}
                </div>
                <div className="text-xs text-muted-foreground">
                  Interruptions
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Quality Switches</span>
                </div>
                <div className="text-lg font-bold">
                  {performanceData.qualitySwitches}
                </div>
                <div className="text-xs text-muted-foreground">
                  Adaptations
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getNetworkQualityColor(performanceData.networkQuality)}`} />
                  <span className="text-sm font-medium">Network</span>
                </div>
                <div className="text-lg font-bold capitalize">
                  {performanceData.networkQuality}
                </div>
                <div className="text-xs text-muted-foreground">
                  Quality
                </div>
              </div>
            </div>

            {/* Performance Indicators */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Completion Rate</span>
                  <span>{performanceData.completionRate}%</span>
                </div>
                <Progress value={performanceData.completionRate} className="h-2" />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">Cache Hit</span>
                <Badge variant={performanceData.cacheHit ? "default" : "secondary"}>
                  {performanceData.cacheHit ? "YES" : "NO"}
                </Badge>
              </div>
            </div>

            {/* Performance Trend Chart */}
            {trends.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3">Load Time Trend (Last Hour)</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp"
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                      formatter={(value: number) => [`${value}ms`, 'Load Time']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="loadTime" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Performance Insights */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Performance Insights</h4>
              <div className="space-y-2 text-sm">
                {performanceData.loadTime > 3000 && (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Load time exceeds recommended threshold (3s)</span>
                  </div>
                )}
                {performanceData.bufferEvents > 2 && (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Excessive buffering may impact user experience</span>
                  </div>
                )}
                {performanceData.cacheHit && (
                  <div className="flex items-center gap-2 text-green-600">
                    <Zap className="h-4 w-4" />
                    <span>Content served from cache - optimal performance</span>
                  </div>
                )}
                {performanceData.completionRate < 50 && (
                  <div className="flex items-center gap-2 text-orange-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Low completion rate - consider content optimization</span>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No performance data available</p>
            <p className="text-sm">Start playing a video to see metrics</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};