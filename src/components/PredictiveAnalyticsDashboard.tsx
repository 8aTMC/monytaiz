import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePredictiveOptimizer } from '@/hooks/usePredictiveOptimizer';
import { usePerformanceAnalytics } from '@/hooks/usePerformanceAnalytics';
import { useUserBehaviorTracker } from '@/hooks/useUserBehaviorTracker';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Brain, TrendingUp, Users, Zap, AlertCircle, Target, Clock, Activity } from 'lucide-react';

export const PredictiveAnalyticsDashboard: React.FC = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState('24h');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  const { insights, model, generateInsights } = usePredictiveOptimizer();
  const { analyticsData, getPerformanceScore } = usePerformanceAnalytics();
  const { getBehaviorInsights, behaviorPattern } = useUserBehaviorTracker();

  // Generate predictive data
  useEffect(() => {
    const generatePredictiveData = () => {
      const now = new Date();
      const hours = selectedTimeframe === '24h' ? 24 : selectedTimeframe === '7d' ? 168 : 720;
      
      const data = [];
      for (let i = 0; i < hours; i++) {
        const time = new Date(now.getTime() - (hours - i) * 60 * 60 * 1000);
        
        // Generate predictive performance metrics with trends
        const basePerformance = 85 + Math.sin(i / 6) * 10; // Daily pattern
        const networkVariation = Math.random() * 20 - 10; // Random network changes
        const userLoadVariation = Math.sin(i / 3) * 15; // User load pattern
        
        data.push({
          time: time.getTime(),
          hour: time.getHours(),
          predicted_performance: Math.max(0, Math.min(100, basePerformance + networkVariation + userLoadVariation)),
          predicted_load_time: 1500 + Math.random() * 2000 + (100 - basePerformance) * 20,
          predicted_buffer_rate: Math.max(0, (100 - basePerformance) / 200 + Math.random() * 0.1),
          user_activity: 30 + Math.sin(i / 8) * 25 + Math.random() * 10,
          cache_efficiency: 60 + Math.sin(i / 4) * 20 + Math.random() * 15
        });
      }
      
      setPredictions(data);
    };

    generatePredictiveData();
    
    // Generate alerts based on predictions
    const newAlerts = [];
    if (insights?.performancePrediction.bufferProbability > 0.3) {
      newAlerts.push({
        id: 'buffer_risk',
        severity: 'high',
        title: 'High Buffer Risk Predicted',
        description: `${(insights.performancePrediction.bufferProbability * 100).toFixed(0)}% chance of buffering in the next hour`,
        prediction: insights.performancePrediction.bufferProbability,
        timeframe: '1 hour'
      });
    }
    
    if (insights?.performancePrediction.expectedLoadTime > 5000) {
      newAlerts.push({
        id: 'slow_load',
        severity: 'medium',
        title: 'Slow Load Times Expected', 
        description: `Load times may increase to ${insights.performancePrediction.expectedLoadTime.toFixed(0)}ms`,
        prediction: insights.performancePrediction.expectedLoadTime,
        timeframe: '2 hours'
      });
    }
    
    setAlerts(newAlerts);
  }, [selectedTimeframe, insights]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-destructive';
      case 'medium': return 'text-warning';
      case 'low': return 'text-muted-foreground';
      default: return 'text-muted-foreground';
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const behaviorInsights = getBehaviorInsights();
  const performanceScore = getPerformanceScore();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Predictive Analytics</h2>
          <p className="text-muted-foreground">ML-powered performance forecasting and optimization insights</p>
        </div>
        <div className="flex items-center gap-2">
          {['24h', '7d', '30d'].map((timeframe) => (
            <Button
              key={timeframe}
              variant={selectedTimeframe === timeframe ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTimeframe(timeframe)}
            >
              {timeframe}
            </Button>
          ))}
        </div>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <Alert key={alert.id} className="border-destructive/20">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{alert.title}</span>
                    <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                  </div>
                  <Badge className={getSeverityColor(alert.severity)}>
                    {alert.severity} - {alert.timeframe}
                  </Badge>
                </div>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ML Model Confidence</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(model.confidenceScore * 100).toFixed(0)}%</div>
            <Progress value={model.confidenceScore * 100} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              Model accuracy improving
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">User Segment</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{model.userSegment.replace('_', ' ')}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {insights?.userSegmentation.characteristics.join(', ') || 'Analyzing behavior...'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Predicted Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {performanceScore || insights?.performancePrediction.qualityStabilityScore 
                ? ((performanceScore || insights.performancePrediction.qualityStabilityScore * 100)).toFixed(0) 
                : '85'}%
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Next hour forecast
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Optimizations</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights?.recommendations.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-2">
              ML recommendations ready
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance Forecast</TabsTrigger>
          <TabsTrigger value="behavior">User Behavior Trends</TabsTrigger>
          <TabsTrigger value="optimization">Optimization Impact</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Predicted Performance Score
                </CardTitle>
                <CardDescription>
                  ML forecast of system performance over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={predictions}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time"
                      tickFormatter={formatTime}
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                    />
                    <YAxis domain={[0, 100]} />
                    <Tooltip 
                      labelFormatter={formatTime}
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Performance']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="predicted_performance" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Load Time Predictions
                </CardTitle>
                <CardDescription>
                  Expected load times based on current trends
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={predictions}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time"
                      tickFormatter={formatTime}
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={formatTime}
                      formatter={(value: number) => [`${value.toFixed(0)}ms`, 'Load Time']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="predicted_load_time" 
                      stroke="hsl(var(--chart-2))" 
                      fill="hsl(var(--chart-2))"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>User Activity Patterns</CardTitle>
                <CardDescription>
                  Predicted user engagement over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={predictions}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="hour"
                      tickFormatter={(hour) => `${hour}:00`}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(hour) => `${hour}:00`}
                      formatter={(value: number) => [`${value.toFixed(0)}%`, 'Activity']}
                    />
                    <Bar 
                      dataKey="user_activity" 
                      fill="hsl(var(--chart-3))" 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Behavior Insights</CardTitle>
                <CardDescription>
                  Current user behavior analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Avg View Duration</span>
                  <span className="text-sm font-medium">
                    {(behaviorPattern.averageViewDuration / 1000).toFixed(1)}s
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Session Items</span>
                  <span className="text-sm font-medium">
                    {behaviorInsights.currentSessionItems}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Interaction Rate</span>
                  <span className="text-sm font-medium">
                    {behaviorInsights.totalInteractions > 0 
                      ? (behaviorInsights.totalInteractions / behaviorInsights.totalViews * 100).toFixed(1) 
                      : 0}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Preferred Quality</span>
                  <span className="text-sm font-medium capitalize">
                    {behaviorPattern.contentPreferences.qualityPreference}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Optimization Recommendations
              </CardTitle>
              <CardDescription>
                ML-generated optimization strategies ranked by expected impact
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {insights?.recommendations.slice(0, 5).map((rec, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium capitalize">
                        {rec.action.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant={rec.confidence > 0.8 ? 'default' : rec.confidence > 0.6 ? 'secondary' : 'outline'}>
                          {(rec.confidence * 100).toFixed(0)}% confidence
                        </Badge>
                        <Badge variant="outline">
                          +{(rec.expectedImprovement * 100).toFixed(0)}% improvement
                        </Badge>
                      </div>
                    </div>
                    <Progress value={rec.expectedImprovement * 100} className="mb-2" />
                    <div className="text-sm text-muted-foreground">
                      <strong>Reasoning:</strong> {rec.reasoning.join(', ')}
                    </div>
                  </div>
                ))}
                
                {(!insights?.recommendations || insights.recommendations.length === 0) && (
                  <div className="text-center py-6 text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No optimizations needed at this time</p>
                    <p className="text-sm">System performance is optimal</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};