import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navigation, useSidebar } from '@/components/Navigation';
import { User, Session } from '@supabase/supabase-js';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { UsernameHistoryDialog } from '@/components/UsernameHistoryDialog';
import { DeleteFanAccountDialog } from '@/components/DeleteFanAccountDialog';
import { useToast } from '@/hooks/use-toast';
import { Users, MoreVertical, Copy, UserMinus, UserX, MessageSquare, FileText, Eye, Shield, Heart, UserCheck, ThumbsUp, Star, Clock, Trash2, User as UserIcon } from 'lucide-react';

interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  created_at: string;
  fan_category: 'husband' | 'boyfriend' | 'supporter' | 'friend' | 'fan';
  deletion_status?: string;
  email?: string;
  email_confirmed?: boolean;
}

interface UserRole {
  role: string;
}

const Fans = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [fans, setFans] = useState<Profile[]>([]);
  const [pendingDeletionFans, setPendingDeletionFans] = useState<Profile[]>([]);
  const [loadingFans, setLoadingFans] = useState(true);
  const [selectedFan, setSelectedFan] = useState<Profile | null>(null);
  const [fanRoles, setFanRoles] = useState<Record<string, UserRole[]>>({});
  const [usernameHistoryDialogOpen, setUsernameHistoryDialogOpen] = useState(false);
  const [selectedFanForHistory, setSelectedFanForHistory] = useState<Profile | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFanForDeletion, setSelectedFanForDeletion] = useState<Profile | null>(null);
  const { isCollapsed } = useSidebar();

  // Emoji mapping for fan categories
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
  
  const categoryFilter = searchParams.get('category') as Profile['fan_category'] | null;

  const syncEmails = async () => {
    try {
      setLoadingFans(true);
      
      const { data, error } = await supabase.functions.invoke('sync-user-emails');
      
      if (error) {
        console.error('Error syncing emails:', error);
        toast({
          title: "Error",
          description: "Failed to sync user emails. Please try again.",
          variant: "destructive",
        });
        return;
      }
      
      console.log('Email sync result:', data);
      
      toast({
        title: "Success",
        description: data.message || "User emails synced successfully!",
      });
      
      // Refresh the fans list to show updated emails
      if (user) {
        const fetchFans = async () => {
          try {
            console.log('🔍 Starting to fetch fans...');
            
            // First get all fan user IDs
            const { data: fanRoles, error: roleError } = await supabase
              .from('user_roles')
              .select('user_id')
              .eq('role', 'fan');

            console.log('🎭 Fan roles query result:', { fanRoles, roleError });

            if (roleError) {
              console.error('❌ Error fetching fan roles:', roleError);
              return;
            }

            if (!fanRoles || fanRoles.length === 0) {
              console.log('⚠️ No fan roles found');
              setFans([]);
              setPendingDeletionFans([]);
              return;
            }

            const fanUserIds = fanRoles.map(role => role.user_id);
            console.log('👥 Fan user IDs:', fanUserIds);

            // Then get the profiles for those users with optional category filter
            let profilesQuery = supabase
              .from('profiles')
              .select('*, email, email_confirmed')
              .in('id', fanUserIds);
            
            // Apply category filter if specified
            if (categoryFilter) {
              profilesQuery = profilesQuery.eq('fan_category', categoryFilter);
            }
            
            const { data, error } = await profilesQuery.order('created_at', { ascending: false });

            console.log('👤 Profiles query result:', { data, error });

            if (error) {
              console.error('❌ Error fetching fan profiles:', error);
            } else {
              console.log('✅ Setting fans data:', data);
              
              // Separate active fans from pending deletion fans
              const activeFans = (data || []).filter(fan => 
                fan.deletion_status !== 'pending_deletion'
              );
              const pendingDeletions = (data || []).filter(fan => 
                fan.deletion_status === 'pending_deletion'
              );
              
              setFans(activeFans);
              setPendingDeletionFans(pendingDeletions);
              
              // Set up roles map for all fans
              if (data) {
                const rolesMap: Record<string, UserRole[]> = {};
                data.forEach((fan) => {
                  rolesMap[fan.id] = [{ role: 'fan' }];
                });
                setFanRoles(rolesMap);
                console.log('🗺️ Fan roles map:', rolesMap);
              }
            }
          } catch (error) {
            console.error('💥 Exception in fetchFans:', error);
          }
        };
        
        await fetchFans();
      }
      
    } catch (error) {
      console.error('Exception during email sync:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while syncing emails.",
        variant: "destructive",
      });
    } finally {
      setLoadingFans(false);
    }
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
    const fetchFans = async () => {
      try {
        console.log('🔍 Starting to fetch fans...');
        
        // First get all fan user IDs
        const { data: fanRoles, error: roleError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'fan');

        console.log('🎭 Fan roles query result:', { fanRoles, roleError });

        if (roleError) {
          console.error('❌ Error fetching fan roles:', roleError);
          return;
        }

        if (!fanRoles || fanRoles.length === 0) {
          console.log('⚠️ No fan roles found');
          setFans([]);
          setPendingDeletionFans([]);
          setLoadingFans(false);
          return;
        }

        const fanUserIds = fanRoles.map(role => role.user_id);
        console.log('👥 Fan user IDs:', fanUserIds);

        // Then get the profiles for those users with optional category filter
        let profilesQuery = supabase
          .from('profiles')
          .select('*, email, email_confirmed')
          .in('id', fanUserIds);
        
        // Apply category filter if specified
        if (categoryFilter) {
          profilesQuery = profilesQuery.eq('fan_category', categoryFilter);
        }
        
        const { data, error } = await profilesQuery.order('created_at', { ascending: false });

        console.log('👤 Profiles query result:', { data, error });

        if (error) {
          console.error('❌ Error fetching fan profiles:', error);
        } else {
          console.log('✅ Setting fans data:', data);
          
          // Separate active fans from pending deletion fans
          const activeFans = (data || []).filter(fan => 
            fan.deletion_status !== 'pending_deletion'
          );
          const pendingDeletions = (data || []).filter(fan => 
            fan.deletion_status === 'pending_deletion'
          );
          
          setFans(activeFans);
          setPendingDeletionFans(pendingDeletions);
          
          // Set up roles map for all fans
          if (data) {
            const rolesMap: Record<string, UserRole[]> = {};
            data.forEach((fan) => {
              rolesMap[fan.id] = [{ role: 'fan' }];
            });
            setFanRoles(rolesMap);
            console.log('🗺️ Fan roles map:', rolesMap);
          }
        }
      } catch (error) {
        console.error('💥 Exception in fetchFans:', error);
      } finally {
        setLoadingFans(false);
      }
    };

    if (user) {
      fetchFans();
    }
  }, [user, categoryFilter]);

  const handleFanClick = (fan: Profile) => {
    setSelectedFan(fan);
  };

  const handleMenuAction = (action: string, fan: Profile) => {
    console.log(`${action} action for user:`, fan.id);
    // Here you would implement the actual actions
  };

  const handleDeleteSuccess = () => {
    // Refresh the fans list after successful deletion
    if (user) {
      const fetchFans = async () => {
        try {
          const { data: fanRoles, error: roleError } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'fan');

          if (roleError || !fanRoles || fanRoles.length === 0) {
            setFans([]);
            setPendingDeletionFans([]);
            return;
          }

          const fanUserIds = fanRoles.map(role => role.user_id);
          let profilesQuery = supabase
            .from('profiles')
            .select('*, email, email_confirmed')
            .in('id', fanUserIds);
          
          if (categoryFilter) {
            profilesQuery = profilesQuery.eq('fan_category', categoryFilter);
          }
          
          const { data, error } = await profilesQuery.order('created_at', { ascending: false });

          if (!error && data) {
            // Separate active fans from pending deletion fans
            const activeFans = data.filter(fan => 
              fan.deletion_status !== 'pending_deletion'
            );
            const pendingDeletions = data.filter(fan => 
              fan.deletion_status === 'pending_deletion'
            );
            
            setFans(activeFans);
            setPendingDeletionFans(pendingDeletions);
          }
        } catch (error) {
          console.error('Error refreshing fans:', error);
        }
      };
      
      fetchFans();
    }
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
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                {categoryFilter ? (
                  categoryFilter === 'husband' ? <Heart className="h-8 w-8 text-primary" /> :
                  categoryFilter === 'boyfriend' ? <UserCheck className="h-8 w-8 text-primary" /> :
                  categoryFilter === 'supporter' ? <Star className="h-8 w-8 text-primary" /> :
                  categoryFilter === 'friend' ? <ThumbsUp className="h-8 w-8 text-primary" /> :
                  <Users className="h-8 w-8 text-primary" />
                ) : (
                  <Users className="h-8 w-8 text-primary" />
                )}
                <h1 className="text-3xl font-bold text-foreground">
                  {categoryFilter 
                    ? `${categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1)}${categoryFilter === 'fan' ? 's' : categoryFilter.endsWith('s') ? '' : 's'}`
                    : 'All Fans'
                  }
                </h1>
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-1.5"
                  onClick={syncEmails}
                  disabled={loadingFans}
                >
                  <UserIcon className="h-3.5 w-3.5" />
                  <span>Sync Emails</span>
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1.5"
                  onClick={() => navigate('/fan-deletions')}
                >
                  <UserX className="h-3.5 w-3.5 text-destructive" />
                  <span>Pending Deletions</span>
                  {pendingDeletionFans.length > 0 && (
                    <Badge variant="destructive" className="ml-1 text-xs">
                      {pendingDeletionFans.length}
                    </Badge>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Fans Grid */}
          {loadingFans ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading fans...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                 {fans.map((fan) => (
                   <Card key={fan.id} className="bg-card border-border shadow-sm hover:shadow-md transition-all cursor-pointer group">
                     <CardHeader className="pb-3">
                       <div className="flex items-start justify-between">
                         <div className="flex items-start space-x-3 flex-1 min-w-0" onClick={() => handleFanClick(fan)}>
                           <Avatar className="h-12 w-12">
                             <AvatarImage src={fan.avatar_url || undefined} />
                             <AvatarFallback className="text-sm font-medium bg-muted text-muted-foreground">
                               {(() => {
                                 const name = fan.display_name || fan.username || 'User';
                                 const words = name.trim().split(/\s+/);
                                 if (words.length >= 2) {
                                   return (words[0][0] + words[1][0]).toUpperCase();
                                 } else {
                                   return name.slice(0, 2).toUpperCase();
                                 }
                               })()}
                             </AvatarFallback>
                           </Avatar>
                           <div className="flex-1 min-w-0">
                             <div className="flex items-center justify-between mb-1">
                               <CardTitle className="text-foreground truncate text-lg font-semibold">
                                 {fan.display_name || fan.username || 'Anonymous'}
                               </CardTitle>
                               {fan.is_verified && (
                                 <Badge variant="secondary" className="ml-2">
                                   Verified
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
                              <DropdownMenuItem onClick={() => {
                                setSelectedFanForHistory(fan);
                                setUsernameHistoryDialogOpen(true);
                              }}>
                                <Clock className="h-3.5 w-3.5 mr-1.5" />
                                Past Usernames
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleMenuAction('restrict', fan)}>
                                <Shield className="h-3.5 w-3.5 mr-1.5" />
                                Restrict
                              </DropdownMenuItem>
                               <DropdownMenuItem onClick={() => handleMenuAction('block', fan)} className="text-destructive">
                                 <UserX className="h-3.5 w-3.5 mr-1.5" />
                                 Block
                               </DropdownMenuItem>
                               <DropdownMenuSeparator />
                               <DropdownMenuItem 
                                 onClick={() => {
                                   setSelectedFanForDeletion(fan);
                                   setDeleteDialogOpen(true);
                                 }}
                                 className="text-destructive"
                               >
                                 <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                 Delete Account
                               </DropdownMenuItem>
                             </DropdownMenuContent>
                           </DropdownMenu>
                       </div>
                     </CardHeader>
                     <CardContent onClick={() => handleFanClick(fan)}>
                       <div className="space-y-3">
                         {fan.bio && (
                           <p className="text-sm text-muted-foreground line-clamp-2">
                             {fan.bio}
                           </p>
                         )}
                         <div className="flex items-center justify-between text-xs text-muted-foreground">
                           <span>
                             Joined {new Date(fan.created_at).toLocaleDateString('en-US', { 
                               month: 'short', 
                               day: 'numeric',
                               year: 'numeric'
                             })}
                           </span>
                         </div>
                       </div>
                     </CardContent>
                   </Card>
                 ))}
               </div>
               
               {fans.length === 0 && pendingDeletionFans.length === 0 && !loadingFans && (
                 <div className="col-span-full text-center py-12">
                   <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                   <h3 className="text-lg font-semibold text-foreground mb-2">No fans found</h3>
                   <p className="text-muted-foreground">
                     {categoryFilter 
                       ? `No fans found in the ${categoryFilter} category.`
                       : 'No fans have joined yet.'
                     }
                   </p>
                 </div>
               )}
              {/* User Details Modal */}
              <Dialog open={!!selectedFan} onOpenChange={() => setSelectedFan(null)}>
                <DialogContent className="max-w-2xl">
                  {selectedFan && (
                    <>
                      <DialogHeader>
                        <div className="flex items-center space-x-4">
                          <Avatar className="h-16 w-16">
                            <AvatarImage src={selectedFan.avatar_url || undefined} />
                            <AvatarFallback className="text-xl font-bold bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
                              {(() => {
                                const name = selectedFan.display_name || selectedFan.username || 'User';
                                const words = name.trim().split(/\s+/);
                                if (words.length >= 2) {
                                  return (words[0][0] + words[1][0]).toUpperCase();
                                } else {
                                  return name.slice(0, 2).toUpperCase();
                                }
                              })()}
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
                              <span className="text-muted-foreground">Email</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{selectedFan.email || 'Not available'}</span>
                                {selectedFan.email && (
                                  <div className="flex items-center gap-2">
                                    <Badge 
                                      variant={selectedFan.email_confirmed ? "default" : "destructive"}
                                      className="text-xs"
                                    >
                                      {selectedFan.email_confirmed ? "Verified" : "Not Verified"}
                                    </Badge>
                                    {!selectedFan.email_confirmed && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 px-2 text-xs"
                                        onClick={async () => {
                                          try {
                                            const { data, error } = await supabase.functions.invoke('verify-user-email', {
                                              body: { user_id: selectedFan.id }
                                            });
                                            
                                            if (error) {
                                              console.error('Error verifying email:', error);
                                              toast({
                                                title: "Error",
                                                description: "Failed to verify email. Please try again.",
                                                variant: "destructive",
                                              });
                                              return;
                                            }
                                            
                                            toast({
                                              title: "Success",
                                              description: "Email verified successfully!",
                                            });
                                            
                                            // Update the selected fan data to reflect the change
                                            setSelectedFan(prev => prev ? { ...prev, email_confirmed: true } : null);
                                            
                                            // Refresh the fans list
                                            if (user) {
                                              const fetchFans = async () => {
                                                try {
                                                  const { data: fanRoles, error: roleError } = await supabase
                                                    .from('user_roles')
                                                    .select('user_id')
                                                    .eq('role', 'fan');

                                                  if (roleError || !fanRoles || fanRoles.length === 0) {
                                                    setFans([]);
                                                    setPendingDeletionFans([]);
                                                    return;
                                                  }

                                                  const fanUserIds = fanRoles.map(role => role.user_id);
                                                  let profilesQuery = supabase
                                                    .from('profiles')
                                                    .select('*, email, email_confirmed')
                                                    .in('id', fanUserIds);
                                                  
                                                  if (categoryFilter) {
                                                    profilesQuery = profilesQuery.eq('fan_category', categoryFilter);
                                                  }
                                                  
                                                  const { data, error } = await profilesQuery.order('created_at', { ascending: false });

                                                  if (!error && data) {
                                                    const activeFans = data.filter(fan => 
                                                      fan.deletion_status !== 'pending_deletion'
                                                    );
                                                    const pendingDeletions = data.filter(fan => 
                                                      fan.deletion_status === 'pending_deletion'
                                                    );
                                                    
                                                    setFans(activeFans);
                                                    setPendingDeletionFans(pendingDeletions);
                                                  }
                                                } catch (error) {
                                                  console.error('Error refreshing fans:', error);
                                                }
                                              };
                                              
                                              await fetchFans();
                                            }
                                            
                                          } catch (error) {
                                            console.error('Exception during email verification:', error);
                                            toast({
                                              title: "Error",
                                              description: "An unexpected error occurred.",
                                              variant: "destructive",
                                            });
                                          }
                                        }}
                                      >
                                        Verify
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
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
                            <div className="flex justify-between py-2">
                              <span className="text-muted-foreground">Category</span>
                              <Badge variant="outline" className="text-xs">
                                {selectedFan.fan_category && getCategoryDisplay(selectedFan.fan_category)}
                              </Badge>
                            </div>
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
        </div>
      </main>

      {/* Username History Dialog */}
      <UsernameHistoryDialog
        open={usernameHistoryDialogOpen}
        onOpenChange={setUsernameHistoryDialogOpen}
        userId={selectedFanForHistory?.id || ''}
        currentUsername={selectedFanForHistory?.username || ''}
      />

      {/* Delete Fan Account Dialog */}
      <DeleteFanAccountDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        fan={selectedFanForDeletion}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
};

export default Fans;