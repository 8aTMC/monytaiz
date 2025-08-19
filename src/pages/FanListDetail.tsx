import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navigation, useSidebar } from '@/components/Navigation';
import { User, Session } from '@supabase/supabase-js';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Users, 
  MoreVertical, 
  Copy, 
  MessageSquare, 
  FileText, 
  Shield, 
  UserMinus, 
  RefreshCw,
  List
} from 'lucide-react';

interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  created_at: string;
  fan_category: 'husband' | 'boyfriend' | 'supporter' | 'friend' | 'fan';
  email?: string;
  email_confirmed?: boolean;
  google_verified?: boolean;
}

interface FanList {
  id: string;
  name: string;
  description: string;
  count: number;
  createdAt: string;
}

const FanListDetail = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { listId } = useParams<{ listId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [listData, setListData] = useState<FanList | null>(null);
  const [fans, setFans] = useState<Profile[]>([]);
  const { isCollapsed, isNarrowScreen } = useSidebar();

  // Mock data for demonstration - this would be replaced with real database queries
  const mockLists: Record<string, FanList> = {
    '1': {
      id: '1',
      name: 'VIP Members',
      description: 'High-value supporters and premium subscribers',
      count: 0,
      createdAt: '2024-01-15'
    },
    '2': {
      id: '2',
      name: 'New Subscribers',
      description: 'Fans who joined in the last 30 days',
      count: 0,
      createdAt: '2024-02-01'
    },
    '3': {
      id: '3',
      name: 'Regular Tippers',
      description: 'Fans who tip regularly and frequently',
      count: 0,
      createdAt: '2024-01-20'
    }
  };

  const getCategoryDisplay = (category: Profile['fan_category']) => {
    const emojiMap = {
      husband: '💍',
      boyfriend: '💕',
      supporter: '⭐',
      friend: '👫',
      fan: '🥰'
    };
    
    const emoji = emojiMap[category];
    const capitalizedCategory = category.charAt(0).toUpperCase() + category.slice(1);
    return `${emoji} ${capitalizedCategory}`;
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session?.user) {
          navigate('/');
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session?.user) {
        navigate('/');
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user && listId) {
      // Load list data and fans from real database
      const fetchListData = async () => {
        try {
          // For now, we only have mock list metadata since fan lists aren't implemented in DB yet
          const list = mockLists[listId];
          if (list) {
            setListData(list);
            // Set empty fans array - no fictional users
            setFans([]);
          } else {
            // List not found, redirect back
            navigate('/fans/lists');
          }
        } catch (error) {
          console.error('Error fetching list data:', error);
          navigate('/fans/lists');
        }
        setListLoading(false);
      };
      
      fetchListData();
    }
  }, [user, listId, navigate]);

  const handleMenuAction = (action: string, fan: Profile) => {
    switch (action) {
      case 'copy-link':
        navigator.clipboard.writeText(`${window.location.origin}/fan/${fan.id}`);
        toast({
          title: "Success",
          description: "Profile link copied to clipboard",
        });
        break;
      case 'view-comments':
        console.log('View comments for:', fan.id);
        break;
      case 'add-notes':
        console.log('Add notes for:', fan.id);
        break;
      case 'restrict':
        console.log('Restrict user:', fan.id);
        break;
      case 'remove-from-list':
        console.log('Remove from list:', fan.id);
        // In a real implementation, this would remove the fan from the current list
        toast({
          title: "Success",
          description: `${fan.display_name || fan.username} removed from ${listData?.name}`,
        });
        break;
      default:
        console.log(`${action} action for user:`, fan.id);
        break;
    }
  };

  const refreshList = () => {
    setListLoading(true);
    // Fetch real data when implemented
    setTimeout(() => {
      setListLoading(false);
      // For now, just refresh with empty list since we don't have real fan list data
      setFans([]);
      toast({
        title: "Success", 
        description: "List refreshed successfully",
      });
    }, 1000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !listData) {
    return null;
  }

  return (
    <div className={`min-h-screen bg-background ${isNarrowScreen && !isCollapsed ? 'min-w-[calc(100vw+13rem)]' : ''}`}>
      <Navigation />
      
      <main className={`transition-all duration-300 p-8 ${isCollapsed ? 'ml-16' : 'ml-52'} overflow-x-auto`}>
        <div className="max-w-7xl mx-auto min-w-[700px]">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-6">
              <Button
                variant="ghost"
                onClick={() => navigate('/fans/lists')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Fan Lists
              </Button>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <List className="h-8 w-8 text-primary" />
                <div>
                  <h1 className="text-3xl font-bold text-foreground">{listData.name}</h1>
                  <p className="text-muted-foreground mt-1">{listData.description}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-lg px-4 py-2">
                  <Users className="h-4 w-4 mr-2" />
                  {fans.length} {fans.length === 1 ? 'fan' : 'fans'}
                </Badge>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshList}
                  disabled={listLoading}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${listLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          {/* Fans Grid */}
          {listLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading fans...</p>
            </div>
          ) : fans.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No fans in this list</h3>
              <p className="text-muted-foreground">Start adding fans to this list to see them here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {fans.map((fan) => (
                <Card key={fan.id} className="bg-card border-border shadow-sm hover:shadow-md transition-all cursor-pointer group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1 min-w-0">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={fan.avatar_url || undefined} />
                          <AvatarFallback className="bg-muted text-muted-foreground">
                            {fan.display_name ? fan.display_name.charAt(0).toUpperCase() : '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-foreground truncate">
                              {fan.display_name || fan.username || 'Unknown User'}
                            </h3>
                            {fan.is_verified && (
                              <Badge variant="secondary" className="ml-2">
                                Verified
                              </Badge>
                            )}
                            {fan.google_verified && (
                              <Badge variant="outline" className="text-xs">
                                Google
                              </Badge>
                            )}
                          </div>
                          {fan.username && fan.display_name && (
                            <p className="text-sm text-muted-foreground truncate mb-2">
                              @{fan.username}
                            </p>
                          )}
                          <Badge variant="outline" className="w-fit">
                            {fan.fan_category && getCategoryDisplay(fan.fan_category)}
                          </Badge>
                        </div>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => handleMenuAction('copy-link', fan)}>
                            <Copy className="h-3.5 w-3.5 mr-1.5" />
                            Copy link to profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleMenuAction('view-comments', fan)}>
                            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                            View user's comments
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleMenuAction('add-notes', fan)}>
                            <FileText className="h-3.5 w-3.5 mr-1.5" />
                            Add notes
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleMenuAction('restrict', fan)}>
                            <Shield className="h-3.5 w-3.5 mr-1.5" />
                            Restrict
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleMenuAction('remove-from-list', fan)}
                            className="text-destructive"
                          >
                            <UserMinus className="h-3.5 w-3.5 mr-1.5" />
                            Remove from list
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    {fan.bio && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {fan.bio}
                      </p>
                    )}
                    <div className="text-xs text-muted-foreground">
                      <p><strong>Joined:</strong> {new Date(fan.created_at).toLocaleDateString()}</p>
                      {fan.email && (
                        <p><strong>Email:</strong> {fan.email_confirmed ? '✓' : '✗'} Verified</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default FanListDetail;