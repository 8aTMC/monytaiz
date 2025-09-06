import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { usePredictiveOptimizer } from '@/hooks/usePredictiveOptimizer';
import { useIntelligentOptimizer } from '@/hooks/useIntelligentOptimizer';
import { useUserBehaviorTracker } from '@/hooks/useUserBehaviorTracker';
import { Brain, Zap, Target, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

interface MLDecisionEngineProps {
  onOptimizationApplied?: (decision: any) => void;
}

interface Decision {
  id: string;
  action: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  status: 'pending' | 'applied' | 'rejected';
  timestamp: Date;
  reasoning: string[];
  metadata: Record<string, any>;
}

export const MLDecisionEngine: React.FC<MLDecisionEngineProps> = ({
  onOptimizationApplied
}) => {
  const [autoMode, setAutoMode] = useState(false);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [engineStatus, setEngineStatus] = useState<'idle' | 'analyzing' | 'optimizing'>('idle');
  const [stats, setStats] = useState({
    totalDecisions: 0,
    appliedDecisions: 0,
    averageConfidence: 0,
    successRate: 85
  });

  const { predictions, insights, generateInsights, trainModel } = usePredictiveOptimizer();
  const { makeOptimizationDecision, recentDecisions } = useIntelligentOptimizer();
  const { getBehaviorInsights } = useUserBehaviorTracker();

  // Generate ML-based decisions
  const generateDecision = useCallback(() => {
    if (!insights) return;

    setEngineStatus('analyzing');

    const newDecisions: Decision[] = insights.recommendations.map((rec, index) => ({
      id: `decision_${Date.now()}_${index}`,
      action: rec.action,
      confidence: rec.confidence,
      impact: rec.expectedImprovement > 0.3 ? 'high' : rec.expectedImprovement > 0.15 ? 'medium' : 'low',
      status: autoMode && rec.confidence > 0.7 ? 'applied' : 'pending',
      timestamp: new Date(),
      reasoning: rec.reasoning,
      metadata: rec.metadata
    }));

    setDecisions(prev => [...newDecisions, ...prev].slice(0, 50)); // Keep last 50 decisions

    // Auto-apply high-confidence decisions in auto mode
    if (autoMode) {
      newDecisions.forEach(decision => {
        if (decision.confidence > 0.7 && decision.impact === 'high') {
          applyDecision(decision.id);
        }
      });
    }

    setEngineStatus('idle');
  }, [insights, autoMode]);

  // Apply a specific decision
  const applyDecision = useCallback(async (decisionId: string) => {
    const decision = decisions.find(d => d.id === decisionId);
    if (!decision || decision.status === 'applied') return;

    setEngineStatus('optimizing');

    try {
      // Apply the optimization decision
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate async operation
      
      setDecisions(prev => 
        prev.map(d => d.id === decisionId ? { ...d, status: 'applied' } : d)
      );

      // Track success for model training
      await trainModel('success');
      
      onOptimizationApplied?.(decision);
      
      // Update stats
      setStats(prev => ({
        ...prev,
        appliedDecisions: prev.appliedDecisions + 1,
        totalDecisions: prev.totalDecisions + 1
      }));

    } catch (error) {
      console.error('Failed to apply decision:', error);
      await trainModel('failure');
      
      setDecisions(prev => 
        prev.map(d => d.id === decisionId ? { ...d, status: 'rejected' } : d)
      );
    } finally {
      setEngineStatus('idle');
    }
  }, [decisions, trainModel, onOptimizationApplied]);

  // Reject a decision
  const rejectDecision = useCallback((decisionId: string) => {
    setDecisions(prev => 
      prev.map(d => d.id === decisionId ? { ...d, status: 'rejected' } : d)
    );
  }, []);

  // Get status color and icon
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'analyzing':
        return { color: 'bg-primary', icon: Brain, text: 'Analyzing' };
      case 'optimizing':
        return { color: 'bg-accent', icon: Zap, text: 'Optimizing' };
      default:
        return { color: 'bg-muted', icon: Target, text: 'Ready' };
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-success';
    if (confidence >= 0.6) return 'text-warning';
    return 'text-destructive';
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-destructive';
      case 'medium': return 'bg-warning'; 
      case 'low': return 'bg-muted';
      default: return 'bg-muted';
    }
  };

  // Auto-generate decisions periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (engineStatus === 'idle') {
        generateInsights();
        setTimeout(generateDecision, 1000);
      }
    }, 45000); // Every 45 seconds

    return () => clearInterval(interval);
  }, [generateInsights, generateDecision, engineStatus]);

  // Calculate stats
  useEffect(() => {
    const appliedCount = decisions.filter(d => d.status === 'applied').length;
    const totalCount = decisions.length;
    const avgConfidence = totalCount > 0 
      ? decisions.reduce((sum, d) => sum + d.confidence, 0) / totalCount 
      : 0;

    setStats(prev => ({
      ...prev,
      totalDecisions: totalCount,
      appliedDecisions: appliedCount,
      averageConfidence: avgConfidence * 100
    }));
  }, [decisions]);

  const statusInfo = getStatusInfo(engineStatus);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-6">
      {/* Engine Status Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${statusInfo.color}`}>
                <StatusIcon className="h-5 w-5 text-background" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  ML Decision Engine
                  <Badge variant={engineStatus === 'idle' ? 'secondary' : 'default'}>
                    {statusInfo.text}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  AI-powered optimization decisions based on user behavior and performance data
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Auto Mode</span>
                <Switch 
                  checked={autoMode} 
                  onCheckedChange={setAutoMode}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{stats.totalDecisions}</div>
              <div className="text-sm text-muted-foreground">Total Decisions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">{stats.appliedDecisions}</div>
              <div className="text-sm text-muted-foreground">Applied</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success">{stats.averageConfidence.toFixed(0)}%</div>
              <div className="text-sm text-muted-foreground">Avg Confidence</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-chart-2">{stats.successRate}%</div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Decisions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Optimization Recommendations
          </CardTitle>
          <CardDescription>
            ML-generated optimization decisions ranked by confidence and impact
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {decisions.filter(d => d.status === 'pending').slice(0, 5).map((decision) => (
              <div key={decision.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={getImpactColor(decision.impact)}>
                      {decision.impact} impact
                    </Badge>
                    <span className="font-medium">
                      {decision.action.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${getConfidenceColor(decision.confidence)}`}>
                      {(decision.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                </div>
                
                <Progress 
                  value={decision.confidence * 100} 
                  className="mb-3"
                />
                
                <div className="text-sm text-muted-foreground mb-3">
                  <strong>Reasoning:</strong> {decision.reasoning.join(', ')}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => applyDecision(decision.id)}
                    disabled={engineStatus === 'optimizing'}
                  >
                    Apply Optimization
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => rejectDecision(decision.id)}
                  >
                    Reject
                  </Button>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {decision.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
            
            {decisions.filter(d => d.status === 'pending').length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No pending optimization decisions</p>
                <p className="text-sm">The system is monitoring and will suggest optimizations when beneficial</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Applied Decisions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Recent Applied Optimizations
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-2">
            {decisions
              .filter(d => d.status === 'applied')
              .slice(0, 10)
              .map((decision) => (
                <div key={decision.id} className="flex items-center justify-between p-2 rounded border-l-2 border-l-success bg-success/5">
                  <div>
                    <span className="font-medium">{decision.action.replace(/_/g, ' ')}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      ({(decision.confidence * 100).toFixed(0)}% confidence)
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {decision.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};