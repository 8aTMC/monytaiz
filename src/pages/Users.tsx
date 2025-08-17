import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Navigation, useSidebar } from '@/components/Navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { User, Crown, Shield, MessageCircle, Plus } from 'lucide-react';
import CreateUserDialog from '@/components/CreateUserDialog';

interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  is_verified: boolean;
  created_at: string;
  roles: string[];
}

const Users = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const { isCollapsed } = useSidebar();

  const handleCreateUser = () => {
    setCreateUserOpen(true);
  };

  const handleUserCreated = () => {
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

  const usersByRole = users.reduce((acc, user) => {
    user.roles.forEach(role => {
      if (!acc[role]) acc[role] = [];
      acc[role].push(user);
    });
    return acc;
  }, {} as Record<string, UserProfile[]>);

  const roleOrder = ['owner', 'admin', 'moderator', 'chatter', 'creator'];

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
            <div className="mb-4">
              <h1 className="text-lg font-semibold text-foreground">Users</h1>
            </div>
            <Button className="flex items-center gap-2" onClick={handleCreateUser}>
              <Plus className="h-4 w-4" />
              Create User
            </Button>
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
                                <AvatarFallback>
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
        </div>
      </main>
    </div>
  );
};

export default Users;