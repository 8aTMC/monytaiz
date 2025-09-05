import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import { NetworkQualityIndicator } from './NetworkQualityIndicator';
import { 
  Monitor, 
  Gauge, 
  Activity, 
  Zap, 
  Clock,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';

interface AdaptiveStreamingDebugPanelProps {
  stats: {
    currentQuality: string;
    recommendedQuality: string;
    networkStatus: any;
    bufferHealth: {
      buffered: number;
      currentTime: number;
      duration: number;
      isBuffering: boolean;
      bufferRatio: number;
    };
    adaptiveEnabled: boolean;
    qualityHistory: Array<{
      quality: string;
      timestamp: Date;
      reason: string;
    }>;
    lastDecision?: {
      recommendedQuality: string;
      reason: string;
      confidence: number;
      shouldSwitch: boolean;
    } | null;
  };
  className?: string;
}

export const AdaptiveStreamingDebugPanel: React.FC<AdaptiveStreamingDebugPanelProps> = ({
  stats,
  className = ''
}) => {
  const { 
    currentQuality, 
    recommendedQuality, 
    networkStatus, 
    bufferHealth, 
    adaptiveEnabled,
    qualityHistory,
    lastDecision 
  } = stats;

  const getQualityTrend = () => {
    if (qualityHistory.length < 2) return 'stable';
    
    const recent = qualityHistory.slice(-2);
    const currentRes = parseInt(recent[1].quality.replace('p', ''));
    const previousRes = parseInt(recent[0].quality.replace('p', ''));
    
    if (currentRes > previousRes) return 'improving';
    if (currentRes < previousRes) return 'degrading';
    return 'stable';
  };

  const getTrendIcon = () => {
    const trend = getQualityTrend();
    switch (trend) {
      case 'improving': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'degrading': return <TrendingDown className="w-4 h-4 text-red-500" />;
      default: return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatTime = (seconds: number) => {
    return `${seconds.toFixed(1)}s`;
  };

  const getBufferHealthColor = () => {
    if (bufferHealth.buffered < 3) return 'text-red-500';
    if (bufferHealth.buffered < 8) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.5) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <Card className={`w-full max-w-md ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Monitor className="w-4 h-4" />
          Adaptive Streaming Debug
          <Badge variant={adaptiveEnabled ? 'default' : 'secondary'} className="ml-auto">
            {adaptiveEnabled ? 'Auto' : 'Manual'}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Current Quality</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{currentQuality.toUpperCase()}</Badge>
              {getTrendIcon()}
            </div>
          </div>
          
          {recommendedQuality !== currentQuality && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Recommended</span>
              <Badge variant="secondary">{recommendedQuality.toUpperCase()}</Badge>
            </div>
          )}
        </div>

        <Separator />

        {/* Network Status */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Activity className="w-4 h-4" />
            Network Status
          </div>
          
          <div className="flex items-center justify-between">
            <NetworkQualityIndicator 
              networkStatus={networkStatus} 
              showDetails={true}
              className="flex-1"
            />
          </div>
        </div>

        <Separator />

        {/* Buffer Health */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Gauge className="w-4 h-4" />
            Buffer Health
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Buffered</span>
              <span className={getBufferHealthColor()}>
                {formatTime(bufferHealth.buffered)}
              </span>
            </div>
            
            <Progress 
              value={Math.min((bufferHealth.buffered / 10) * 100, 100)} 
              className="h-1"
            />
            
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Ratio: {bufferHealth.bufferRatio.toFixed(1)}%</span>
              <span>{bufferHealth.isBuffering ? 'Buffering' : 'Playing'}</span>
            </div>
          </div>
        </div>

        {/* Last Decision */}
        {lastDecision && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Zap className="w-4 h-4" />
                Last Decision
              </div>
              
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reason</span>
                  <Badge variant="outline" className="text-xs">
                    {lastDecision.reason}
                  </Badge>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Confidence</span>
                  <span className={getConfidenceColor(lastDecision.confidence)}>
                    {(lastDecision.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Should Switch</span>
                  <span className={lastDecision.shouldSwitch ? 'text-green-500' : 'text-gray-500'}>
                    {lastDecision.shouldSwitch ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Quality History */}
        {qualityHistory.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="w-4 h-4" />
                Recent Changes
              </div>
              
              <div className="space-y-1 max-h-20 overflow-y-auto">
                {qualityHistory.slice(-3).map((entry, index) => (
                  <div key={index} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {entry.timestamp.toLocaleTimeString()}
                    </span>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-xs">
                        {entry.quality.toUpperCase()}
                      </Badge>
                      <span className="text-muted-foreground">({entry.reason})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};