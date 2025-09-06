import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  Router, 
  Server, 
  Globe, 
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CDNEndpoint {
  id: string;
  name: string;
  region: string;
  url: string;
  latency: number;
  reliability: number;
  bandwidth: number;
  load: number;
  isActive: boolean;
}

interface RouterDecision {
  timestamp: Date;
  mediaId: string;
  selectedEndpoint: string;
  reason: string;
  confidence: number;
  performanceGain?: number;
}

interface PerformanceBasedRouterProps {
  mediaId?: string;
  onRouteChange?: (endpoint: CDNEndpoint, decision: RouterDecision) => void;
}

const PerformanceBasedRouter: React.FC<PerformanceBasedRouterProps> = ({
  mediaId,
  onRouteChange
}) => {
  const [endpoints, setEndpoints] = useState<CDNEndpoint[]>([]);
  const [currentEndpoint, setCurrentEndpoint] = useState<CDNEndpoint | null>(null);
  const [recentDecisions, setRecentDecisions] = useState<RouterDecision[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [routingStats, setRoutingStats] = useState({
    totalRoutes: 0,
    avgLatency: 0,
    reliability: 0,
    performanceGain: 0
  });

  // Initialize mock CDN endpoints (in real implementation, this would come from your CDN provider)
  useEffect(() => {
    const mockEndpoints: CDNEndpoint[] = [
      {
        id: 'us-east-1',
        name: 'US East (Virginia)',
        region: 'North America',
        url: 'https://cdn-us-east-1.example.com',
        latency: 45,
        reliability: 0.99,
        bandwidth: 1000,
        load: 0.65,
        isActive: true
      },
      {
        id: 'us-west-1',
        name: 'US West (California)',
        region: 'North America', 
        url: 'https://cdn-us-west-1.example.com',
        latency: 32,
        reliability: 0.98,
        bandwidth: 850,
        load: 0.45,
        isActive: true
      },
      {
        id: 'eu-west-1',
        name: 'EU West (Ireland)',
        region: 'Europe',
        url: 'https://cdn-eu-west-1.example.com',
        latency: 78,
        reliability: 0.97,
        bandwidth: 750,
        load: 0.55,
        isActive: true
      },
      {
        id: 'ap-south-1',
        name: 'Asia Pacific (Mumbai)',
        region: 'Asia',
        url: 'https://cdn-ap-south-1.example.com',
        latency: 125,
        reliability: 0.95,
        bandwidth: 600,
        load: 0.70,
        isActive: true
      }
    ];

    setEndpoints(mockEndpoints);
    setCurrentEndpoint(mockEndpoints[0]); // Default to first endpoint
  }, []);

  // Test endpoint performance
  const testEndpointPerformance = useCallback(async (endpoint: CDNEndpoint): Promise<number> => {
    try {
      const startTime = performance.now();
      
      // Simulate network test (in real implementation, ping the actual endpoint)
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
      
      const endTime = performance.now();
      const measuredLatency = endTime - startTime;
      
      // Update endpoint with measured performance
      endpoint.latency = measuredLatency;
      
      return measuredLatency;
    } catch (error) {
      console.error(`Failed to test endpoint ${endpoint.name}:`, error);
      return Infinity;
    }
  }, []);

  // Calculate endpoint score based on multiple factors
  const calculateEndpointScore = useCallback((endpoint: CDNEndpoint): number => {
    const latencyScore = Math.max(0, 100 - endpoint.latency); // Lower latency = higher score
    const reliabilityScore = endpoint.reliability * 100;
    const bandwidthScore = Math.min(100, endpoint.bandwidth / 10); // Normalize bandwidth
    const loadScore = Math.max(0, 100 - (endpoint.load * 100)); // Lower load = higher score
    
    // Weighted average of factors
    const score = (
      latencyScore * 0.3 +
      reliabilityScore * 0.25 + 
      bandwidthScore * 0.25 +
      loadScore * 0.2
    );
    
    return Math.round(score);
  }, []);

  // Intelligent routing decision
  const makeRoutingDecision = useCallback(async (
    targetMediaId: string,
    userLocation?: { lat: number; lng: number }
  ): Promise<RouterDecision> => {
    setIsAnalyzing(true);
    
    try {
      // Test all active endpoints
      const endpointScores = await Promise.all(
        endpoints
          .filter(ep => ep.isActive)
          .map(async (endpoint) => {
            await testEndpointPerformance(endpoint);
            const score = calculateEndpointScore(endpoint);
            return { endpoint, score };
          })
      );

      // Sort by score (highest first)
      endpointScores.sort((a, b) => b.score - a.score);
      
      const bestEndpoint = endpointScores[0]?.endpoint;
      const bestScore = endpointScores[0]?.score || 0;
      const currentScore = currentEndpoint ? calculateEndpointScore(currentEndpoint) : 0;
      
      if (!bestEndpoint) {
        throw new Error('No available endpoints');
      }

      // Determine if we should switch
      const shouldSwitch = !currentEndpoint || bestScore > currentScore + 10; // 10 point threshold to prevent flapping
      
      const decision: RouterDecision = {
        timestamp: new Date(),
        mediaId: targetMediaId,
        selectedEndpoint: bestEndpoint.id,
        reason: shouldSwitch 
          ? `Better performance: ${bestScore} vs ${currentScore}`
          : `Staying with current endpoint (${currentScore})`,
        confidence: Math.min(0.95, bestScore / 100),
        performanceGain: shouldSwitch ? bestScore - currentScore : 0
      };

      // Apply routing decision
      if (shouldSwitch) {
        setCurrentEndpoint(bestEndpoint);
        onRouteChange?.(bestEndpoint, decision);
        
        // Log the routing decision
        await supabase.from('system_health_metrics').insert({
          metric_type: 'routing_decision',
          metric_value: bestScore,
          metric_unit: 'performance_score',
          metadata: {
            endpoint_id: bestEndpoint.id,
            media_id: targetMediaId,
            latency: bestEndpoint.latency,
            reliability: bestEndpoint.reliability,
            reason: decision.reason
          }
        });
      }

      setRecentDecisions(prev => [decision, ...prev.slice(0, 9)]); // Keep last 10 decisions
      return decision;

    } catch (error) {
      console.error('Routing decision failed:', error);
      
      const errorDecision: RouterDecision = {
        timestamp: new Date(),
        mediaId: targetMediaId,
        selectedEndpoint: currentEndpoint?.id || 'unknown',
        reason: `Routing failed: ${error}`,
        confidence: 0,
        performanceGain: 0
      };
      
      setRecentDecisions(prev => [errorDecision, ...prev.slice(0, 9)]);
      return errorDecision;
      
    } finally {
      setIsAnalyzing(false);
    }
  }, [endpoints, currentEndpoint, calculateEndpointScore, testEndpointPerformance, onRouteChange]);

  // Auto-routing based on performance monitoring
  useEffect(() => {
    if (!mediaId) return;

    const autoRoute = async () => {
      await makeRoutingDecision(mediaId);
    };

    // Initial routing decision
    autoRoute();

    // Periodic re-evaluation every 2 minutes
    const interval = setInterval(autoRoute, 120000);

    return () => clearInterval(interval);
  }, [mediaId, makeRoutingDecision]);

  // Calculate routing statistics
  useEffect(() => {
    const activeEndpoints = endpoints.filter(ep => ep.isActive);
    const avgLatency = activeEndpoints.reduce((sum, ep) => sum + ep.latency, 0) / activeEndpoints.length || 0;
    const avgReliability = activeEndpoints.reduce((sum, ep) => sum + ep.reliability, 0) / activeEndpoints.length || 0;
    const avgPerformanceGain = recentDecisions.reduce((sum, d) => sum + (d.performanceGain || 0), 0) / recentDecisions.length || 0;

    setRoutingStats({
      totalRoutes: recentDecisions.length,
      avgLatency,
      reliability: avgReliability * 100,
      performanceGain: avgPerformanceGain
    });
  }, [endpoints, recentDecisions]);

  const handleManualRoute = () => {
    if (mediaId) {
      makeRoutingDecision(mediaId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center space-x-2">
            <Router className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Performance-Based Routing</CardTitle>
              <CardDescription>
                Intelligent CDN endpoint selection based on real-time performance
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRoute}
              disabled={isAnalyzing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
              {isAnalyzing ? 'Analyzing...' : 'Re-analyze'}
            </Button>
            {currentEndpoint && (
              <Badge variant="default">
                <Server className="h-3 w-3 mr-1" />
                {currentEndpoint.name}
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CDN Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Globe className="h-5 w-5" />
              <span>CDN Endpoints</span>
            </CardTitle>
            <CardDescription>
              Real-time performance metrics for available endpoints
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {endpoints.map((endpoint) => {
                const score = calculateEndpointScore(endpoint);
                const isCurrentEndpoint = currentEndpoint?.id === endpoint.id;
                
                return (
                  <div 
                    key={endpoint.id} 
                    className={`p-4 border rounded-lg ${
                      isCurrentEndpoint ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${
                            endpoint.isActive ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                          <span className="font-medium">{endpoint.name}</span>
                        </div>
                        {isCurrentEndpoint && (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Current
                          </Badge>
                        )}
                      </div>
                      <Badge variant={score > 80 ? 'default' : score > 60 ? 'secondary' : 'destructive'}>
                        {score}% Score
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-muted-foreground">Latency</span>
                          <span>{endpoint.latency.toFixed(0)}ms</span>
                        </div>
                        <Progress value={Math.max(0, 100 - endpoint.latency)} className="h-1" />
                      </div>
                      
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-muted-foreground">Reliability</span>
                          <span>{(endpoint.reliability * 100).toFixed(1)}%</span>
                        </div>
                        <Progress value={endpoint.reliability * 100} className="h-1" />
                      </div>
                      
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-muted-foreground">Bandwidth</span>
                          <span>{endpoint.bandwidth}Mbps</span>
                        </div>
                        <Progress value={Math.min(100, endpoint.bandwidth / 10)} className="h-1" />
                      </div>
                      
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-muted-foreground">Load</span>
                          <span>{(endpoint.load * 100).toFixed(0)}%</span>
                        </div>
                        <Progress value={endpoint.load * 100} className="h-1" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Routing Decisions */}
        <div className="space-y-6">
          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>Routing Statistics</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {routingStats.totalRoutes}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Routes</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {routingStats.avgLatency.toFixed(0)}ms
                  </div>
                  <div className="text-xs text-muted-foreground">Avg Latency</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {routingStats.reliability.toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Reliability</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    +{routingStats.performanceGain.toFixed(0)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Performance</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Decisions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Recent Decisions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentDecisions.length > 0 ? (
                <div className="space-y-3">
                  {recentDecisions.slice(0, 5).map((decision, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
                      <div className="p-2 bg-primary/10 rounded-full">
                        {decision.confidence > 0.8 ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : decision.confidence > 0.5 ? (
                          <Clock className="h-4 w-4 text-blue-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">
                            Routed to {decision.selectedEndpoint}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {(decision.confidence * 100).toFixed(0)}%
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mb-1">
                          {decision.reason}
                        </div>
                        {decision.performanceGain && decision.performanceGain > 0 && (
                          <div className="text-xs text-green-600">
                            Performance gain: +{decision.performanceGain.toFixed(1)}%
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {decision.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  <Router className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No routing decisions yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PerformanceBasedRouter;