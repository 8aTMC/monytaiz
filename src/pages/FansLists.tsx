import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navigation, useSidebar } from '@/components/Navigation';
import { User, Session } from '@supabase/supabase-js';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { 
  List,
  Plus,
  Users,
  Edit3,
  Trash2,
  MoreVertical
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface FanList {
  id: string;
  name: string;
  description: string;
  count: number;
  createdAt: string;
}

const FansLists = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [fanLists, setFanLists] = useState<FanList[]>([]);
  const { isCollapsed } = useSidebar();

  // Mock data for demonstration only - no fictional users
  const mockLists: FanList[] = [
    {
      id: '1',
      name: 'VIP Members',
      description: 'High-value supporters and premium subscribers',
      count: 0, // Real count will be 0 until implemented
      createdAt: '2024-01-15'
    },
    {
      id: '2',
      name: 'New Subscribers',
      description: 'Fans who joined in the last 30 days',
      count: 0, // Real count will be 0 until implemented
      createdAt: '2024-02-01'
    },
    {
      id: '3',
      name: 'Regular Tippers',
      description: 'Fans who tip regularly and frequently',
      count: 0, // Real count will be 0 until implemented
      createdAt: '2024-01-20'
    }
  ];

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
    if (user) {
      // For now, use mock data - in the future this would fetch from the database
      setFanLists(mockLists);
    }
  }, [user]);

  const handleCreateList = () => {
    // TODO: Implement create list functionality
    console.log('Create new list');
  };

  const handleEditList = (listId: string) => {
    // TODO: Implement edit list functionality
    console.log('Edit list:', listId);
  };

  const handleDeleteList = (listId: string) => {
    // TODO: Implement delete list functionality
    console.log('Delete list:', listId);
  };

  const handleListClick = (listId: string) => {
    navigate(`/fans/lists/${listId}`);
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

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className={`transition-all duration-300 p-8 ${isCollapsed ? 'ml-16' : 'ml-52'} overflow-x-auto`}>
        <div className="max-w-7xl mx-auto min-w-[700px]">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-2">
              <div className="flex items-center gap-3">
                <List className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold text-foreground">Fan Lists</h1>
              </div>
              <Button onClick={handleCreateList} className="gap-2">
                <Plus className="h-4 w-4" />
                Create List
              </Button>
            </div>
            <p className="text-muted-foreground">
              Create and manage custom lists to organize your fans by specific criteria.
            </p>
          </div>

          {/* Lists Grid */}
          {fanLists.length === 0 ? (
            <div className="text-center py-12">
              <div className="max-w-md mx-auto">
                <List className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No lists created yet</h3>
                <p className="text-muted-foreground mb-6">
                  Create custom lists to organize your fans based on specific criteria like engagement level, subscription status, or custom tags.
                </p>
                <Button onClick={handleCreateList} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Your First List
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {fanLists.map((list) => (
                <Card 
                  key={list.id} 
                  className="bg-gradient-card border-border shadow-card hover:shadow-lg transition-all cursor-pointer group"
                  onClick={() => handleListClick(list.id)}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-foreground text-lg mb-2 truncate">
                          {list.name}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {list.description}
                        </p>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => handleEditList(list.id)}>
                            <Edit3 className="h-4 w-4 mr-2" />
                            Edit List
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteList(list.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete List
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="secondary">
                          {list.count} {list.count === 1 ? 'fan' : 'fans'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Created {format(new Date(list.createdAt), 'dd/MM/yyyy')}
                      </p>
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

export default FansLists;