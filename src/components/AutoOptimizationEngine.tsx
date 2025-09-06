import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  Zap, 
  TrendingUp, 
  Settings, 
  Activity,
  Wifi,
  HardDrive,
  Play
} from 'lucide-react';
import { useIntelligentOptimizer } from '@/hooks/useIntelligentOptimizer';
import { supabase } from '@/integrations/supabase/client';

interface AutoOptimizationEngineProps {
  userId?: string;
  mediaId?: string;
  onOptimizationApplied?: (optimization: any) => void;
}

const AutoOptimizationEngine: React.FC<AutoOptimizationEngineProps> = ({
  userId,
  mediaId,
  onOptimizationApplied
}) => {
  const {
    optimizationProfile,
    isOptimizing,
    recentDecisions,
    networkConditions,
    initializeProfile,
    startOptimization,
    stopOptimization,
    analyzeNetworkConditions
  } = useIntelligentOptimizer();

  const [autoMode, setAutoMode] = useState(false);
  const [optimizationStats, setOptimizationStats] = useState({
    totalOptimizations: 0,
    successRate: 0,
    performanceGain: 0
  });

  // Initialize on mount
  useEffect(() => {
    if (userId) {
      initializeProfile(userId);
      analyzeNetworkConditions();
    }
  }, [userId, initializeProfile, analyzeNetworkConditions]);

  // Handle auto mode toggle
  const handleAutoModeToggle = async (enabled: boolean) => {
    setAutoMode(enabled);
    
    if (enabled && userId) {
      startOptimization(userId, mediaId);
    } else {
      stopOptimization();
    }
  };

  // Fetch optimization statistics
  useEffect(() => {
    const fetchStats = async () => {
      if (!userId) return;

      try {
        const { data: metrics } = await supabase
          .from('system_health_metrics')
          .select('*')
          .eq('metric_type', 'optimization_applied')
          .order('created_at', { ascending: false })
          .limit(100);

        if (metrics) {
          const total = metrics.length;
          const successful = metrics.filter(m => m.metric_value > 0.7).length;
          const successRate = total > 0 ? (successful / total) * 100 : 0;
          const avgGain = metrics.reduce((sum, m) => sum + m.metric_value, 0) / total || 0;

          setOptimizationStats({
            totalOptimizations: total,
            successRate,
            performanceGain: avgGain * 100
          });
        }
      } catch (error) {
        console.error('Failed to fetch optimization stats:', error);
      }
    };

    fetchStats();
  }, [userId, recentDecisions]);

  // Get network quality indicator
  const getNetworkQuality = () => {
    if (!networkConditions) return { label: 'Unknown', color: 'gray' };
    
    const { bandwidth, stability } = networkConditions;
    const score = (bandwidth / 10) * stability;
    
    if (score > 0.8) return { label: 'Excellent', color: 'green' };
    if (score > 0.6) return { label: 'Good', color: 'blue' };
    if (score > 0.4) return { label: 'Fair', color: 'yellow' };
    return { label: 'Poor', color: 'red' };
  };

  const networkQuality = getNetworkQuality();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center space-x-2">
            <Brain className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Intelligent Auto-Optimization</CardTitle>
              <CardDescription>
                AI-powered system for automatic performance optimization
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label htmlFor="auto-mode" className="text-sm font-medium">
                Auto Mode
              </label>
              <Switch
                id="auto-mode"
                checked={autoMode}
                onCheckedChange={handleAutoModeToggle}
              />
            </div>
            {isOptimizing && (
              <Badge variant="default" className="animate-pulse">
                <Activity className="h-3 w-3 mr-1" />
                Optimizing
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Network Conditions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network Status</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Quality</span>
                <Badge variant={networkQuality.color === 'green' ? 'default' : 'secondary'}>
                  {networkQuality.label}
                </Badge>
              </div>
              {networkConditions && (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Bandwidth</span>
                      <span>{networkConditions.bandwidth.toFixed(1)} Mbps</span>
                    </div>
                    <Progress value={(networkConditions.bandwidth / 50) * 100} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Stability</span>
                      <span>{(networkConditions.stability * 100).toFixed(0)}%</span>
                    </div>
                    <Progress value={networkConditions.stability * 100} className="h-2" />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Trend</span>
                    <Badge variant={
                      networkConditions.trend === 'improving' ? 'default' :
                      networkConditions.trend === 'degrading' ? 'destructive' : 'secondary'
                    }>
                      {networkConditions.trend}
                    </Badge>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Optimization Profile */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">User Profile</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {optimizationProfile ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Device</span>
                  <Badge variant="outline">{optimizationProfile.deviceType}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Network</span>
                  <Badge variant="outline">{optimizationProfile.networkType}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Quality</span>
                  <Badge variant="outline">{optimizationProfile.preferredQuality}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Buffer</span>
                  <Badge variant="outline">{optimizationProfile.bufferPreference}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Cache</span>
                  <Badge variant="outline">{optimizationProfile.cacheStrategy}</Badge>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Profile learning in progress...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Stats */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance Stats</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Optimizations Applied</span>
                  <span className="font-medium">{optimizationStats.totalOptimizations}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Success Rate</span>
                  <span className="font-medium">{optimizationStats.successRate.toFixed(1)}%</span>
                </div>
                <Progress value={optimizationStats.successRate} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Performance Gain</span>
                  <span className="font-medium">+{optimizationStats.performanceGain.toFixed(1)}%</span>
                </div>
                <Progress value={optimizationStats.performanceGain} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Optimizations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>Recent Optimizations</span>
          </CardTitle>
          <CardDescription>
            Latest AI-driven optimization decisions and their outcomes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentDecisions.length > 0 ? (
            <div className="space-y-3">
              {recentDecisions.slice(0, 5).map((decision, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-primary/10 rounded-full">
                      {decision.action === 'quality_change' && <Play className="h-4 w-4 text-primary" />}
                      {decision.action === 'preload_adjust' && <HardDrive className="h-4 w-4 text-primary" />}
                      {decision.action === 'cache_evict' && <Activity className="h-4 w-4 text-primary" />}
                      {decision.action === 'buffer_adjust' && <Wifi className="h-4 w-4 text-primary" />}
                    </div>
                    <div>
                      <div className="font-medium text-sm capitalize">
                        {decision.action.replace('_', ' ')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {decision.reason}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge 
                      variant={decision.confidence > 0.8 ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {(decision.confidence * 100).toFixed(0)}% confidence
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-6">
              <Brain className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No optimizations applied yet</p>
              <p className="text-sm">Enable Auto Mode to start intelligent optimization</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AutoOptimizationEngine;