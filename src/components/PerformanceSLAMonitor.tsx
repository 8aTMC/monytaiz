import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Zap, 
  Shield, 
  AlertCircle,
  CheckCircle,
  BarChart3,
  Calendar,
  Award
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SLAMetric {
  name: string;
  current: number;
  target: number;
  unit: string;
  status: 'healthy' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  history: { timestamp: Date; value: number }[];
}

interface SLAContract {
  id: string;
  name: string;
  client: string;
  metrics: {
    availability: { target: number; current: number };
    responseTime: { target: number; current: number };
    throughput: { target: number; current: number };
    errorRate: { target: number; current: number };
  };
  status: 'compliant' | 'at_risk' | 'breach';
  penaltyRisk: number;
  nextReview: Date;
}

interface Incident {
  id: string;
  title: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  startTime: Date;
  endTime?: Date;
  slaImpact: string[];
  resolved: boolean;
}

export const PerformanceSLAMonitor: React.FC = () => {
  const [slaMetrics, setSlaMetrics] = useState<SLAMetric[]>([
    {
      name: 'Availability',
      current: 99.97,
      target: 99.95,
      unit: '%',
      status: 'healthy',
      trend: 'stable',
      history: Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000),
        value: 99.9 + Math.random() * 0.1
      }))
    },
    {
      name: 'Response Time',
      current: 145,
      target: 200,
      unit: 'ms',
      status: 'healthy',
      trend: 'down',
      history: Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000),
        value: 120 + Math.random() * 80
      }))
    },
    {
      name: 'Throughput',
      current: 1250,
      target: 1000,
      unit: 'req/s',
      status: 'healthy',
      trend: 'up',
      history: Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000),
        value: 900 + Math.random() * 400
      }))
    },
    {
      name: 'Error Rate',
      current: 0.02,
      target: 0.5,
      unit: '%',
      status: 'healthy',
      trend: 'stable',
      history: Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000),
        value: Math.random() * 0.1
      }))
    }
  ]);

  const [slaContracts, setSlaContracts] = useState<SLAContract[]>([
    {
      id: '1',
      name: 'Enterprise Tier',
      client: 'Global Corp Inc.',
      metrics: {
        availability: { target: 99.95, current: 99.97 },
        responseTime: { target: 200, current: 145 },
        throughput: { target: 1000, current: 1250 },
        errorRate: { target: 0.5, current: 0.02 }
      },
      status: 'compliant',
      penaltyRisk: 0,
      nextReview: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    },
    {
      id: '2',
      name: 'Premium Service',
      client: 'Tech Solutions Ltd.',
      metrics: {
        availability: { target: 99.9, current: 99.85 },
        responseTime: { target: 500, current: 420 },
        throughput: { target: 500, current: 650 },
        errorRate: { target: 1.0, current: 1.2 }
      },
      status: 'at_risk',
      penaltyRisk: 15000,
      nextReview: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  ]);

  const [incidents, setIncidents] = useState<Incident[]>([
    {
      id: '1',
      title: 'Database Connection Pool Exhaustion',
      impact: 'medium',
      startTime: new Date(Date.now() - 4 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 3.5 * 60 * 60 * 1000),
      slaImpact: ['Response Time', 'Error Rate'],
      resolved: true
    },
    {
      id: '2',
      title: 'CDN Edge Server Maintenance',
      impact: 'low',
      startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
      slaImpact: ['Availability'],
      resolved: false
    }
  ]);

  const { toast } = useToast();

  useEffect(() => {
    const interval = setInterval(() => {
      setSlaMetrics(prev => prev.map(metric => ({
        ...metric,
        current: metric.name === 'Response Time' 
          ? Math.max(50, metric.current + (Math.random() - 0.5) * 20)
          : metric.name === 'Availability'
          ? Math.min(100, Math.max(99.8, metric.current + (Math.random() - 0.5) * 0.05))
          : metric.current + (Math.random() - 0.5) * (metric.current * 0.1)
      })));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': case 'compliant': return 'text-green-500';
      case 'warning': case 'at_risk': return 'text-yellow-500';
      case 'critical': case 'breach': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy': case 'compliant': return <Badge variant="outline">Compliant</Badge>;
      case 'warning': case 'at_risk': return <Badge variant="secondary">At Risk</Badge>;
      case 'critical': case 'breach': return <Badge variant="destructive">Breach</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'stable': return <BarChart3 className="h-4 w-4 text-blue-500" />;
      default: return <BarChart3 className="h-4 w-4" />;
    }
  };

  const calculateSLACompliance = (contract: SLAContract) => {
    const metrics = Object.values(contract.metrics);
    const compliantMetrics = metrics.filter(metric => {
      if (metric === contract.metrics.errorRate) {
        return metric.current <= metric.target;
      }
      return metric.current >= metric.target;
    });
    return (compliantMetrics.length / metrics.length) * 100;
  };

  const resolveIncident = (incidentId: string) => {
    setIncidents(prev => prev.map(incident => 
      incident.id === incidentId 
        ? { ...incident, resolved: true, endTime: new Date() }
        : incident
    ));
    toast({
      title: "Incident Resolved",
      description: "SLA incident has been marked as resolved"
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Performance SLA Monitor
          </CardTitle>
          <CardDescription>
            Monitor service level agreements and performance commitments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">SLA Overview</TabsTrigger>
              <TabsTrigger value="contracts">Contracts</TabsTrigger>
              <TabsTrigger value="incidents">Incidents</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {slaMetrics.map((metric, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{metric.name}</span>
                        {getTrendIcon(metric.trend)}
                      </div>
                      <div className="space-y-2">
                        <div className="text-2xl font-bold">
                          {metric.current.toFixed(metric.name === 'Availability' ? 2 : 0)}{metric.unit}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Target: {metric.target}{metric.unit}
                        </div>
                        <Progress 
                          value={
                            metric.name === 'Error Rate' 
                              ? Math.max(0, 100 - (metric.current / metric.target) * 100)
                              : Math.min(100, (metric.current / metric.target) * 100)
                          } 
                          className="h-2" 
                        />
                        <div className={`text-xs font-medium ${getStatusColor(metric.status)}`}>
                          {metric.status.toUpperCase()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Overall SLA Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-6 text-center">
                    <div>
                      <div className="text-3xl font-bold text-green-500">98.5%</div>
                      <div className="text-sm text-muted-foreground">Average Compliance</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold">
                        {slaContracts.filter(c => c.status === 'compliant').length}
                      </div>
                      <div className="text-sm text-muted-foreground">Compliant Contracts</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-yellow-500">
                        {slaContracts.filter(c => c.status === 'at_risk').length}
                      </div>
                      <div className="text-sm text-muted-foreground">At Risk</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contracts" className="space-y-4">
              {slaContracts.map((contract) => (
                <Card key={contract.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div>
                        <span>{contract.name}</span>
                        <div className="text-sm font-normal text-muted-foreground">
                          {contract.client}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(contract.status)}
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {calculateSLACompliance(contract).toFixed(1)}% Compliance
                          </div>
                          {contract.penaltyRisk > 0 && (
                            <div className="text-xs text-red-500">
                              ${contract.penaltyRisk.toLocaleString()} at risk
                            </div>
                          )}
                        </div>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(contract.metrics).map(([key, metric]) => (
                        <div key={key} className="space-y-1">
                          <div className="text-sm font-medium capitalize">
                            {key.replace(/([A-Z])/g, ' $1')}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-lg font-bold">
                              {metric.current.toFixed(key === 'availability' ? 2 : 0)}
                              {key === 'availability' || key === 'errorRate' ? '%' : 
                               key === 'responseTime' ? 'ms' : 'req/s'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              / {metric.target}{key === 'availability' || key === 'errorRate' ? '%' : 
                                  key === 'responseTime' ? 'ms' : 'req/s'}
                            </div>
                          </div>
                          <Progress 
                            value={
                              key === 'errorRate'
                                ? Math.max(0, 100 - (metric.current / metric.target) * 100)
                                : Math.min(100, (metric.current / metric.target) * 100)
                            } 
                            className="h-2"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t flex justify-between items-center">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        Next review: {contract.nextReview.toLocaleDateString()}
                      </div>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="incidents" className="space-y-4">
              {incidents.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <p className="text-muted-foreground">No SLA-affecting incidents</p>
                  </CardContent>
                </Card>
              ) : (
                incidents.map((incident) => (
                  <Alert key={incident.id} variant={incident.impact === 'critical' ? 'destructive' : 'default'}>
                    <div className="flex items-start justify-between w-full">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <strong>{incident.title}</strong>
                            <Badge variant={incident.impact === 'critical' ? 'destructive' : 'secondary'}>
                              {incident.impact}
                            </Badge>
                            {incident.resolved && <Badge variant="outline">Resolved</Badge>}
                          </div>
                          <AlertDescription>
                            <div className="space-y-1">
                              <div>Affected SLA metrics: {incident.slaImpact.join(', ')}</div>
                              <div className="text-xs">
                                Started: {incident.startTime.toLocaleString()}
                                {incident.endTime && (
                                  <span> • Resolved: {incident.endTime.toLocaleString()}</span>
                                )}
                              </div>
                            </div>
                          </AlertDescription>
                        </div>
                      </div>
                      {!incident.resolved && (
                        <Button size="sm" variant="outline" onClick={() => resolveIncident(incident.id)}>
                          Resolve
                        </Button>
                      )}
                    </div>
                  </Alert>
                ))
              )}
            </TabsContent>

            <TabsContent value="reports" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    SLA Performance Reports
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <Clock className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                        <div className="text-2xl font-bold">99.7%</div>
                        <div className="text-sm text-muted-foreground">Monthly Uptime</div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4 text-center">
                        <Zap className="h-8 w-8 mx-auto text-green-500 mb-2" />
                        <div className="text-2xl font-bold">156ms</div>
                        <div className="text-sm text-muted-foreground">Avg Response Time</div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4 text-center">
                        <Shield className="h-8 w-8 mx-auto text-purple-500 mb-2" />
                        <div className="text-2xl font-bold">0.01%</div>
                        <div className="text-sm text-muted-foreground">Error Rate</div>
                      </CardContent>
                    </Card>
                  </div>

                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      All SLA commitments are currently being met or exceeded. 
                      Performance is within acceptable parameters.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};