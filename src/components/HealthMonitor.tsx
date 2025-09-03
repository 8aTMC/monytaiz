import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Activity, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EdgeFunctionStatus {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastChecked: Date;
  responseTime?: number;
  error?: string;
}

const CRITICAL_FUNCTIONS = [
  'xai-chat-assistant',
  'ai-worker', 
  'secure-media'
];

const SUPABASE_URL = 'https://alzyzfjzwvofmjccirjq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsenl6Zmp6d3ZvZm1qY2NpcmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyODkxNjMsImV4cCI6MjA3MDg2NTE2M30.DlmPO0LWTM0T4bMXJheMXdtftCVJZ5V961CUW-fEXmk';

export const HealthMonitor: React.FC = () => {
  const [functionStatuses, setFunctionStatuses] = useState<EdgeFunctionStatus[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const { toast } = useToast();

  const checkFunctionHealth = useCallback(async (functionName: string): Promise<EdgeFunctionStatus> => {
    const startTime = Date.now();
    
    try {
      // For health checks, we'll use a simple test based on the function type
      let testPayload: any = {};
      
      switch (functionName) {
        case 'xai-chat-assistant':
          testPayload = {};
          break;
        case 'ai-worker':
          testPayload = {};
          break;
        case 'secure-media':
          testPayload = { path: 'health-check' };
          break;
        default:
          testPayload = {};
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: testPayload,
        headers: { 'Content-Type': 'application/json' }
      });

      const responseTime = Date.now() - startTime;

      // Consider the function healthy if it responds (even with expected errors)
      const isHealthy = !error || 
                       error.message?.includes('no-jobs') || // ai-worker returns this when no jobs
                       error.message?.includes('Authentication required'); // expected for protected functions

      return {
        name: functionName,
        status: isHealthy ? 'healthy' : 'unhealthy',
        lastChecked: new Date(),
        responseTime,
        error: isHealthy ? undefined : error?.message || 'Unknown error'
      };
    } catch (error) {
      return {
        name: functionName,
        status: 'unhealthy',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }, []);

  const checkAllFunctions = useCallback(async () => {
    setIsChecking(true);
    
    try {
      const statusChecks = CRITICAL_FUNCTIONS.map(checkFunctionHealth);
      const results = await Promise.allSettled(statusChecks);
      
      const statuses = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            name: CRITICAL_FUNCTIONS[index],
            status: 'unhealthy' as const,
            lastChecked: new Date(),
            error: 'Health check failed'
          };
        }
      });
      
      setFunctionStatuses(statuses);
      setLastUpdate(new Date());
      
      const unhealthyCount = statuses.filter(s => s.status === 'unhealthy').length;
      if (unhealthyCount > 0) {
        toast({
          title: "Service Health Warning",
          description: `${unhealthyCount} edge function(s) are unhealthy`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Health check failed:', error);
      toast({
        title: "Health Check Failed",
        description: "Unable to check service health",
        variant: "destructive"
      });
    } finally {
      setIsChecking(false);
    }
  }, [checkFunctionHealth, toast]);

  useEffect(() => {
    checkAllFunctions();
    
    // Check every 5 minutes
    const interval = setInterval(checkAllFunctions, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkAllFunctions]);

  const getStatusIcon = (status: EdgeFunctionStatus['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'unhealthy':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: EdgeFunctionStatus['status']) => {
    const variant = status === 'healthy' ? 'default' : 
                   status === 'unhealthy' ? 'destructive' : 'secondary';
    return (
      <Badge variant={variant} className="capitalize">
        {status}
      </Badge>
    );
  };

  const overallStatus = functionStatuses.every(f => f.status === 'healthy') ? 'healthy' :
                       functionStatuses.some(f => f.status === 'unhealthy') ? 'unhealthy' : 'warning';

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          System Health Monitor
          <Button
            variant="outline"
            size="sm"
            onClick={checkAllFunctions}
            disabled={isChecking}
            className="ml-auto"
          >
            <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Checking...' : 'Refresh'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {overallStatus !== 'healthy' && (
          <Alert variant={overallStatus === 'unhealthy' ? 'destructive' : 'default'}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {overallStatus === 'unhealthy' 
                ? 'Some critical services are unhealthy. Authentication and media processing may be affected.'
                : 'System health check is in progress or some services have unknown status.'
              }
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Edge Functions Status</h4>
          <div className="grid gap-2">
            {functionStatuses.map((func) => (
              <div key={func.name} className="flex items-center justify-between p-2 border rounded-lg">
                <div className="flex items-center gap-2">
                  {getStatusIcon(func.status)}
                  <span className="font-mono text-sm">{func.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {func.responseTime && (
                    <span className="text-xs text-muted-foreground">
                      {func.responseTime}ms
                    </span>
                  )}
                  {getStatusBadge(func.status)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {lastUpdate && (
          <div className="text-xs text-muted-foreground">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        )}

        {functionStatuses.some(f => f.error) && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-red-600">Errors</h4>
            <div className="space-y-1">
              {functionStatuses
                .filter(f => f.error)
                .map(func => (
                  <div key={func.name} className="text-xs text-red-600 font-mono">
                    {func.name}: {func.error}
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};