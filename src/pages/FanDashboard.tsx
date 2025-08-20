import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { Navigation, useSidebar } from '@/components/Navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Heart, Star, Gift } from 'lucide-react';
import { ChatDialog } from '@/components/ChatDialog';
import SpendingChart from '@/components/SpendingChart';

const FanDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const { isCollapsed, isNarrowScreen } = useSidebar();

  const openDirectChat = async () => {
    if (!user) return;

    try {
      // Get the first available creator
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['owner', 'creator'])
        .limit(1);

      if (roleError) throw roleError;
      
      if (!roleData || roleData.length === 0) {
        toast({
          title: "No creators available",
          description: "There are no creators to chat with at the moment",
          variant: "destructive",
        });
        return;
      }

      const creatorId = roleData[0].user_id;

      // Check if conversation already exists
      const { data: existingConv, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('fan_id', user.id)
        .eq('creator_id', creatorId)
        .limit(1);

      if (convError) throw convError;

      if (existingConv && existingConv.length > 0) {
        // Open existing conversation
        setChatOpen(true);
      } else {
        // Create new conversation
        const { error: createError } = await supabase
          .from('conversations')
          .insert({
            fan_id: user.id,
            creator_id: creatorId,
          });

        if (createError) throw createError;
        setChatOpen(true);
      }
    } catch (error) {
      console.error('Error opening chat:', error);
      toast({
        title: "Error",
        description: "Failed to open chat",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session?.user) {
          navigate('/');
        } else {
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session?.user) {
        navigate('/');
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Navigation />
        <main className={`flex-1 transition-all duration-300 p-6 overflow-x-auto pt-[73px] ${isNarrowScreen && !isCollapsed ? 'ml-0' : ''}`}>
          <div className="max-w-7xl mx-auto min-w-[700px] animate-pulse">
            {/* Header Skeleton */}
            <div className="mb-8">
              <div className="h-8 w-64 bg-muted/30 rounded mb-2"></div>
              <div className="h-4 w-96 bg-muted/20 rounded"></div>
            </div>
            
            {/* Quick Actions Skeleton */}
            <div className="mb-8 flex gap-4">
              <div className="h-12 w-32 bg-muted/30 rounded"></div>
              <div className="h-12 w-28 bg-muted/20 rounded"></div>
            </div>
            
            {/* Stats Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-muted/20 rounded-lg"></div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const stats = [
    {
      title: "Following",
      value: "0",
      icon: Heart,
      change: "+0%",
      changeType: "positive" as const,
    },
    {
      title: "Favorites",
      value: "0",
      icon: Star,
      change: "+0%",
      changeType: "positive" as const,
    },
    {
      title: "Purchases",
      value: "0",
      icon: Gift,
      change: "+0%",
      changeType: "positive" as const,
    },
  ];

  return (
    <div className="p-6 pt-6">
      <div className="max-w-7xl mx-auto min-w-[700px]">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            {t('fan.dashboard.title', 'Dashboard')}
          </h1>
          <p className="text-muted-foreground mt-2">
            Welcome back! Discover and connect with your favorite creators.
          </p>
        </div>

          {/* Quick Actions */}
          <div className="mb-8 flex gap-4">
            <Button onClick={openDirectChat} className="gap-2">
              <MessageCircle className="h-4 w-4" />
              Chat with Creator
            </Button>
            <Button variant="outline" disabled>
              Browse Content (Coming Soon)
            </Button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {stats.map((stat) => (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
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
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Heart className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">New favorites available</p>
                      <p className="text-xs text-muted-foreground">Check out the latest content from creators you follow</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <MessageCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Start chatting</p>
                      <p className="text-xs text-muted-foreground">Connect with your favorite creators through chat</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Star className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Discover new content</p>
                      <p className="text-xs text-muted-foreground">Explore trending content and new creators</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Your Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Messages Sent</span>
                    <span className="font-medium">0</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Content Viewed</span>
                    <span className="font-medium">0</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Tips Given</span>
                    <span className="font-medium">$0.00</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Following</span>
                    <span className="font-medium">0 creators</span>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => navigate('/profile')}>
                    View Profile Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Spending Chart */}
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Your Spending Overview</CardTitle>
                <CardDescription>
                  Track your spending patterns over the last 30 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SpendingChart userId={user.id} />
              </CardContent>
            </Card>
          </div>

        <ChatDialog open={chatOpen} onOpenChange={setChatOpen} />
      </div>
    </div>
  );
};

export default FanDashboard;