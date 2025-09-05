import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Brain, 
  Database, 
  Zap, 
  TrendingUp, 
  Clock, 
  Users, 
  BarChart3, 
  Settings2,
  RefreshCw,
  Eye
} from 'lucide-react';

interface DebugStats {
  cache: {
    hitRate: number;
    missRate: number;
    size: number;
    entryCount: number;
    predictiveHits: number;
  };
  behavior: {
    totalViews: number;
    avgViewDuration: number;
    scrollSpeed: number;
    sessionDuration: number;
    sessionItems: number;
    mostActiveHour: number;
  };
  preloading: {
    isPreloading: boolean;
    queueSize: number;
    networkSpeed: string;
    adaptiveEnabled: boolean;
    maxConcurrent: number;
  };
  predictions: Array<{
    itemId: string;
    score: number;
    reasons: string[];
  }>;
}

interface SmartPreloadDebugPanelProps {
  stats: DebugStats;
  onOptimizeCache?: () => void;
  onResetBehavior?: () => void;
  onToggleAdaptive?: () => void;
  className?: string;
}

export const SmartPreloadDebugPanel: React.FC<SmartPreloadDebugPanelProps> = ({
  stats,
  onOptimizeCache,
  onResetBehavior,
  onToggleAdaptive,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getPerformanceColor = (value: number, thresholds: { good: number; ok: number }) => {
    if (value >= thresholds.good) return 'text-success';
    if (value >= thresholds.ok) return 'text-warning';
    return 'text-destructive';
  };

  if (!isVisible) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsVisible(true)}
        className={`fixed bottom-4 right-4 z-50 ${className}`}
      >
        <Eye className="h-4 w-4 mr-2" />
        Debug
      </Button>
    );
  }

  return (
    <Card className={`fixed bottom-4 right-4 w-96 max-h-96 z-50 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Smart Preload Debug
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
          >
            ×
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 max-h-80 overflow-y-auto">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4 text-xs">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="cache">Cache</TabsTrigger>
            <TabsTrigger value="behavior">Behavior</TabsTrigger>
            <TabsTrigger value="predictions">AI</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span className={getPerformanceColor(stats.cache.hitRate * 100, { good: 80, ok: 60 })}>
                  {Math.round(stats.cache.hitRate * 100)}% Cache Hit
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                <span className="text-muted-foreground">
                  {stats.cache.predictiveHits} Predicted
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="text-muted-foreground">
                  {formatDuration(stats.behavior.avgViewDuration)} Avg View
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <Badge variant={stats.preloading.isPreloading ? "default" : "secondary"}>
                  {stats.preloading.isPreloading ? 'Active' : 'Idle'}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Network: {stats.preloading.networkSpeed}</span>
                <span>{formatFileSize(stats.cache.size)}</span>
              </div>
              <Progress value={Math.min(100, (stats.cache.size / (50 * 1024 * 1024)) * 100)} />
            </div>
          </TabsContent>

          <TabsContent value="cache" className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Hit Rate:</span>
                <div className={getPerformanceColor(stats.cache.hitRate * 100, { good: 80, ok: 60 })}>
                  {Math.round(stats.cache.hitRate * 100)}%
                </div>
              </div>
              
              <div>
                <span className="text-muted-foreground">Entries:</span>
                <div>{stats.cache.entryCount}</div>
              </div>
              
              <div>
                <span className="text-muted-foreground">Size:</span>
                <div>{formatFileSize(stats.cache.size)}</div>
              </div>
              
              <div>
                <span className="text-muted-foreground">AI Hits:</span>
                <div className="text-success">{stats.cache.predictiveHits}</div>
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Cache Usage</span>
                <span>{Math.round((stats.cache.size / (50 * 1024 * 1024)) * 100)}%</span>
              </div>
              <Progress value={Math.min(100, (stats.cache.size / (50 * 1024 * 1024)) * 100)} />
            </div>
            
            <Button size="sm" onClick={onOptimizeCache} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Optimize Cache
            </Button>
          </TabsContent>

          <TabsContent value="behavior" className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Total Views:</span>
                <div>{stats.behavior.totalViews}</div>
              </div>
              
              <div>
                <span className="text-muted-foreground">Session Items:</span>
                <div>{stats.behavior.sessionItems}</div>
              </div>
              
              <div>
                <span className="text-muted-foreground">Avg View Time:</span>
                <div>{formatDuration(stats.behavior.avgViewDuration)}</div>
              </div>
              
              <div>
                <span className="text-muted-foreground">Scroll Speed:</span>
                <div>{stats.behavior.scrollSpeed.toFixed(1)}px/ms</div>
              </div>
              
              <div>
                <span className="text-muted-foreground">Session:</span>
                <div>{formatDuration(stats.behavior.sessionDuration)}</div>
              </div>
              
              <div>
                <span className="text-muted-foreground">Peak Hour:</span>
                <div>{stats.behavior.mostActiveHour}:00</div>
              </div>
            </div>
            
            <Button size="sm" onClick={onResetBehavior} variant="outline" className="w-full">
              <Settings2 className="h-4 w-4 mr-2" />
              Reset Behavior
            </Button>
          </TabsContent>

          <TabsContent value="predictions" className="space-y-2">
            <div className="text-sm space-y-2">
              {stats.predictions.slice(0, 5).map((pred, index) => (
                <div key={pred.itemId} className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs truncate">
                      {pred.itemId.slice(-8)}
                    </div>
                    <div className="flex gap-1 mt-1">
                      {pred.reasons.slice(0, 2).map(reason => (
                        <Badge key={reason} variant="secondary" className="text-xs px-1 py-0">
                          {reason.split('_')[0]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${getPerformanceColor(pred.score, { good: 80, ok: 60 })}`}>
                      {Math.round(pred.score)}%
                    </div>
                  </div>
                </div>
              ))}
              
              {stats.predictions.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-4">
                  No predictions available
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};