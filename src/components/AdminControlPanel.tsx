import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Settings, 
  Users, 
  Zap, 
  Shield, 
  BarChart3, 
  Globe, 
  Server,
  Database,
  Cpu,
  HardDrive,
  Network,
  Power,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SystemConfig {
  optimizationEngine: boolean;
  mlPredictions: boolean;
  realTimeAnalytics: boolean;
  autoScaling: boolean;
  performanceMonitoring: boolean;
  securityScanning: boolean;
}

interface PerformancePolicy {
  name: string;
  description: string;
  enabled: boolean;
  settings: {
    cpuThreshold: number;
    memoryThreshold: number;
    responseTimeLimit: number;
    errorRateThreshold: number;
  };
}

interface UserQuota {
  userId: string;
  username: string;
  role: string;
  quotas: {
    apiCalls: { used: number; limit: number };
    storage: { used: number; limit: number };
    bandwidth: { used: number; limit: number };
  };
  status: 'active' | 'suspended' | 'warning';
}

export const AdminControlPanel: React.FC = () => {
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({
    optimizationEngine: true,
    mlPredictions: true,
    realTimeAnalytics: true,
    autoScaling: true,
    performanceMonitoring: true,
    securityScanning: true
  });

  const [performancePolicies, setPerformancePolicies] = useState<PerformancePolicy[]>([
    {
      name: 'High Performance',
      description: 'Aggressive optimization for maximum performance',
      enabled: true,
      settings: {
        cpuThreshold: 70,
        memoryThreshold: 80,
        responseTimeLimit: 200,
        errorRateThreshold: 0.5
      }
    },
    {
      name: 'Balanced',
      description: 'Balanced performance and resource usage',
      enabled: false,
      settings: {
        cpuThreshold: 80,
        memoryThreshold: 85,
        responseTimeLimit: 500,
        errorRateThreshold: 1.0
      }
    },
    {
      name: 'Conservative',
      description: 'Conservative settings for stability',
      enabled: false,
      settings: {
        cpuThreshold: 90,
        memoryThreshold: 90,
        responseTimeLimit: 1000,
        errorRateThreshold: 2.0
      }
    }
  ]);

  const [userQuotas, setUserQuotas] = useState<UserQuota[]>([
    {
      userId: '1',
      username: 'john_creator',
      role: 'creator',
      quotas: {
        apiCalls: { used: 8500, limit: 10000 },
        storage: { used: 45, limit: 100 },
        bandwidth: { used: 250, limit: 500 }
      },
      status: 'active'
    },
    {
      userId: '2',
      username: 'admin_user',
      role: 'admin',
      quotas: {
        apiCalls: { used: 2300, limit: 50000 },
        storage: { used: 12, limit: 1000 },
        bandwidth: { used: 89, limit: 2000 }
      },
      status: 'active'
    },
    {
      userId: '3',
      username: 'fan_user_123',
      role: 'fan',
      quotas: {
        apiCalls: { used: 950, limit: 1000 },
        storage: { used: 5, limit: 10 },
        bandwidth: { used: 45, limit: 50 }
      },
      status: 'warning'
    }
  ]);

  const [globalSettings, setGlobalSettings] = useState({
    maintenanceMode: false,
    emergencyShutdown: false,
    debugMode: false,
    loadBalancing: true,
    cacheEnabled: true,
    compressionEnabled: true
  });

  const { toast } = useToast();

  const toggleSystemConfig = (key: keyof SystemConfig) => {
    setSystemConfig(prev => ({ ...prev, [key]: !prev[key] }));
    toast({
      title: "System Configuration Updated",
      description: `${key} has been ${systemConfig[key] ? 'disabled' : 'enabled'}`
    });
  };

  const togglePerformancePolicy = (policyName: string) => {
    setPerformancePolicies(prev => prev.map(policy => ({
      ...policy,
      enabled: policy.name === policyName ? !policy.enabled : false
    })));
  };

  const updatePolicyThreshold = (policyName: string, setting: string, value: number[]) => {
    setPerformancePolicies(prev => prev.map(policy => 
      policy.name === policyName 
        ? { 
            ...policy, 
            settings: { ...policy.settings, [setting]: value[0] } 
          }
        : policy
    ));
  };

  const toggleGlobalSetting = (key: keyof typeof globalSettings) => {
    if (key === 'emergencyShutdown' || key === 'maintenanceMode') {
      // Add confirmation for critical settings
      if (confirm(`Are you sure you want to ${globalSettings[key] ? 'disable' : 'enable'} ${key}?`)) {
        setGlobalSettings(prev => ({ ...prev, [key]: !prev[key] }));
        toast({
          title: "Critical Setting Updated",
          description: `${key} has been ${globalSettings[key] ? 'disabled' : 'enabled'}`,
          variant: key === 'emergencyShutdown' ? 'destructive' : 'default'
        });
      }
    } else {
      setGlobalSettings(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };

  const suspendUser = (userId: string) => {
    setUserQuotas(prev => prev.map(user => 
      user.userId === userId ? { ...user, status: 'suspended' } : user
    ));
    toast({
      title: "User Suspended",
      description: "User account has been suspended",
      variant: "destructive"
    });
  };

  const getQuotaStatus = (used: number, limit: number) => {
    const percentage = (used / limit) * 100;
    if (percentage >= 90) return 'critical';
    if (percentage >= 75) return 'warning';
    return 'normal';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge variant="outline">Active</Badge>;
      case 'warning': return <Badge variant="secondary">Warning</Badge>;
      case 'suspended': return <Badge variant="destructive">Suspended</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Enterprise Admin Control Panel
          </CardTitle>
          <CardDescription>
            Comprehensive system management and configuration for enterprise deployment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="system" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="system">System Config</TabsTrigger>
              <TabsTrigger value="policies">Performance Policies</TabsTrigger>
              <TabsTrigger value="quotas">User Quotas</TabsTrigger>
              <TabsTrigger value="global">Global Settings</TabsTrigger>
              <TabsTrigger value="emergency">Emergency Controls</TabsTrigger>
            </TabsList>

            <TabsContent value="system" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-5 w-5" />
                    System Components
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(systemConfig).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="font-medium">
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </span>
                        <p className="text-sm text-muted-foreground">
                          {key === 'optimizationEngine' && 'Automatic performance optimization system'}
                          {key === 'mlPredictions' && 'Machine learning based predictions'}
                          {key === 'realTimeAnalytics' && 'Real-time analytics processing'}
                          {key === 'autoScaling' && 'Automatic resource scaling'}
                          {key === 'performanceMonitoring' && 'Continuous performance monitoring'}
                          {key === 'securityScanning' && 'Automated security vulnerability scanning'}
                        </p>
                      </div>
                      <Switch
                        checked={value}
                        onCheckedChange={() => toggleSystemConfig(key as keyof SystemConfig)}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="policies" className="space-y-4">
              {performancePolicies.map((policy) => (
                <Card key={policy.name}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        {policy.name} Policy
                      </div>
                      <Switch
                        checked={policy.enabled}
                        onCheckedChange={() => togglePerformancePolicy(policy.name)}
                      />
                    </CardTitle>
                    <CardDescription>{policy.description}</CardDescription>
                  </CardHeader>
                  {policy.enabled && (
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">CPU Threshold: {policy.settings.cpuThreshold}%</label>
                          <Slider
                            value={[policy.settings.cpuThreshold]}
                            onValueChange={(value) => updatePolicyThreshold(policy.name, 'cpuThreshold', value)}
                            max={100}
                            step={5}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Memory Threshold: {policy.settings.memoryThreshold}%</label>
                          <Slider
                            value={[policy.settings.memoryThreshold]}
                            onValueChange={(value) => updatePolicyThreshold(policy.name, 'memoryThreshold', value)}
                            max={100}
                            step={5}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Response Time Limit: {policy.settings.responseTimeLimit}ms</label>
                          <Slider
                            value={[policy.settings.responseTimeLimit]}
                            onValueChange={(value) => updatePolicyThreshold(policy.name, 'responseTimeLimit', value)}
                            max={2000}
                            step={50}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Error Rate Threshold: {policy.settings.errorRateThreshold}%</label>
                          <Slider
                            value={[policy.settings.errorRateThreshold]}
                            onValueChange={(value) => updatePolicyThreshold(policy.name, 'errorRateThreshold', value)}
                            max={10}
                            step={0.1}
                          />
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="quotas" className="space-y-4">
              {userQuotas.map((user) => (
                <Card key={user.userId}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        {user.username}
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(user.status)}
                        <Badge variant="outline">{user.role}</Badge>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      {Object.entries(user.quotas).map(([type, quota]) => {
                        const status = getQuotaStatus(quota.used, quota.limit);
                        return (
                          <div key={type} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-medium capitalize">{type}</span>
                              <span className={`text-sm ${
                                status === 'critical' ? 'text-red-500' : 
                                status === 'warning' ? 'text-yellow-500' : 'text-green-500'
                              }`}>
                                {quota.used}/{quota.limit}
                              </span>
                            </div>
                            <div className="w-full bg-secondary rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  status === 'critical' ? 'bg-red-500' : 
                                  status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min((quota.used / quota.limit) * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {user.status !== 'suspended' && (
                      <div className="mt-4 pt-4 border-t flex justify-end">
                        <Button variant="destructive" size="sm" onClick={() => suspendUser(user.userId)}>
                          Suspend User
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="global" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Global System Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(globalSettings).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="font-medium">
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </span>
                        <p className="text-sm text-muted-foreground">
                          {key === 'maintenanceMode' && 'Enable maintenance mode for system updates'}
                          {key === 'emergencyShutdown' && 'Emergency system shutdown capability'}
                          {key === 'debugMode' && 'Enable debug logging and detailed error messages'}
                          {key === 'loadBalancing' && 'Distribute traffic across multiple servers'}
                          {key === 'cacheEnabled' && 'Enable caching for improved performance'}
                          {key === 'compressionEnabled' && 'Enable response compression'}
                        </p>
                      </div>
                      <Switch
                        checked={value}
                        onCheckedChange={() => toggleGlobalSetting(key as keyof typeof globalSettings)}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="emergency" className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  These are emergency controls. Use with extreme caution as they can affect system availability.
                </AlertDescription>
              </Alert>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <Power className="h-5 w-5" />
                    Emergency Controls
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Button variant="destructive" className="h-20">
                      <div className="text-center">
                        <Power className="h-6 w-6 mx-auto mb-2" />
                        Emergency Shutdown
                      </div>
                    </Button>
                    <Button variant="outline" className="h-20">
                      <div className="text-center">
                        <Shield className="h-6 w-6 mx-auto mb-2" />
                        Security Lockdown
                      </div>
                    </Button>
                    <Button variant="outline" className="h-20">
                      <div className="text-center">
                        <Database className="h-6 w-6 mx-auto mb-2" />
                        Database Backup
                      </div>
                    </Button>
                    <Button variant="outline" className="h-20">
                      <div className="text-center">
                        <Network className="h-6 w-6 mx-auto mb-2" />
                        Traffic Redirect
                      </div>
                    </Button>
                  </div>
                  
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      All systems operating normally. No emergency actions required.
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