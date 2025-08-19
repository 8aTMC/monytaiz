import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navigation, useSidebar } from '@/components/Navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { User, Crown, Shield, MessageCircle, Plus, UserX, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import CreateUserDialog from '@/components/CreateUserDialog';
import { UserDeletionDialog } from '@/components/UserDeletionDialog';

interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  is_verified: boolean;
  created_at: string;
  roles: string[];
  email?: string;
  email_confirmed?: boolean;
}

const Users = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [deletionDialogOpen, setDeletionDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const { isCollapsed } = useSidebar();

  const syncEmails = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('sync-management-emails');
      
      if (error) {
        console.error('Error syncing management emails:', error);
        toast({
          title: "Error",
          description: "Failed to sync management emails. Please try again.",
          variant: "destructive",
        });
        return;
      }
      
      console.log('Management email sync result:', data);
      
      toast({
        title: "Success",
        description: data.message || "Management emails synced successfully!",
      });
      
      // Refresh the users list to show updated emails
      await fetchUsers();
      
    } catch (error) {
      console.error('Exception during email sync:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while syncing emails.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = () => {
    setCreateUserOpen(true);
  };

  const handleUserCreated = () => {
    fetchUsers(); // Refresh the users list
  };

  const handleDeleteUser = (user: UserProfile) => {
    setSelectedUser(user);
    setDeletionDialogOpen(true);
  };

  const handleDeletionComplete = () => {
    setDeletionDialogOpen(false);
    setSelectedUser(null);
    fetchUsers(); // Refresh the users list
  };

  const fetchUsers = async () => {
      try {
        console.log('Starting fetchUsers...');
        
        // First check current user authentication
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        console.log('Current session:', session?.user?.id, authError);
        
        // Try a simple query first to test RLS
        const { data: allProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*');
        console.log('All profiles query:', { allProfiles, profilesError });
        
        // Get all users with their roles, excluding fans
        const { data: usersWithRoles, error } = await supabase
          .from('profiles')
          .select(`
            *,
            email,
            email_confirmed,
            user_roles!user_roles_user_id_fkey(role)
          `)
          .not('user_roles.role', 'eq', 'fan');

        console.log('Users with roles query:', { usersWithRoles, error });

        if (error) {
          console.error('Query error:', error);
          throw error;
        }

        // Group roles by user
        const userMap = new Map<string, UserProfile>();
        
        usersWithRoles?.forEach((user: any) => {
          console.log('Processing user:', user);
          const userId = user.id;
          if (!userMap.has(userId)) {
            userMap.set(userId, {
              id: user.id,
              username: user.username,
              display_name: user.display_name,
              avatar_url: user.avatar_url,
              bio: user.bio,
              is_verified: user.is_verified,
              created_at: user.created_at,
              email: user.email,
              email_confirmed: user.email_confirmed,
              roles: []
            });
          }
          // Handle both array and single role cases
          if (user.user_roles) {
            if (Array.isArray(user.user_roles)) {
              user.user_roles.forEach((roleObj: any) => {
                userMap.get(userId)?.roles.push(roleObj.role);
              });
            } else {
              userMap.get(userId)?.roles.push(user.user_roles.role);
            }
          }
        });

        const finalUsers = Array.from(userMap.values());
        console.log('Final users:', finalUsers);
        setUsers(finalUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchUsers();
  }, []);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4" />;
      case 'superadmin':
        return <Crown className="h-4 w-4 text-purple-500" />;
      case 'admin':
        return <Crown className="h-4 w-4" />;
      case 'moderator':
        return <Shield className="h-4 w-4" />;
      case 'chatter':
        return <MessageCircle className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-400 dark:border-purple-800';
      case 'superadmin':
        return 'bg-purple-500/10 text-purple-600 border-purple-200 dark:text-purple-300 dark:border-purple-800';
      case 'admin':
        return 'bg-red-500/10 text-red-700 border-red-200 dark:text-red-400 dark:border-red-800';
      case 'moderator':
        return 'bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-400 dark:border-blue-800';
      case 'chatter':
        return 'bg-green-500/10 text-green-700 border-green-200 dark:text-green-400 dark:border-green-800';
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-200 dark:text-gray-400 dark:border-gray-800';
    }
  };

  const roleOrder = ['owner', 'superadmin', 'admin', 'moderator', 'chatter', 'creator'];

  const usersByRole = users.reduce((acc, user) => {
    user.roles.forEach(role => {
      if (!acc[role]) acc[role] = [];
      acc[role].push(user);
    });
    return acc;
  }, {} as Record<string, UserProfile[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className={`transition-all duration-300 p-6 ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-96" />
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-32" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[1, 2].map(j => (
                        <div key={j} className="flex items-center gap-4">
                          <Skeleton className="h-12 w-12 rounded-full" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className={`transition-all duration-300 p-6 ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Users</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                className="flex items-center gap-1.5"
                onClick={syncEmails}
                disabled={loading}
              >
                <User className="h-3.5 w-3.5" />
                <span>Sync Emails</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="flex items-center gap-1.5"
                onClick={() => navigate('/management/pending-deletions')}
              >
                <UserX className="h-3.5 w-3.5 text-destructive" />
                <span>Pending Deletions</span>
              </Button>
              <Button size="sm" className="flex items-center gap-1.5" onClick={handleCreateUser}>
                <Plus className="h-3.5 w-3.5" />
                Create User
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            {roleOrder.map(role => {
              const roleUsers = usersByRole[role];
              if (!roleUsers || roleUsers.length === 0) return null;

              return (
                <Card key={role}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 capitalize">
                      {getRoleIcon(role)}
                      {role}s {role !== 'owner' && `(${roleUsers.length})`}
                    </CardTitle>
                    <CardDescription>
                      Users with {role} permissions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {roleUsers.map((user, index) => (
                        <div key={user.id}>
                          <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-4">
                              <Avatar className="h-12 w-12">
                                <AvatarImage src={user.avatar_url} />
                                <AvatarFallback className="text-lg font-bold bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
                                  {(() => {
                                    const name = user.display_name || user.username || 'User';
                                    const words = name.trim().split(/\s+/);
                                    if (words.length >= 2) {
                                      return (words[0][0] + words[1][0]).toUpperCase();
                                    } else {
                                      return name.slice(0, 2).toUpperCase();
                                    }
                                  })()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold">
                                    {user.display_name || user.username}
                                  </h3>
                                  {user.is_verified && (
                                    <Badge variant="secondary" className="text-xs">
                                      Verified
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  @{user.username}
                                </p>
                                {user.email && (
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm text-muted-foreground">
                                      {user.email}
                                    </p>
                                    <Badge 
                                      variant={user.email_confirmed ? "default" : "destructive"}
                                      className="text-xs"
                                    >
                                      {user.email_confirmed ? "Verified" : "Not Verified"}
                                    </Badge>
                                  </div>
                                )}
                                {user.bio && (
                                  <p className="text-sm text-muted-foreground max-w-md">
                                    {user.bio}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {user.roles.map(userRole => (
                                <Badge 
                                  key={userRole} 
                                  variant="outline" 
                                  className={getRoleColor(userRole)}
                                >
                                  <span className="flex items-center gap-1">
                                    {getRoleIcon(userRole)}
                                    {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                                  </span>
                                </Badge>
                              ))}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {/* Only show delete option if the user is not an owner and can be deleted */}
                                    {!user.roles.includes('owner') && (
                                      <DropdownMenuItem 
                                        onClick={() => handleDeleteUser(user)}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <UserX className="h-3.5 w-3.5 mr-1.5" />
                                        Delete User
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                          </div>
                          {index < roleUsers.length - 1 && (
                            <Separator className="mt-4" />
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {Object.keys(usersByRole).length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No users found</h3>
                  <p className="text-muted-foreground">
                    No non-fan users are currently registered in the system.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <CreateUserDialog
            open={createUserOpen}
            onOpenChange={setCreateUserOpen}
            onSuccess={handleUserCreated}
          />
          
          {selectedUser && (
            <UserDeletionDialog
              isOpen={deletionDialogOpen}
              onClose={handleDeletionComplete}
              userId={selectedUser.id}
              userName={selectedUser.display_name || selectedUser.username}
              isSelfDeletion={false}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default Users;