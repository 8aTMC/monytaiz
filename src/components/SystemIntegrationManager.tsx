import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Shield, 
  Zap, 
  Brain, 
  Network, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Settings
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  components: {
    name: string;
    status: 'online' | 'degraded' | 'offline';
    uptime: number;
    latency: number;
    lastCheck: Date;
  }[];
  conflicts: {
    id: string;
    type: 'optimization' | 'resource' | 'policy';
    description: string;
    severity: 'low' | 'medium' | 'high';
    autoResolved: boolean;
  }[];
}

export const SystemIntegrationManager: React.FC = () => {
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    overall: 'healthy',
    components: [
      { name: 'Performance Monitor', status: 'online', uptime: 99.8, latency: 45, lastCheck: new Date() },
      { name: 'ML Decision Engine', status: 'online', uptime: 99.5, latency: 120, lastCheck: new Date() },
      { name: 'Predictive Analytics', status: 'online', uptime: 98.9, latency: 200, lastCheck: new Date() },
      { name: 'Auto Optimization', status: 'degraded', uptime: 95.2, latency: 350, lastCheck: new Date() },
      { name: 'Security Monitor', status: 'online', uptime: 99.9, latency: 30, lastCheck: new Date() }
    ],
    conflicts: []
  });

  const [integrationSettings, setIntegrationSettings] = useState({
    autoConflictResolution: true,
    fallbackEnabled: true,
    smartLoadBalancing: true,
    emergencyShutoff: false
  });

  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    // Simulate real-time health monitoring
    const interval = setInterval(() => {
      setSystemHealth(prev => ({
        ...prev,
        components: prev.components.map(comp => ({
          ...comp,
          latency: Math.max(20, comp.latency + (Math.random() - 0.5) * 20),
          lastCheck: new Date()
        }))
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const runIntegrationTests = async () => {
    setIsRunningTests(true);
    const tests = [
      'Performance monitoring integration',
      'ML model conflict detection',
      'Optimization strategy coordination',
      'Fallback mechanism validation',
      'Security policy enforcement',
      'Load balancing effectiveness'
    ];

    const results = [];
    for (let i = 0; i < tests.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 800));
      const success = Math.random() > 0.2; // 80% success rate
      results.push({
        test: tests[i],
        status: success ? 'passed' : 'failed',
        duration: Math.floor(Math.random() * 1000) + 200
      });
    }

    setTestResults(results);
    setIsRunningTests(false);
    
    toast({
      title: "Integration Tests Completed",
      description: `${results.filter(r => r.status === 'passed').length}/${results.length} tests passed`
    });
  };

  const resolveConflict = (conflictId: string) => {
    setSystemHealth(prev => ({
      ...prev,
      conflicts: prev.conflicts.map(conflict => 
        conflict.id === conflictId 
          ? { ...conflict, autoResolved: true }
          : conflict
      )
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': case 'passed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'offline': case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            System Integration Overview
          </CardTitle>
          <CardDescription>
            Monitor and manage integration between all optimization components
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <Badge variant={systemHealth.overall === 'healthy' ? 'default' : 'destructive'}>
                {systemHealth.overall.toUpperCase()}
              </Badge>
              <p className="text-sm text-muted-foreground mt-1">Overall Status</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {systemHealth.components.filter(c => c.status === 'online').length}
              </div>
              <p className="text-sm text-muted-foreground">Components Online</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">
                {systemHealth.conflicts.filter(c => !c.autoResolved).length}
              </div>
              <p className="text-sm text-muted-foreground">Active Conflicts</p>
            </div>
          </div>

          <Tabs defaultValue="components" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="components">Components</TabsTrigger>
              <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
              <TabsTrigger value="tests">Tests</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="components" className="space-y-4">
              {systemHealth.components.map((component, index) => (
                <Card key={index}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(component.status)}
                        <span className="font-medium">{component.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Uptime: {component.uptime}%</span>
                        <span>Latency: {Math.round(component.latency)}ms</span>
                      </div>
                    </div>
                    <Progress value={component.uptime} className="mt-2" />
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="conflicts" className="space-y-4">
              {systemHealth.conflicts.length === 0 ? (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>No active conflicts detected</AlertDescription>
                </Alert>
              ) : (
                systemHealth.conflicts.map((conflict, index) => (
                  <Alert key={index} variant={conflict.severity === 'high' ? 'destructive' : 'default'}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between">
                      <div>
                        <strong>{conflict.type.toUpperCase()}:</strong> {conflict.description}
                      </div>
                      {!conflict.autoResolved && (
                        <Button size="sm" onClick={() => resolveConflict(conflict.id)}>
                          Resolve
                        </Button>
                      )}
                    </AlertDescription>
                  </Alert>
                ))
              )}
            </TabsContent>

            <TabsContent value="tests" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Integration Tests</h3>
                <Button onClick={runIntegrationTests} disabled={isRunningTests}>
                  {isRunningTests ? 'Running...' : 'Run Tests'}
                </Button>
              </div>
              
              {isRunningTests && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 animate-spin" />
                      <span>Running integration tests...</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {testResults.length > 0 && (
                <div className="space-y-2">
                  {testResults.map((result, index) => (
                    <Card key={index}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(result.status)}
                            <span>{result.test}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {result.duration}ms
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              {Object.entries(integrationSettings).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {key === 'autoConflictResolution' && 'Automatically resolve system conflicts'}
                      {key === 'fallbackEnabled' && 'Enable fallback mechanisms on failures'}
                      {key === 'smartLoadBalancing' && 'Distribute load across components'}
                      {key === 'emergencyShutoff' && 'Emergency system shutdown capability'}
                    </p>
                  </div>
                  <Switch
                    checked={value}
                    onCheckedChange={(checked) => 
                      setIntegrationSettings(prev => ({ ...prev, [key]: checked }))
                    }
                  />
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};