import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Wifi, RefreshCw, CheckCircle } from 'lucide-react';
import { useNetworkMonitor } from '@/hooks/useNetworkMonitor';
import { networkDiagnostics } from '@/utils/NetworkDiagnostics';
import { useToast } from '@/components/ui/use-toast';
import { logger } from '@/utils/logging';

interface ConnectionRecoveryProps {
  onRecoveryComplete?: () => void;
  autoRecover?: boolean;
}

export const ConnectionRecovery: React.FC<ConnectionRecoveryProps> = ({
  onRecoveryComplete,
  autoRecover = true
}) => {
  const { networkStatus, updateNetworkStatus } = useNetworkMonitor();
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState('');
  const [recoveryProgress, setRecoveryProgress] = useState(0);
  const [showRecovery, setShowRecovery] = useState(false);
  const { toast } = useToast();

  const recoverySteps = [
    { step: 'Checking network status...', progress: 20 },
    { step: 'Testing DNS resolution...', progress: 40 },
    { step: 'Verifying service connectivity...', progress: 60 },
    { step: 'Clearing network cache...', progress: 80 },
    { step: 'Restoring connection...', progress: 100 }
  ];

  const performRecovery = async () => {
    setIsRecovering(true);
    setRecoveryProgress(0);

    try {
      for (const { step, progress } of recoverySteps) {
        setRecoveryStep(step);
        setRecoveryProgress(progress);
        
        switch (progress) {
          case 20:
            updateNetworkStatus();
            await new Promise(resolve => setTimeout(resolve, 1000));
            break;
          case 40:
            await networkDiagnostics.quickHealthCheck();
            await new Promise(resolve => setTimeout(resolve, 1500));
            break;
          case 60:
            const diagnostic = await networkDiagnostics.runComprehensiveDiagnostic();
            if (diagnostic.overallStatus === 'critical') {
              throw new Error('Network connectivity issues detected');
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            break;
          case 80:
            await networkDiagnostics.clearNetworkCache();
            await new Promise(resolve => setTimeout(resolve, 1000));
            break;
          case 100:
            // Final verification
            const isHealthy = await networkDiagnostics.quickHealthCheck();
            if (!isHealthy) {
              throw new Error('Recovery verification failed');
            }
            break;
        }
      }

      setRecoveryStep('Recovery complete!');
      
      toast({
        title: "Connection Restored",
        description: "Network connection has been successfully recovered.",
      });

      // Wait a moment then hide recovery UI
      setTimeout(() => {
        setShowRecovery(false);
        onRecoveryComplete?.();
      }, 2000);

    } catch (error) {
      logger.error('Recovery failed', error);
      setRecoveryStep(`Recovery failed: ${error.message}`);
      
      toast({
        title: "Recovery Failed",
        description: "Automatic recovery failed. Please try manual troubleshooting.",
        variant: "destructive",
      });
    } finally {
      setIsRecovering(false);
    }
  };

  // Monitor network status and show recovery when needed (with reduced sensitivity)
  useEffect(() => {
    // Only show recovery for true connectivity issues, not authentication problems
    const shouldShowRecovery = !networkStatus.isOnline || 
                               (networkStatus.speed === 'very-slow' && networkStatus.isOnline);
    
    if (shouldShowRecovery && !showRecovery && autoRecover) {
      logger.debug('Triggering connection recovery UI');
      setShowRecovery(true);
      // Auto-start recovery after a brief delay
      const timer = setTimeout(() => {
        if (!isRecovering) {
          performRecovery();
        }
      }, 3000);
      
      return () => clearTimeout(timer);
    } else if (!shouldShowRecovery && showRecovery) {
      setShowRecovery(false);
      logger.debug('Connection recovery UI auto-hidden');
    }
  }, [networkStatus, showRecovery, autoRecover, isRecovering]);

  if (!showRecovery) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isRecovering ? (
              <RefreshCw className="w-5 h-5 animate-spin text-primary" />
            ) : networkStatus.isOnline ? (
              <CheckCircle className="w-5 h-5 text-success" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-destructive" />
            )}
            Connection Recovery
          </CardTitle>
          <CardDescription>
            {networkStatus.isOnline 
              ? "Network connection issues detected" 
              : "No internet connection detected"
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {!networkStatus.isOnline && (
            <Alert variant="destructive">
              <Wifi className="h-4 w-4" />
              <AlertDescription>
                Please check your internet connection and try again.
              </AlertDescription>
            </Alert>
          )}

          {isRecovering && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {recoveryStep}
              </div>
              <Progress value={recoveryProgress} className="w-full" />
            </div>
          )}

          <div className="flex flex-col gap-2">
            {!isRecovering && (
              <Button onClick={performRecovery} className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" />
                Start Recovery
              </Button>
            )}
            
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
              disabled={isRecovering}
            >
              Reload Page
            </Button>
            
            <Button 
              variant="ghost" 
              onClick={() => setShowRecovery(false)}
              disabled={isRecovering}
            >
              Dismiss
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            If problems persist, try:
            <ul className="mt-1 space-y-1 list-disc list-inside">
              <li>Checking your internet connection</li>
              <li>Disabling browser extensions</li>
              <li>Clearing browser cache</li>
              <li>Using incognito/private mode</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConnectionRecovery;