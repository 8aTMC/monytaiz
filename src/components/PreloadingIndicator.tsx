import React from 'react';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Loader2, Zap, Brain, Database } from 'lucide-react';

interface PreloadingIndicatorProps {
  isPreloading: boolean;
  progress?: number;
  cacheHitRate?: number;
  predictiveHits?: number;
  networkSpeed?: string;
  showDetails?: boolean;
  className?: string;
}

export const PreloadingIndicator: React.FC<PreloadingIndicatorProps> = ({
  isPreloading,
  progress = 0,
  cacheHitRate = 0,
  predictiveHits = 0,
  networkSpeed = 'medium',
  showDetails = false,
  className = ''
}) => {
  if (!isPreloading && !showDetails) return null;

  const getNetworkColor = (speed: string) => {
    switch (speed) {
      case 'fast': return 'bg-success';
      case 'medium': return 'bg-warning';
      case 'slow': return 'bg-destructive';
      default: return 'bg-muted';
    }
  };

  const getNetworkIcon = (speed: string) => {
    switch (speed) {
      case 'fast': return '🚀';
      case 'medium': return '🌊';
      case 'slow': return '🐌';
      default: return '📶';
    }
  };

  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg bg-muted/50 ${className}`}>
      {isPreloading && (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Preloading...</span>
        </>
      )}
      
      {progress > 0 && (
        <div className="flex-1 min-w-24">
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {showDetails && (
        <div className="flex items-center gap-1">
          {/* Network Speed Indicator */}
          <Badge variant="outline" className="text-xs">
            <span className="mr-1">{getNetworkIcon(networkSpeed)}</span>
            {networkSpeed}
          </Badge>

          {/* Cache Hit Rate */}
          {cacheHitRate > 0 && (
            <Badge variant="secondary" className="text-xs">
              <Database className="h-3 w-3 mr-1" />
              {Math.round(cacheHitRate * 100)}%
            </Badge>
          )}

          {/* Predictive Hits */}
          {predictiveHits > 0 && (
            <Badge variant="default" className="text-xs">
              <Brain className="h-3 w-3 mr-1" />
              {predictiveHits}
            </Badge>
          )}

          {/* Smart Indicator */}
          <Badge variant="outline" className="text-xs">
            <Zap className="h-3 w-3 mr-1" />
            Smart
          </Badge>
        </div>
      )}
    </div>
  );
};