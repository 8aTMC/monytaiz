import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNetworkMonitor } from '@/hooks/useNetworkMonitor';
import { useBandwidthDetector } from '@/hooks/useBandwidthDetector';
import { Server, Globe, Zap, AlertTriangle, CheckCircle, RefreshCw, MapPin } from 'lucide-react';

interface CDNEndpoint {
  id: string;
  region: string;
  url: string;
  location: string;
  latency: number;
  availability: number;
  bandwidth: number;
  load: number;
  score: number;
  status: 'active' | 'degraded' | 'offline';
  lastTested: Date;
}

interface RoutingDecision {
  timestamp: Date;
  fromEndpoint: string;
  toEndpoint: string;
  reason: string;
  confidence: number;
  performanceGain: number;
}

export const SmartCDNManager: React.FC = () => {
  const [endpoints, setEndpoints] = useState<CDNEndpoint[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<CDNEndpoint | null>(null);
  const [routingHistory, setRoutingHistory] = useState<RoutingDecision[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [autoRouting, setAutoRouting] = useState(true);
  const [stats, setStats] = useState({
    totalRoutes: 0,
    avgLatency: 0,
    reliability: 0,
    performanceGain: 0
  });

  const { networkStatus } = useNetworkMonitor();
  const { stats: bandwidthStats, measurements } = useBandwidthDetector();

  // Initialize mock CDN endpoints
  useEffect(() => {
    const mockEndpoints: CDNEndpoint[] = [
      {
        id: 'us-east-1',
        region: 'US East',
        url: 'cdn-us-east-1.example.com',
        location: 'Virginia, USA',
        latency: 45 + Math.random() * 20,
        availability: 99.8 + Math.random() * 0.2,
        bandwidth: 8 + Math.random() * 4,
        load: 30 + Math.random() * 40,
        score: 0,
        status: 'active',
        lastTested: new Date()
      },
      {
        id: 'us-west-2',
        region: 'US West',
        url: 'cdn-us-west-2.example.com',
        location: 'Oregon, USA',
        latency: 120 + Math.random() * 30,
        availability: 99.9 + Math.random() * 0.1,
        bandwidth: 10 + Math.random() * 5,
        load: 25 + Math.random() * 35,
        score: 0,
        status: 'active',
        lastTested: new Date()
      },
      {
        id: 'eu-west-1',
        region: 'EU West',
        url: 'cdn-eu-west-1.example.com',
        location: 'Ireland',
        latency: 200 + Math.random() * 50,
        availability: 99.7 + Math.random() * 0.3,
        bandwidth: 7 + Math.random() * 3,
        load: 40 + Math.random() * 30,
        score: 0,
        status: 'active',
        lastTested: new Date()
      },
      {
        id: 'ap-southeast-1',
        region: 'Asia Pacific',
        url: 'cdn-ap-southeast-1.example.com',
        location: 'Singapore',
        latency: 300 + Math.random() * 80,
        availability: 99.6 + Math.random() * 0.4,
        bandwidth: 6 + Math.random() * 4,
        load: 50 + Math.random() * 25,
        score: 0,
        status: measurements.length > 0 && measurements[measurements.length - 1].latencyMs > 150 ? 'degraded' : 'active',
        lastTested: new Date()
      }
    ];

    // Calculate scores for each endpoint
    const scoredEndpoints = mockEndpoints.map(endpoint => ({
      ...endpoint,
      score: calculateEndpointScore(endpoint)
    }));

    setEndpoints(scoredEndpoints);
    
    // Select the best endpoint initially
    const bestEndpoint = scoredEndpoints.reduce((best, current) => 
      current.score > best.score ? current : best
    );
    setSelectedEndpoint(bestEndpoint);
  }, []);

  // Calculate performance score for an endpoint
  const calculateEndpointScore = useCallback((endpoint: CDNEndpoint): number => {
    let score = 100;

    // Latency impact (0-40 points)
    const latencyScore = Math.max(0, 40 - (endpoint.latency / 10));
    score += latencyScore;

    // Availability impact (0-25 points)
    const availabilityScore = (endpoint.availability - 99) * 25;
    score += availabilityScore;

    // Bandwidth impact (0-20 points)
    const bandwidthScore = Math.min(20, endpoint.bandwidth * 2);
    score += bandwidthScore;

    // Load impact (0-15 points, inverse)
    const loadScore = Math.max(0, 15 - (endpoint.load / 100 * 15));
    score += loadScore;

    // Network conditions adjustment
    if (networkStatus.speed === 'slow' || networkStatus.speed === 'very-slow') {
      // Prefer endpoints with lower latency when network is slow
      score += (200 - endpoint.latency) / 10;
    }

    // Geographic preference (simulated based on user's connection)
    const userLatency = measurements.length > 0 ? measurements[measurements.length - 1].latencyMs : 100;
    if (userLatency < 100 && endpoint.latency < 100) {
      score += 10; // Prefer nearby endpoints
    }

    return Math.max(0, Math.min(200, score));
  }, [networkStatus, measurements]);

  // Test endpoint performance
  const testEndpointPerformance = useCallback(async (endpoint: CDNEndpoint): Promise<number> => {
    // Simulate network test
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    
    // Return simulated latency with some variation
    return endpoint.latency + (Math.random() - 0.5) * 20;
  }, []);

  // Make intelligent routing decision
  const makeRoutingDecision = useCallback(async () => {
    setIsAnalyzing(true);

    try {
      // Test all active endpoints
      const testPromises = endpoints
        .filter(endpoint => endpoint.status === 'active')
        .map(async (endpoint) => {
          const testLatency = await testEndpointPerformance(endpoint);
          return {
            ...endpoint,
            latency: testLatency,
            score: calculateEndpointScore({ ...endpoint, latency: testLatency }),
            lastTested: new Date()
          };
        });

      const testedEndpoints = await Promise.all(testPromises);
      
      // Find the best endpoint
      const bestEndpoint = testedEndpoints.reduce((best, current) => 
        current.score > best.score ? current : best
      );

      // Check if we should switch
      const currentScore = selectedEndpoint?.score || 0;
      const improvement = bestEndpoint.score - currentScore;
      const shouldSwitch = improvement > 10; // Switch if improvement > 10 points

      if (shouldSwitch && bestEndpoint.id !== selectedEndpoint?.id) {
        const decision: RoutingDecision = {
          timestamp: new Date(),
          fromEndpoint: selectedEndpoint?.region || 'None',
          toEndpoint: bestEndpoint.region,
          reason: improvement > 50 ? 'Significant performance improvement' :
                  improvement > 25 ? 'Better network conditions' :
                  'Incremental optimization',
          confidence: Math.min(0.95, improvement / 100 + 0.6),
          performanceGain: improvement
        };

        setRoutingHistory(prev => [decision, ...prev.slice(0, 19)]); // Keep last 20
        setSelectedEndpoint(bestEndpoint);
        
        console.log('CDN route switched:', {
          from: selectedEndpoint?.region,
          to: bestEndpoint.region,
          improvement: improvement.toFixed(1)
        });
      }

      // Update all endpoints with latest data
      setEndpoints(prev => prev.map(ep => {
        const tested = testedEndpoints.find(t => t.id === ep.id);
        return tested || ep;
      }));

    } catch (error) {
      console.error('CDN routing analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [endpoints, selectedEndpoint, calculateEndpointScore, testEndpointPerformance]);

  // Auto-routing with intelligent intervals
  useEffect(() => {
    if (!autoRouting) return;

    const interval = setInterval(() => {
      makeRoutingDecision();
    }, 45000); // Test every 45 seconds

    return () => clearInterval(interval);
  }, [autoRouting, makeRoutingDecision]);

  // Calculate statistics
  useEffect(() => {
    const totalRoutes = routingHistory.length;
    const avgLatency = endpoints.length > 0 
      ? endpoints.reduce((sum, ep) => sum + ep.latency, 0) / endpoints.length 
      : 0;
    const reliability = endpoints.length > 0
      ? endpoints.reduce((sum, ep) => sum + ep.availability, 0) / endpoints.length
      : 99;
    const avgGain = totalRoutes > 0
      ? routingHistory.reduce((sum, decision) => sum + decision.performanceGain, 0) / totalRoutes
      : 0;

    setStats({
      totalRoutes,
      avgLatency,
      reliability,
      performanceGain: avgGain
    });
  }, [endpoints, routingHistory]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-success';
      case 'degraded': return 'text-warning';
      case 'offline': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return CheckCircle;
      case 'degraded': return AlertTriangle;
      case 'offline': return AlertTriangle;
      default: return Server;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Smart CDN Manager</h2>
          <p className="text-muted-foreground">Intelligent content delivery network optimization</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Auto Routing</span>
            <Switch checked={autoRouting} onCheckedChange={setAutoRouting} />
          </div>
          <Button 
            onClick={makeRoutingDecision} 
            disabled={isAnalyzing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
            Re-analyze
          </Button>
        </div>
      </div>

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Current CDN Status
          </CardTitle>
          <CardDescription>
            Active endpoint and performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Server className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{selectedEndpoint?.region || 'No endpoint selected'}</h3>
                <p className="text-sm text-muted-foreground">{selectedEndpoint?.location}</p>
              </div>
            </div>
            <Badge className={getStatusColor(selectedEndpoint?.status || 'offline')}>
              {selectedEndpoint?.status || 'offline'}
            </Badge>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{selectedEndpoint?.latency.toFixed(0) || '0'}ms</div>
              <div className="text-sm text-muted-foreground">Latency</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{selectedEndpoint?.availability.toFixed(1) || '0'}%</div>
              <div className="text-sm text-muted-foreground">Availability</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{selectedEndpoint?.bandwidth.toFixed(1) || '0'} Mbps</div>
              <div className="text-sm text-muted-foreground">Bandwidth</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{selectedEndpoint?.score.toFixed(0) || '0'}</div>
              <div className="text-sm text-muted-foreground">Score</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Endpoint List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            CDN Endpoints
          </CardTitle>
          <CardDescription>
            Performance metrics for all available endpoints
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {endpoints.map((endpoint) => {
              const StatusIcon = getStatusIcon(endpoint.status);
              const isSelected = selectedEndpoint?.id === endpoint.id;
              
              return (
                <div
                  key={endpoint.id}
                  className={`border rounded-lg p-4 transition-colors ${
                    isSelected ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <StatusIcon className={`h-5 w-5 ${getStatusColor(endpoint.status)}`} />
                      <div>
                        <h4 className="font-medium">{endpoint.region}</h4>
                        <p className="text-sm text-muted-foreground">{endpoint.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={isSelected ? 'default' : 'outline'}>
                        Score: {endpoint.score.toFixed(0)}
                      </Badge>
                      {isSelected && <Badge>Active</Badge>}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Latency:</span>
                      <span className="ml-1 font-medium">{endpoint.latency.toFixed(0)}ms</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Load:</span>
                      <span className="ml-1 font-medium">{endpoint.load.toFixed(0)}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Uptime:</span>
                      <span className="ml-1 font-medium">{endpoint.availability.toFixed(1)}%</span>
                    </div>
                  </div>

                  <Progress 
                    value={endpoint.score} 
                    className="mt-3" 
                    max={200}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Routing Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Routing Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Route Changes</span>
              <span className="font-medium">{stats.totalRoutes}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Average Latency</span>
              <span className="font-medium">{stats.avgLatency.toFixed(0)}ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Network Reliability</span>
              <span className="font-medium">{stats.reliability.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Avg Performance Gain</span>
              <span className="font-medium text-success">+{stats.performanceGain.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Routing Decisions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {routingHistory.slice(0, 5).map((decision, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded border-l-2 border-l-primary bg-primary/5">
                  <div>
                    <div className="text-sm font-medium">
                      {decision.fromEndpoint} → {decision.toEndpoint}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {decision.reason} (+{decision.performanceGain.toFixed(1)}%)
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {decision.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))}
              
              {routingHistory.length === 0 && (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No routing decisions yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};