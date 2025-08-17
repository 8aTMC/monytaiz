import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navigation, useSidebar } from '@/components/Navigation';
import { User, Session } from '@supabase/supabase-js';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Users, MoreVertical, Copy, UserMinus, UserX, MessageSquare, FileText, Eye, Shield } from 'lucide-react';

interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  created_at: string;
}

interface UserRole {
  role: string;
}

const Fans = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [fans, setFans] = useState<Profile[]>([]);
  const [loadingFans, setLoadingFans] = useState(true);
  const [selectedFan, setSelectedFan] = useState<Profile | null>(null);
  const [fanRoles, setFanRoles] = useState<Record<string, UserRole[]>>({});
  const { isCollapsed } = useSidebar();

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
    const fetchFans = async () => {
      try {
        // Fetch only users who have the 'fan' role
        const { data, error } = await supabase
          .from('profiles')
          .select(`
            *,
            user_roles!user_roles_user_id_fkey!inner(role)
          `)
          .eq('user_roles.role', 'fan')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching fans:', error);
        } else {
          setFans(data || []);
          
          // Since we already know these users have fan role, just set it
          if (data) {
            const rolesMap: Record<string, UserRole[]> = {};
            data.forEach((fan) => {
              rolesMap[fan.id] = [{ role: 'fan' }];
            });
            setFanRoles(rolesMap);
          }
        }
      } catch (error) {
        console.error('Error fetching fans:', error);
      } finally {
        setLoadingFans(false);
      }
    };

    if (user) {
      fetchFans();
    }
  }, [user]);

  const handleFanClick = (fan: Profile) => {
    setSelectedFan(fan);
  };

  const handleMenuAction = (action: string, fan: Profile) => {
    console.log(`${action} action for user:`, fan.id);
    // Here you would implement the actual actions
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
      
      <main className={`transition-all duration-300 p-8 ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Users className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold text-foreground">
                All Fans
              </h1>
            </div>
            <p className="text-muted-foreground">
              Browse all registered users on the platform
            </p>
          </div>

          {/* Fans Grid */}
          {loadingFans ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading fans...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {fans.map((fan) => (
                  <Card key={fan.id} className="bg-gradient-card border-border shadow-card hover:shadow-lg transition-all cursor-pointer group">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 flex-1 min-w-0" onClick={() => handleFanClick(fan)}>
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={fan.avatar_url || undefined} />
                            <AvatarFallback>
                              {fan.display_name?.[0] || fan.username?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-foreground truncate">
                                {fan.display_name || fan.username || 'Anonymous'}
                              </CardTitle>
                              {fan.is_verified && (
                                <Badge variant="secondary" className="text-xs">
                                  Verified
                                </Badge>
                              )}
                              {fanRoles[fan.id]?.map((userRole) => (
                                <Badge key={userRole.role} variant="outline" className="text-xs">
                                  {userRole.role}
                                </Badge>
                              ))}
                            </div>
                            {fan.username && fan.display_name && (
                              <p className="text-sm text-muted-foreground truncate">
                                @{fan.username}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => handleMenuAction('copy-link', fan)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy link to profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleMenuAction('view-comments', fan)}>
                              <MessageSquare className="h-4 w-4 mr-2" />
                              View user's comments
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleMenuAction('add-notes', fan)}>
                              <FileText className="h-4 w-4 mr-2" />
                              Add notes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleMenuAction('restrict', fan)}>
                              <Shield className="h-4 w-4 mr-2" />
                              Restrict
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleMenuAction('block', fan)} className="text-destructive">
                              <UserX className="h-4 w-4 mr-2" />
                              Block
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent onClick={() => handleFanClick(fan)}>
                      {fan.bio && (
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                          {fan.bio}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Joined {new Date(fan.created_at).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* User Details Modal */}
              <Dialog open={!!selectedFan} onOpenChange={() => setSelectedFan(null)}>
                <DialogContent className="max-w-2xl">
                  {selectedFan && (
                    <>
                      <DialogHeader>
                        <div className="flex items-center space-x-4">
                          <Avatar className="h-16 w-16">
                            <AvatarImage src={selectedFan.avatar_url || undefined} />
                            <AvatarFallback className="text-lg">
                              {selectedFan.display_name?.[0] || selectedFan.username?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <DialogTitle className="flex items-center gap-2">
                              {selectedFan.display_name || selectedFan.username || 'Anonymous'}
                              {selectedFan.is_verified && (
                                <Badge variant="secondary">Verified</Badge>
                              )}
                            </DialogTitle>
                            {selectedFan.username && selectedFan.display_name && (
                              <p className="text-muted-foreground">@{selectedFan.username}</p>
                            )}
                          </div>
                        </div>
                      </DialogHeader>

                      <div className="space-y-6">
                        {/* User Info Section */}
                        <div>
                          <h3 className="font-semibold mb-3">User Information</h3>
                          <div className="space-y-3">
                            <div className="flex justify-between py-2">
                              <span className="text-muted-foreground">Display Name</span>
                              <span>{selectedFan.display_name || 'Not set'}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between py-2">
                              <span className="text-muted-foreground">Username</span>
                              <span>{selectedFan.username || 'Not set'}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between py-2">
                              <span className="text-muted-foreground">Verified</span>
                              <span>{selectedFan.is_verified ? 'Yes' : 'No'}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between py-2">
                              <span className="text-muted-foreground">Member since</span>
                              <span>{new Date(selectedFan.created_at).toLocaleDateString()}</span>
                            </div>
                            {fanRoles[selectedFan.id]?.length > 0 && (
                              <>
                                <Separator />
                                <div className="flex justify-between py-2">
                                  <span className="text-muted-foreground">Roles</span>
                                  <div className="flex gap-1">
                                    {fanRoles[selectedFan.id].map((userRole) => (
                                      <Badge key={userRole.role} variant="outline" className="text-xs">
                                        {userRole.role}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </>
                            )}
                            {selectedFan.bio && (
                              <>
                                <Separator />
                                <div className="py-2">
                                  <span className="text-muted-foreground block mb-2">Bio</span>
                                  <p className="text-sm">{selectedFan.bio}</p>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Subscription Details */}
                        <div>
                          <h3 className="font-semibold mb-3">Subscription Details</h3>
                          <div className="space-y-3">
                            <div className="flex justify-between py-2">
                              <span className="text-muted-foreground">Status</span>
                              <Badge variant="outline" className="text-blue-600">Free</Badge>
                            </div>
                            <Separator />
                            <div className="flex justify-between py-2">
                              <span className="text-muted-foreground">Previous subscription</span>
                              <span className="text-muted-foreground">$0.00</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between py-2">
                              <span className="text-muted-foreground">Started</span>
                              <span>{new Date(selectedFan.created_at).toLocaleDateString()}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between py-2">
                              <span className="text-muted-foreground">Total duration</span>
                              <span>
                                {Math.floor((Date.now() - new Date(selectedFan.created_at).getTime()) / (1000 * 60 * 60 * 24))} days
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </DialogContent>
              </Dialog>
            </>
          )}

          {!loadingFans && fans.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No fans registered yet</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Fans;