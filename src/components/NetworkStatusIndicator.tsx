import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Wifi, WifiOff, AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { useNetworkMonitor } from '@/hooks/useNetworkMonitor';
import { networkDiagnostics, type ComprehensiveDiagnostic } from '@/utils/NetworkDiagnostics';
import { useToast } from '@/components/ui/use-toast';

interface NetworkStatusIndicatorProps {
  showDetails?: boolean;
  className?: string;
}

export const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({ 
  showDetails = false, 
  className = '' 
}) => {
  const { networkStatus, updateNetworkStatus } = useNetworkMonitor();
  const [diagnostic, setDiagnostic] = useState<ComprehensiveDiagnostic | null>(null);
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const getStatusIcon = () => {
    if (!networkStatus.isOnline) {
      return <WifiOff className="w-4 h-4 text-destructive" />;
    }
    
    if (networkStatus.speed === 'fast' && networkStatus.isStable) {
      return <Wifi className="w-4 h-4 text-success" />;
    }
    
    if (networkStatus.speed === 'very-slow' || !networkStatus.isStable) {
      return <AlertTriangle className="w-4 h-4 text-warning" />;
    }
    
    return <Wifi className="w-4 h-4 text-primary" />;
  };

  const getStatusColor = () => {
    if (!networkStatus.isOnline) return 'destructive';
    if (networkStatus.speed === 'fast' && networkStatus.isStable) return 'default';
    if (networkStatus.speed === 'very-slow' || !networkStatus.isStable) return 'destructive';
    return 'secondary';
  };

  const getStatusText = () => {
    if (!networkStatus.isOnline) return 'Offline';
    if (networkStatus.speed === 'fast' && networkStatus.isStable) return 'Excellent';
    if (networkStatus.speed === 'very-slow' || !networkStatus.isStable) return 'Poor';
    return 'Good';
  };

  const runDiagnostic = async () => {
    setIsRunningDiagnostic(true);
    try {
      const result = await networkDiagnostics.runComprehensiveDiagnostic();
      setDiagnostic(result);
      
      if (result.overallStatus === 'critical') {
        toast({
          title: "Network Issues Detected",
          description: "Critical network problems found. Check diagnostic details.",
          variant: "destructive",
        });
      } else if (result.overallStatus === 'degraded') {
        toast({
          title: "Network Issues Detected",
          description: "Some network problems detected. Performance may be affected.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Network Status",
          description: "Network appears to be functioning normally.",
        });
      }
    } catch (error) {
      console.error('Diagnostic failed:', error);
      toast({
        title: "Diagnostic Failed",
        description: "Unable to run network diagnostic. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRunningDiagnostic(false);
    }
  };

  const clearCacheAndRetry = async () => {
    try {
      await networkDiagnostics.clearNetworkCache();
      updateNetworkStatus();
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
      toast({
        title: "Cache Cleared",  
        description: "Network cache cleared. Reloading page...",
      });
    } catch (error) {
      toast({
        title: "Clear Failed",
        description: "Failed to clear cache. Try manually clearing browser cache.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadgeIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-3 h-3" />;
      case 'warning': return <AlertTriangle className="w-3 h-3" />;
      case 'error': return <WifiOff className="w-3 h-3" />;
      default: return <Clock className="w-3 h-3" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'success': return 'default';
      case 'warning': return 'secondary';
      case 'error': return 'destructive';
      default: return 'secondary';
    }
  };

  // Auto-run diagnostic on mount if network seems problematic
  useEffect(() => {
    if (!networkStatus.isOnline || networkStatus.speed === 'very-slow') {
      const timer = setTimeout(() => {
        runDiagnostic();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [networkStatus.isOnline, networkStatus.speed]);

  if (!showDetails) {
    // Simple indicator mode
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {getStatusIcon()}
        <Badge variant={getStatusColor()}>
          {getStatusText()}
        </Badge>
      </div>
    );
  }

  // Detailed mode with dialog
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {!networkStatus.isOnline && (
        <Alert variant="destructive" className="mb-4">
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            No internet connection detected. Please check your network settings.
          </AlertDescription>
        </Alert>
      )}
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="flex items-center gap-2">
            {getStatusIcon()}
            <span>Network: {getStatusText()}</span>
          </Button>
        </DialogTrigger>
        
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Network Diagnostics</DialogTitle>
            <DialogDescription>
              Comprehensive network status and troubleshooting information
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4">
              {/* Current Status */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Current Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Connection</span>
                    <Badge variant={networkStatus.isOnline ? 'default' : 'destructive'}>
                      {networkStatus.isOnline ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Speed</span>
                    <Badge variant="secondary">{networkStatus.speed}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Stability</span>
                    <Badge variant={networkStatus.isStable ? 'default' : 'destructive'}>
                      {networkStatus.isStable ? 'Stable' : 'Unstable'}
                    </Badge>
                  </div>
                  {networkStatus.quality.downlink > 0 && (
                    <div className="flex items-center justify-between">
                      <span>Bandwidth</span>
                      <span className="text-sm text-muted-foreground">
                        {networkStatus.quality.downlink.toFixed(1)} Mbps
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button 
                  onClick={runDiagnostic} 
                  disabled={isRunningDiagnostic}
                  size="sm"
                >
                  {isRunningDiagnostic && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                  Run Diagnostic
                </Button>
                <Button 
                  onClick={clearCacheAndRetry} 
                  variant="outline" 
                  size="sm"
                >
                  Clear Cache & Retry
                </Button>
                <Button 
                  onClick={updateNetworkStatus} 
                  variant="ghost" 
                  size="sm"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Status
                </Button>
              </div>

              {/* Diagnostic Results */}
              {diagnostic && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      Diagnostic Results
                      <Badge variant={
                        diagnostic.overallStatus === 'healthy' ? 'default' :
                        diagnostic.overallStatus === 'degraded' ? 'secondary' : 'destructive'
                      }>
                        {diagnostic.overallStatus}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Last run: {new Date(diagnostic.timestamp).toLocaleTimeString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {diagnostic.results.map((result, index) => (
                      <div key={index} className="flex items-center justify-between p-2 rounded border">
                        <div className="flex items-center gap-2">
                          {getStatusBadgeIcon(result.status)}
                          <span className="font-medium">{result.test}</span>
                        </div>
                        <Badge variant={getStatusBadgeVariant(result.status)}>
                          {result.status}
                        </Badge>
                      </div>
                    ))}
                    
                    {diagnostic.recommendations.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2">Recommendations:</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {diagnostic.recommendations.map((rec, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-primary">•</span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NetworkStatusIndicator;