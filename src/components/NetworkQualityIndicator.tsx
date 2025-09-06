import React from 'react';
import { Wifi, WifiOff, Signal, SignalHigh, SignalLow, SignalMedium } from 'lucide-react';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { NetworkStatus } from '@/hooks/useNetworkMonitor';

interface NetworkQualityIndicatorProps {
  networkStatus: NetworkStatus;
  className?: string;
  showDetails?: boolean;
}

export const NetworkQualityIndicator: React.FC<NetworkQualityIndicatorProps> = ({
  networkStatus,
  className = '',
  showDetails = false
}) => {
  const getSignalIcon = () => {
    if (!networkStatus.isOnline) return <WifiOff className="w-4 h-4" />;
    
    switch (networkStatus.speed) {
      case 'fast':
        return <SignalHigh className="w-4 h-4" />;
      case 'medium':
        return <SignalMedium className="w-4 h-4" />;
      case 'slow':
        return <SignalLow className="w-4 h-4" />;
      case 'very-slow':
        return <Signal className="w-4 h-4" />;
      default:
        return <Wifi className="w-4 h-4" />;
    }
  };

  const getColorClass = () => {
    if (!networkStatus.isOnline) return 'text-destructive';
    if (!networkStatus.isStable) return 'text-warning';
    
    switch (networkStatus.speed) {
      case 'fast':
        return 'text-success';
      case 'medium':
        return 'text-primary';
      case 'slow':
        return 'text-warning';
      case 'very-slow':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  const getBadgeVariant = (): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (!networkStatus.isOnline) return 'destructive';
    if (!networkStatus.isStable) return 'secondary';
    
    switch (networkStatus.speed) {
      case 'fast':
        return 'default';
      case 'medium':
        return 'default';
      case 'slow':
        return 'secondary';
      case 'very-slow':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusText = () => {
    if (!networkStatus.isOnline) return 'Offline';
    
    const stability = networkStatus.isStable ? 'Stable' : 'Unstable';
    const speed = networkStatus.speed.charAt(0).toUpperCase() + networkStatus.speed.slice(1);
    
    return `${speed} (${stability})`;
  };

  const getTooltipContent = () => {
    const { quality, speed, isStable, lastMeasured } = networkStatus;
    
    return (
      <div className="space-y-2 text-sm">
        <div>
          <strong>Connection:</strong> {networkStatus.isOnline ? 'Online' : 'Offline'}
        </div>
        {networkStatus.isOnline && (
          <>
            <div>
              <strong>Speed:</strong> {speed} ({quality.downlink.toFixed(1)} Mbps)
            </div>
            <div>
              <strong>Type:</strong> {quality.effectiveType}
            </div>
            <div>
              <strong>Latency:</strong> {quality.rtt}ms
            </div>
            <div>
              <strong>Stability:</strong> {isStable ? 'Stable' : 'Unstable'}
            </div>
            {quality.saveData && (
              <div className="text-warning">
                <strong>Data Saver:</strong> Enabled
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Last updated: {lastMeasured.toLocaleTimeString()}
            </div>
          </>
        )}
      </div>
    );
  };

  if (showDetails) {
    return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-2 ${className}`}>
              <div className={getColorClass()}>
                {getSignalIcon()}
              </div>
              <Badge variant={getBadgeVariant()} className="text-xs">
                {getStatusText()}
              </Badge>
              {networkStatus.quality.downlink > 0 && (
                <span className="text-xs text-muted-foreground">
                  {networkStatus.quality.downlink.toFixed(1)} Mbps
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {getTooltipContent()}
          </TooltipContent>
        </Tooltip>
    );
  }

  return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`${getColorClass()} ${className}`}>
            {getSignalIcon()}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
  );
};