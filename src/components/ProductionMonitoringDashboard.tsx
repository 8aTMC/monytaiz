import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Monitor, 
  AlertCircle, 
  TrendingUp, 
  Zap, 
  Clock, 
  Users,
  Server,
  Database,
  Wifi,
  Bell,
  BellRing
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkLatency: number;
  activeUsers: number;
  requestsPerSecond: number;
  errorRate: number;
  uptime: number;
}

interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  timestamp: Date;
  acknowledged: boolean;
  escalated: boolean;
}

export const ProductionMonitoringDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpuUsage: 45,
    memoryUsage: 62,
    diskUsage: 38,
    networkLatency: 120,
    activeUsers: 1247,
    requestsPerSecond: 145,
    errorRate: 0.02,
    uptime: 99.97
  });

  const [alerts, setAlerts] = useState<Alert[]>([
    {
      id: '1',
      severity: 'warning',
      title: 'High Memory Usage',
      description: 'Memory usage exceeded 85% threshold on server-02',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      acknowledged: false,
      escalated: false
    },
    {
      id: '2',
      severity: 'info',
      title: 'ML Model Update',
      description: 'Predictive model successfully updated to v2.1.4',
      timestamp: new Date(Date.now() - 45 * 60 * 1000),
      acknowledged: true,
      escalated: false
    }
  ]);

  const [slaMetrics, setSlaMetrics] = useState({
    availability: 99.97,
    responseTime: 145,
    throughput: 1250,
    errorBudget: 0.03
  });

  const { toast } = useToast();

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        cpuUsage: Math.max(0, Math.min(100, prev.cpuUsage + (Math.random() - 0.5) * 10)),
        memoryUsage: Math.max(0, Math.min(100, prev.memoryUsage + (Math.random() - 0.5) * 5)),
        networkLatency: Math.max(50, prev.networkLatency + (Math.random() - 0.5) * 30),
        activeUsers: Math.max(0, prev.activeUsers + Math.floor((Math.random() - 0.5) * 50)),
        requestsPerSecond: Math.max(0, prev.requestsPerSecond + Math.floor((Math.random() - 0.5) * 20))
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const acknowledgeAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    ));
    toast({
      title: "Alert Acknowledged",
      description: "Alert has been marked as acknowledged"
    });
  };

  const escalateAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, escalated: true } : alert
    ));
    toast({
      title: "Alert Escalated",
      description: "Alert has been escalated to senior team",
      variant: "destructive"
    });
  };

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'info': return <AlertCircle className="h-4 w-4 text-blue-500" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants = {
      critical: 'destructive' as const,
      warning: 'secondary' as const,
      info: 'outline' as const
    };
    return <Badge variant={variants[severity as keyof typeof variants]}>{severity}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Production Monitoring Dashboard
          </CardTitle>
          <CardDescription>
            Real-time system monitoring and alerting for production environment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="metrics" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="metrics">System Metrics</TabsTrigger>
              <TabsTrigger value="alerts">Alerts ({alerts.filter(a => !a.acknowledged).length})</TabsTrigger>
              <TabsTrigger value="sla">SLA Monitor</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="metrics" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">CPU Usage</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-2xl font-bold">{Math.round(metrics.cpuUsage)}%</div>
                      <Progress value={metrics.cpuUsage} className="mt-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">Memory</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-2xl font-bold">{Math.round(metrics.memoryUsage)}%</div>
                      <Progress value={metrics.memoryUsage} className="mt-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Wifi className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium">Network</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-2xl font-bold">{Math.round(metrics.networkLatency)}ms</div>
                      <div className="text-xs text-muted-foreground">latency</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium">Active Users</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-2xl font-bold">{metrics.activeUsers.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">current</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="h-8 w-8 mx-auto text-green-500 mb-2" />
                    <div className="text-2xl font-bold">{metrics.requestsPerSecond}</div>
                    <div className="text-sm text-muted-foreground">Requests/sec</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <Zap className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
                    <div className="text-2xl font-bold">{(metrics.errorRate * 100).toFixed(2)}%</div>
                    <div className="text-sm text-muted-foreground">Error Rate</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <Clock className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                    <div className="text-2xl font-bold">{metrics.uptime}%</div>
                    <div className="text-sm text-muted-foreground">Uptime</div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="alerts" className="space-y-4">
              {alerts.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No active alerts</p>
                  </CardContent>
                </Card>
              ) : (
                alerts.map((alert) => (
                  <Alert key={alert.id} variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                    <div className="flex items-start justify-between w-full">
                      <div className="flex items-start gap-2">
                        {getAlertIcon(alert.severity)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <strong>{alert.title}</strong>
                            {getSeverityBadge(alert.severity)}
                            {alert.escalated && <Badge variant="destructive">Escalated</Badge>}
                          </div>
                          <AlertDescription>
                            {alert.description}
                          </AlertDescription>
                          <div className="text-xs text-muted-foreground mt-1">
                            {alert.timestamp.toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!alert.acknowledged && (
                          <Button size="sm" variant="outline" onClick={() => acknowledgeAlert(alert.id)}>
                            Acknowledge
                          </Button>
                        )}
                        {!alert.escalated && alert.severity === 'critical' && (
                          <Button size="sm" variant="destructive" onClick={() => escalateAlert(alert.id)}>
                            <BellRing className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Alert>
                ))
              )}
            </TabsContent>

            <TabsContent value="sla" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(slaMetrics).map(([key, value]) => (
                  <Card key={key}>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold">
                        {key === 'availability' || key === 'errorBudget' ? `${value}%` : 
                         key === 'responseTime' ? `${value}ms` : value.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground capitalize">
                        {key.replace(/([A-Z])/g, ' $1')}
                      </div>
                      <Progress 
                        value={key === 'availability' ? value : key === 'errorBudget' ? 100 - (value * 33.33) : 
                               key === 'responseTime' ? Math.max(0, 100 - (value / 10)) : (value / 20)}
                        className="mt-2" 
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="performance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Trends</CardTitle>
                  <CardDescription>Real-time performance monitoring and analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Alert>
                      <TrendingUp className="h-4 w-4" />
                      <AlertDescription>
                        System performance is within optimal parameters. All metrics are stable.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-medium mb-2">Response Time Distribution</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>P50: 89ms</span>
                              <span>P95: 245ms</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>P99: 456ms</span>
                              <span>P99.9: 1.2s</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-medium mb-2">Throughput Analysis</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Peak: 2,450 req/s</span>
                              <span>Average: 1,250 req/s</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Success Rate: 99.98%</span>
                              <span>Capacity: 85%</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};