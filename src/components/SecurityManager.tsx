import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  Lock, 
  Eye, 
  UserX, 
  FileText, 
  AlertTriangle,
  CheckCircle,
  Settings,
  Database,
  Key,
  Fingerprint
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SecurityMetrics {
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  activeThreats: number;
  blockedRequests: number;
  dataComplianceScore: number;
  encryptionStatus: number;
  auditScore: number;
}

interface PrivacySetting {
  key: string;
  title: string;
  description: string;
  enabled: boolean;
  required: boolean;
  category: 'data' | 'tracking' | 'privacy' | 'security';
}

interface SecurityIncident {
  id: string;
  type: 'data_breach' | 'unauthorized_access' | 'policy_violation' | 'malicious_request';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: Date;
  resolved: boolean;
  affectedUsers?: number;
}

export const SecurityManager: React.FC = () => {
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetrics>({
    threatLevel: 'low',
    activeThreats: 0,
    blockedRequests: 1247,
    dataComplianceScore: 95,
    encryptionStatus: 100,
    auditScore: 88
  });

  const [privacySettings, setPrivacySettings] = useState<PrivacySetting[]>([
    {
      key: 'behaviorTracking',
      title: 'User Behavior Tracking',
      description: 'Track user interactions for optimization purposes',
      enabled: true,
      required: false,
      category: 'tracking'
    },
    {
      key: 'performanceAnalytics',
      title: 'Performance Analytics',
      description: 'Collect performance data for system optimization',
      enabled: true,
      required: false,
      category: 'data'
    },
    {
      key: 'dataAnonymization',
      title: 'Data Anonymization',
      description: 'Automatically anonymize collected user data',
      enabled: true,
      required: true,
      category: 'privacy'
    },
    {
      key: 'gdprCompliance',
      title: 'GDPR Compliance',
      description: 'Enable GDPR compliance features',
      enabled: true,
      required: true,
      category: 'privacy'
    },
    {
      key: 'encryptionAtRest',
      title: 'Encryption at Rest',
      description: 'Encrypt all data stored in databases',
      enabled: true,
      required: true,
      category: 'security'
    },
    {
      key: 'auditLogging',
      title: 'Audit Logging',
      description: 'Log all security-related events',
      enabled: true,
      required: true,
      category: 'security'
    }
  ]);

  const [incidents, setIncidents] = useState<SecurityIncident[]>([
    {
      id: '1',
      type: 'malicious_request',
      severity: 'medium',
      description: 'Multiple failed login attempts detected from IP 192.168.1.100',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      resolved: false,
      affectedUsers: 0
    },
    {
      id: '2',
      type: 'policy_violation',
      severity: 'low',
      description: 'User attempted to access restricted analytics data',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
      resolved: true,
      affectedUsers: 1
    }
  ]);

  const { toast } = useToast();

  useEffect(() => {
    // Simulate real-time security monitoring
    const interval = setInterval(() => {
      setSecurityMetrics(prev => ({
        ...prev,
        blockedRequests: prev.blockedRequests + Math.floor(Math.random() * 5),
        dataComplianceScore: Math.max(85, Math.min(100, prev.dataComplianceScore + (Math.random() - 0.5) * 2))
      }));
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const togglePrivacySetting = (key: string) => {
    setPrivacySettings(prev => prev.map(setting => 
      setting.key === key && !setting.required
        ? { ...setting, enabled: !setting.enabled }
        : setting
    ));
  };

  const resolveIncident = (incidentId: string) => {
    setIncidents(prev => prev.map(incident => 
      incident.id === incidentId ? { ...incident, resolved: true } : incident
    ));
    toast({
      title: "Incident Resolved",
      description: "Security incident has been marked as resolved"
    });
  };

  const runSecurityScan = () => {
    toast({
      title: "Security Scan Started",
      description: "Comprehensive security scan initiated"
    });
    
    // Simulate scan completion
    setTimeout(() => {
      toast({
        title: "Security Scan Complete",
        description: "No new vulnerabilities detected"
      });
    }, 3000);
  };

  const getThreatLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-500';
      case 'medium': return 'text-yellow-500';
      case 'high': return 'text-orange-500';
      case 'critical': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants = {
      low: 'outline' as const,
      medium: 'secondary' as const,
      high: 'default' as const,
      critical: 'destructive' as const
    };
    return <Badge variant={variants[severity as keyof typeof variants]}>{severity}</Badge>;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'data': return <Database className="h-4 w-4" />;
      case 'tracking': return <Eye className="h-4 w-4" />;
      case 'privacy': return <Lock className="h-4 w-4" />;
      case 'security': return <Shield className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security & Privacy Manager
          </CardTitle>
          <CardDescription>
            Comprehensive security monitoring and privacy compliance management
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Security Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 text-center">
                <div className={`text-2xl font-bold ${getThreatLevelColor(securityMetrics.threatLevel)}`}>
                  {securityMetrics.threatLevel.toUpperCase()}
                </div>
                <div className="text-sm text-muted-foreground">Threat Level</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{securityMetrics.activeThreats}</div>
                <div className="text-sm text-muted-foreground">Active Threats</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{securityMetrics.blockedRequests.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Blocked Requests</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-500">{securityMetrics.dataComplianceScore}%</div>
                <div className="text-sm text-muted-foreground">Compliance Score</div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="privacy" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="privacy">Privacy Settings</TabsTrigger>
              <TabsTrigger value="incidents">Incidents ({incidents.filter(i => !i.resolved).length})</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
              <TabsTrigger value="audit">Audit & Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="privacy" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Privacy & Data Protection</h3>
                <Button onClick={runSecurityScan}>
                  <Fingerprint className="h-4 w-4 mr-2" />
                  Run Security Scan
                </Button>
              </div>
              
              <div className="grid gap-4">
                {['data', 'tracking', 'privacy', 'security'].map(category => (
                  <Card key={category}>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        {getCategoryIcon(category)}
                        {category.charAt(0).toUpperCase() + category.slice(1)} Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {privacySettings
                        .filter(setting => setting.category === category)
                        .map((setting) => (
                          <div key={setting.key} className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{setting.title}</span>
                                {setting.required && <Badge variant="outline">Required</Badge>}
                              </div>
                              <p className="text-sm text-muted-foreground">{setting.description}</p>
                            </div>
                            <Switch
                              checked={setting.enabled}
                              onCheckedChange={() => togglePrivacySetting(setting.key)}
                              disabled={setting.required}
                            />
                          </div>
                        ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="incidents" className="space-y-4">
              {incidents.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <p className="text-muted-foreground">No security incidents reported</p>
                  </CardContent>
                </Card>
              ) : (
                incidents.map((incident) => (
                  <Alert key={incident.id} variant={incident.severity === 'critical' ? 'destructive' : 'default'}>
                    <div className="flex items-start justify-between w-full">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <strong className="capitalize">{incident.type.replace('_', ' ')}</strong>
                            {getSeverityBadge(incident.severity)}
                            {incident.resolved && <Badge variant="outline">Resolved</Badge>}
                          </div>
                          <AlertDescription>
                            {incident.description}
                            {incident.affectedUsers !== undefined && (
                              <div className="text-xs mt-1">
                                Affected users: {incident.affectedUsers}
                              </div>
                            )}
                          </AlertDescription>
                          <div className="text-xs text-muted-foreground mt-1">
                            {incident.timestamp.toLocaleString()}
                          </div>
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

            <TabsContent value="compliance" className="space-y-4">
              <div className="grid gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Compliance Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span>GDPR Compliance</span>
                        <div className="flex items-center gap-2">
                          <Progress value={95} className="w-32" />
                          <span className="text-sm font-medium">95%</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Data Encryption</span>
                        <div className="flex items-center gap-2">
                          <Progress value={100} className="w-32" />
                          <span className="text-sm font-medium">100%</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Access Controls</span>
                        <div className="flex items-center gap-2">
                          <Progress value={88} className="w-32" />
                          <span className="text-sm font-medium">88%</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Audit Logging</span>
                        <div className="flex items-center gap-2">
                          <Progress value={92} className="w-32" />
                          <span className="text-sm font-medium">92%</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="audit" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Security Audit Log
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b">
                      <div>
                        <span className="font-medium">System security scan completed</span>
                        <div className="text-xs text-muted-foreground">2 hours ago</div>
                      </div>
                      <Badge variant="outline">Info</Badge>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <div>
                        <span className="font-medium">Failed login attempt blocked</span>
                        <div className="text-xs text-muted-foreground">4 hours ago</div>
                      </div>
                      <Badge variant="secondary">Warning</Badge>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <div>
                        <span className="font-medium">Privacy settings updated</span>
                        <div className="text-xs text-muted-foreground">1 day ago</div>
                      </div>
                      <Badge variant="outline">Info</Badge>
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