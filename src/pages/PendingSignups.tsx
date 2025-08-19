import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navigation, useSidebar } from '@/components/Navigation';
import { User, Session } from '@supabase/supabase-js';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Clock, ArrowLeft, RefreshCw, Users, Trash2, UserCheck } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  signup_completed?: boolean;
  google_verified?: boolean;
  temp_username?: boolean;
  provider?: string;
}

const PendingSignups = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingSignups, setPendingSignups] = useState<Profile[]>([]);
  const [loadingPendingSignups, setLoadingPendingSignups] = useState(true);
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string | null } | null>(null);
  const { isCollapsed, isNarrowScreen } = useSidebar();

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
    const fetchPendingSignups = async () => {
      try {
        console.log('🔍 Starting to fetch pending signups...');
        
        // Get all fan user IDs
        const { data: fanRoles, error: roleError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'fan');

        if (roleError) {
          console.error('❌ Error fetching fan roles:', roleError);
          return;
        }

        if (!fanRoles || fanRoles.length === 0) {
          console.log('⚠️ No fan roles found');
          setPendingSignups([]);
          setLoadingPendingSignups(false);
          return;
        }

        const fanUserIds = fanRoles.map(role => role.user_id);

        // Get profiles that have not completed signup
        const { data, error } = await supabase
          .from('profiles')
          .select('*, email, email_confirmed, signup_completed, google_verified, temp_username, provider')
          .in('id', fanUserIds)
          .eq('signup_completed', false)
          .neq('deletion_status', 'pending_deletion')
          .order('created_at', { ascending: false });

        console.log('👤 Pending signups query result:', { data, error });

        if (error) {
          console.error('❌ Error fetching pending signups:', error);
        } else {
          console.log('✅ Setting pending signups data:', data);
          setPendingSignups(data || []);
        }
      } catch (error) {
        console.error('💥 Exception in fetchPendingSignups:', error);
      } finally {
        setLoadingPendingSignups(false);
      }
    };

    if (user) {
      fetchPendingSignups();
    }
  }, [user]);

  const refreshData = async () => {
    setLoadingPendingSignups(true);
    
    try {
      const { data: fanRoles, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'fan');

      if (roleError || !fanRoles || fanRoles.length === 0) {
        setPendingSignups([]);
        return;
      }

      const fanUserIds = fanRoles.map(role => role.user_id);

      const { data, error } = await supabase
        .from('profiles')
        .select('*, email, email_confirmed, signup_completed, google_verified, temp_username, provider')
        .in('id', fanUserIds)
        .eq('signup_completed', false)
        .neq('deletion_status', 'pending_deletion')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setPendingSignups(data);
      }
    } catch (error) {
      console.error('Error refreshing pending signups:', error);
    } finally {
      setLoadingPendingSignups(false);
    }
  };

  const deletePendingUser = async (userId: string, displayName: string | null) => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-pending-user', {
        body: { userId }
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        toast({
          title: "User Deleted",
          description: `${displayName || 'User'} has been permanently deleted.`,
        });
        
        // Refresh the list
        await refreshData();
      } else {
        throw new Error(data.message || 'Failed to delete user');
      }
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete user. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (userId: string, displayName: string | null) => {
    setUserToDelete({ id: userId, name: displayName });
  };

  const handleDeleteConfirm = async () => {
    if (userToDelete) {
      await deletePendingUser(userToDelete.id, userToDelete.name);
      setUserToDelete(null);
    }
  };

  const markUserAsCompleted = async (userId: string, displayName: string | null) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          signup_completed: true,
          temp_username: false,
        })
        .eq('id', userId);

      if (error) throw error;

      // Sync to auth metadata
      try {
        await supabase.functions.invoke('sync-profile-to-auth', {
          body: {
            userId: userId,
            displayName: displayName,
            username: displayName, // Use display name as fallback
          }
        });
      } catch (syncError) {
        console.warn('Profile sync to auth failed:', syncError);
      }

      toast({
        title: "User Completed",
        description: `${displayName || 'User'} has been marked as completed and moved to the fans section.`,
        variant: "default",
      });

      // Refresh the pending signups list
      refreshData();
    } catch (error: any) {
      console.error('Error marking user as completed:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to mark user as completed. Please try again.",
        variant: "destructive",
      });
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
    <div className={`min-h-screen bg-background ${isNarrowScreen && !isCollapsed ? 'min-w-[calc(100vw+13rem)]' : ''}`}>
      <Navigation />
      
      <main className={`transition-all duration-300 p-8 ${isCollapsed ? 'ml-16' : 'ml-52'} overflow-x-auto`}>
        <div className="max-w-7xl mx-auto min-w-[700px]">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-6">
              <Button
                variant="ghost"
                onClick={() => navigate('/fans')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to All Fans
              </Button>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-primary" />
                <div>
                  <h1 className="text-3xl font-bold text-foreground">Pending Sign Up</h1>
                  <p className="text-muted-foreground mt-1">
                    Users who signed up with Google but haven't completed their profile setup
                  </p>
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={refreshData}
                disabled={loadingPendingSignups}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loadingPendingSignups ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Pending Signups Grid */}
          {loadingPendingSignups ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading pending signups...</p>
            </div>
          ) : pendingSignups.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No Pending Signups</h3>
              <p className="text-muted-foreground">All users have completed their profile setup.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {pendingSignups.map((user) => (
                <Card key={user.id} className="bg-card border-border shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-start space-x-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="bg-muted text-muted-foreground">
                          {user.display_name ? 
                            user.display_name.charAt(0).toUpperCase() : 
                            user.email ? user.email.charAt(0).toUpperCase() : '?'
                          }
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground truncate">
                            {user.display_name || user.username || 'Incomplete Profile'}
                          </h3>
                          {user.temp_username && (
                            <Badge variant="secondary" className="text-xs">
                              Temp
                            </Badge>
                          )}
                        </div>
                        {user.email && (
                          <p className="text-sm text-muted-foreground truncate mb-2">
                            {user.email}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {user.provider === 'google' && (
                            <Badge variant="outline" className="text-xs">
                              Google
                            </Badge>
                          )}
                          {user.email_confirmed && (
                            <Badge variant="outline" className="text-xs text-green-600">
                              Verified
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-xs text-muted-foreground mb-3">
                      <p><strong>Created:</strong> {new Date(user.created_at).toLocaleDateString()}</p>
                      <p><strong>Status:</strong> Waiting for profile completion</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => markUserAsCompleted(user.id, user.display_name)}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                      >
                        <UserCheck className="h-4 w-4 mr-2" />
                        Mark Complete
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteClick(user.id, user.display_name)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={userToDelete !== null} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to permanently delete {userToDelete?.name || 'this user'}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background border-border hover:bg-muted">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PendingSignups;