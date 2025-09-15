import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navigation, useSidebar } from '@/components/Navigation';
import { User, Session } from '@supabase/supabase-js';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, TrendingUp, Users, DollarSign, Activity } from 'lucide-react';
import { PerformanceAnalyticsDashboard } from '@/components/PerformanceAnalyticsDashboard';
import AutoOptimizationEngine from '@/components/AutoOptimizationEngine';
import { PredictiveAnalyticsDashboard } from '@/components/PredictiveAnalyticsDashboard';
import { MLDecisionEngine } from '@/components/MLDecisionEngine';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardErrorBoundary } from '@/components/DashboardErrorBoundary';
import FanDashboard from './FanDashboard';

const Platform = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const { isCollapsed, isNarrowScreen } = useSidebar();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session?.user) {
          navigate('/');
        } else {
          // Fetch user role after authentication
          fetchUserRole(session.user.id);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session?.user) {
        navigate('/');
      } else {
        fetchUserRole(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user role:', error);
        setUserRole('fan'); // Default to fan if no role found
      } else if (data) {
        // Handle both object and array responses
        const role = Array.isArray(data) ? data[0]?.role : data.role;
        setUserRole(role || 'fan');
      } else {
        // No role found, default to fan
        setUserRole('fan');
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
      setUserRole('fan');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        {/* Header Skeleton */}
        <div className="space-y-2">
          <div className="h-8 w-64 bg-muted rounded"></div>
          <div className="h-4 w-96 bg-muted/60 rounded"></div>
        </div>
        
        {/* Quick Actions Skeleton */}
        <div className="flex gap-4">
          <div className="h-12 w-32 bg-muted rounded"></div>
          <div className="h-12 w-28 bg-muted/60 rounded"></div>
          <div className="h-12 w-24 bg-muted/60 rounded"></div>
        </div>
        
        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-card border border-border rounded-lg"></div>
          ))}
        </div>
        
        {/* Content Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="h-64 bg-card border border-border rounded-lg"></div>
          <div className="h-64 bg-card border border-border rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Render fan dashboard for fans
  if (userRole === 'fan') {
    return <FanDashboard />;
  }

  const stats = [
    {
      title: "Total Earnings",
      value: "$0.00",
      icon: DollarSign,
      change: "+0%",
      changeType: "positive" as const,
    },
    {
      title: "Active Fans",
      value: "0",
      icon: Users,
      change: "+0%",
      changeType: "positive" as const,
    },
    {
      title: "Content Views",
      value: "0",
      icon: TrendingUp,
      change: "+0%",
      changeType: "positive" as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t('platform.dashboard.title', 'Dashboard')}
        </h1>
      </div>
      
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="optimization">Auto-Optimization</TabsTrigger>
          <TabsTrigger value="predictive">ML Analytics</TabsTrigger>
        </TabsList>

          <TabsContent value="overview" className="space-y-6">
          {/* Quick Actions */}
          <div className="flex gap-4">
            <Button variant="aiz" onClick={() => navigate('/upload')} className="gap-2">
              <Plus className="h-4 w-4" />
              {t('platform.dashboard.uploadContent', 'Upload Content')}
            </Button>
            <Button variant="outline" onClick={() => navigate('/messages')}>
              {t('platform.dashboard.viewMessages', 'View Messages')}
            </Button>
            <Button variant="outline" onClick={() => navigate('/fans')}>
              {t('platform.dashboard.manageFans', 'Manage Fans')}
            </Button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.map((stat) => (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                  <p className={`text-xs ${
                    stat.changeType === 'positive' 
                      ? 'text-primary' 
                      : stat.changeType === 'negative' 
                      ? 'text-destructive' 
                      : 'text-muted-foreground'
                  }`}>
                    {stat.change} from last month
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Content Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-foreground">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Content performance improving</p>
                      <p className="text-xs text-muted-foreground">Your recent uploads are getting more engagement</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">New fans this week</p>
                      <p className="text-xs text-muted-foreground">You've gained new followers recently</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Earnings update</p>
                      <p className="text-xs text-muted-foreground">Check your latest earnings and payouts</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-foreground">Quick Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Content</span>
                    <span className="font-medium text-foreground">0 items</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Active Subscriptions</span>
                    <span className="font-medium text-foreground">0</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Messages Today</span>
                    <span className="font-medium text-foreground">0</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Profile Views</span>
                    <span className="font-medium text-foreground">0</span>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => navigate('/analytics')}>
                    View Detailed Analytics
                  </Button>
                 </div>
               </CardContent>
            </Card>
          </div>
          
          </TabsContent>
          
          <TabsContent value="performance" className="space-y-4">
            <DashboardErrorBoundary>
              <PerformanceAnalyticsDashboard />
            </DashboardErrorBoundary>
          </TabsContent>
          
          <TabsContent value="optimization" className="space-y-4">
            <DashboardErrorBoundary>
              <AutoOptimizationEngine userId={user?.id} />
            </DashboardErrorBoundary>
          </TabsContent>
          
          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Advanced Analytics</CardTitle>
                <CardDescription>Detailed insights and metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Advanced analytics dashboard coming soon.</p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="revenue" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Analytics</CardTitle>
                <CardDescription>Earnings and financial insights</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Revenue analytics dashboard coming soon.</p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="predictive" className="space-y-6">
            <DashboardErrorBoundary>
              <div className="space-y-6">
                <div className="w-full">
                  <PredictiveAnalyticsDashboard />
                </div>
                <div className="w-full">
                  <MLDecisionEngine />
                </div>
              </div>
            </DashboardErrorBoundary>
          </TabsContent>
          
        </Tabs>
    </div>
  );
 };

export default Platform;