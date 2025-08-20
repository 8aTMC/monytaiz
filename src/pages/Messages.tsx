import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { Navigation, useSidebar } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle, Send, Search, User as UserIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from '@/hooks/useTranslation';
import FanMessages from '@/components/FanMessages';

const Messages = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFan, setIsFan] = useState(false);
  const { isCollapsed, isNarrowScreen } = useSidebar();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Redirect non-authenticated users to login
        if (!session?.user) {
          navigate('/');
        }
      }
    );

    // Check current session on component mount
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Check if user is a fan
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id);
        
        const roles = rolesData?.map(r => r.role) || [];
        setIsFan(roles.length === 1 && roles.includes('fan'));
      }
      
      setLoading(false);
      
      if (!session?.user) {
        navigate('/');
      }
    };

    checkSession();

    // Cleanup subscription on unmount
    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Fans see a direct chat interface, management users see the full messages page
  if (isFan) {
    return <FanMessages user={user} />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Navigation />
      <main className={`flex-1 transition-all duration-300 p-6 pt-[73px] ${isNarrowScreen && !isCollapsed ? 'ml-0' : ''}`}>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Messages</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Conversations List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Conversations
                </CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search conversations..."
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">Fan User</div>
                      <div className="text-xs text-muted-foreground">2:30 PM</div>
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      Hey! Thanks for the content...
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">Another Fan</div>
                      <div className="text-xs text-muted-foreground">1:15 PM</div>
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      Question about subscription...
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-2">
            <Card className="h-[calc(100vh-200px)] flex flex-col">
              <CardHeader className="border-b border-border">
                <CardTitle className="flex items-center gap-2">
                  <UserIcon className="h-5 w-5" />
                  Fan User
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="bg-muted p-3 rounded-lg">
                        <p className="text-sm">Hey! Thanks for the content. I have a question about the upcoming releases!</p>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">2:30 PM</div>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 justify-end">
                    <div className="flex-1 text-right">
                      <div className="bg-primary/10 p-3 rounded-lg inline-block">
                        <p className="text-sm">Thanks for reaching out! What would you like to know?</p>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">2:32 PM</div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Type a message..." 
                    className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <Button>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Messages;