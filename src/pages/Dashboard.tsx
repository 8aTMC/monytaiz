import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navigation, useSidebar } from '@/components/Navigation';
import { User, Session } from '@supabase/supabase-js';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, TrendingUp, Users, DollarSign } from 'lucide-react';

const Platform = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { isCollapsed } = useSidebar();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session?.user) {
          navigate('/auth');
        } else {
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session?.user) {
        navigate('/auth');
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="animate-pulse">
          {/* Skeleton Navigation */}
          <div className="fixed left-0 top-0 h-full w-64 bg-muted/20 border-r"></div>
          
          {/* Skeleton Main Content */}
          <div className="ml-64 p-8">
            <div className="max-w-7xl mx-auto">
              {/* Header Skeleton */}
              <div className="mb-8">
                <div className="h-8 w-64 bg-muted/30 rounded mb-2"></div>
                <div className="h-4 w-96 bg-muted/20 rounded"></div>
              </div>
              
              {/* Quick Actions Skeleton */}
              <div className="mb-8 flex gap-4">
                <div className="h-12 w-32 bg-muted/30 rounded"></div>
                <div className="h-12 w-28 bg-muted/20 rounded"></div>
                <div className="h-12 w-24 bg-muted/20 rounded"></div>
              </div>
              
              {/* Stats Grid Skeleton */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-muted/20 rounded-lg"></div>
                ))}
              </div>
              
              {/* Content Grid Skeleton */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="h-64 bg-muted/20 rounded-lg"></div>
                <div className="h-64 bg-muted/20 rounded-lg"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
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
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className={`transition-all duration-300 p-8 ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
        <div className="max-w-7xl mx-auto">
          {/* Empty dashboard for fans */}
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-muted-foreground mb-2">
                Welcome to your dashboard
              </h1>
              <p className="text-muted-foreground">
                Your content will appear here soon
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Platform;