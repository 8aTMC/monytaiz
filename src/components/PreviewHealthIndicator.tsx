import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, AlertTriangle, Settings } from 'lucide-react';
import { logger } from '@/utils/logging';

interface HealthStatus {
  level: 'healthy' | 'degraded' | 'offline';
  message: string;
  telemetryConnected: boolean;
}

const PreviewHealthIndicator: React.FC = () => {
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({
    level: 'healthy',
    message: 'All systems operational',
    telemetryConnected: false
  });
  const [isVisible, setIsVisible] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  
  useEffect(() => {
    const config = logger.getConfig();
    
    // Only show in Lovable preview environment
    if (config.isLovablePreview) {
      setIsVisible(true);
    }
    
    setDebugMode(config.enableNetworkDiagnostics);
  }, []);
  
  // Update health status based on telemetry only
  useEffect(() => {
    // Check if telemetry/logging is configured
    const config = logger.getConfig();
    const telemetryConnected = config.enableTelemetryLogs;
    
    setHealthStatus({
      level: 'healthy',
      message: 'All systems operational',
      telemetryConnected
    });
  }, []);
  
  const getStatusIcon = () => {
    switch (healthStatus.level) {
      case 'offline':
        return <WifiOff className="w-3 h-3" />;
      case 'degraded':
        return <AlertTriangle className="w-3 h-3" />;
      default:
        return <Wifi className="w-3 h-3" />;
    }
  };
  
  const getStatusColor = () => {
    switch (healthStatus.level) {
      case 'offline':
        return 'destructive';
      case 'degraded':
        return 'secondary';
      default:
        return 'default';
    }
  };
  
  const getStatusText = () => {
    const baseText = healthStatus.level === 'healthy' ? 'Preview OK' : 
                    healthStatus.level === 'degraded' ? 'Preview Degraded' : 'Preview Offline';
    
    if (!healthStatus.telemetryConnected && debugMode) {
      return `${baseText} (Telemetry disconnected)`;
    }
    
    return baseText;
  };
  
  const toggleDebugMode = () => {
    const newMode = !debugMode;
    setDebugMode(newMode);
    logger.enableNetworkDebug(newMode);
    
    if (newMode) {
      logger.info('Network debugging enabled - detailed logs will appear in console');
    } else {
      logger.info('Network debugging disabled - logs will be minimal');
    }
  };
  
  // Don't render if not in preview environment and no issues
  if (!isVisible && healthStatus.level === 'healthy') {
    return null;
  }
  
  return (
    <TooltipProvider>
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
        {/* Health Status Badge */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant={getStatusColor()} 
              className="flex items-center gap-1 px-2 py-1 text-xs cursor-help"
            >
              {getStatusIcon()}
              {getStatusText()}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="text-sm">
              <p className="font-medium">{healthStatus.message}</p>
              {!healthStatus.telemetryConnected && (
                <p className="text-muted-foreground mt-1">
                  Telemetry connection issues detected. This is normal if using VPN or ad blockers.
                </p>
              )}
              {debugMode && (
                <p className="text-muted-foreground mt-1">
                  Debug mode active - check console for detailed logs
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
        
        {/* Debug Toggle (only in preview environment) */}
        {isVisible && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={toggleDebugMode}
              >
                <Settings className={`w-3 h-3 ${debugMode ? 'text-primary' : 'text-muted-foreground'}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {debugMode ? 'Disable network debugging' : 'Enable network debugging'}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
};

export default PreviewHealthIndicator;