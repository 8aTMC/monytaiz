import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navigation } from '@/components/Navigation';
import { User, Session } from '@supabase/supabase-js';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HardDrive, Recycle, LogOut, Shield, Database, Folder, FolderPlus } from 'lucide-react';
import { useStorageCleanup } from '@/hooks/useStorageCleanup';
import { useFolderRecreation } from '@/hooks/useFolderRecreation';
import { useToast } from '@/hooks/use-toast';
import { ForceLogoutButton } from '@/components/ForceLogoutButton';
import { ThemeToggle } from '@/components/ThemeToggle';

const Admin = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const { toast } = useToast();

  const { 
    optimizeStorage, 
    cleanPhantomFolders, 
    isCleaningUp 
  } = useStorageCleanup();

  const {
    recreateFolders,
    isRecreatingFolders
  } = useFolderRecreation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session?.user) {
          navigate('/');
        } else {
          setLoading(false);
          fetchUserRoles(session.user.id);
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
        fetchUserRoles(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchUserRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error fetching user roles:', error);
      } else {
        const roles = data?.map(item => item.role) || [];
        setUserRoles(roles);
        
        // Check if user has required permissions
        const hasAccess = roles.includes('owner') || roles.includes('superadmin');
        if (!hasAccess) {
          toast({
            title: "Access Denied",
            description: "You don't have permission to access this page.",
            variant: "destructive"
          });
          navigate('/dashboard');
        }
      }
    } catch (error) {
      console.error('Error fetching user roles:', error);
      navigate('/dashboard');
    }
  };

  const handleCleanupCorruptedMedia = async () => {
    try {
      const { data, error } = await supabase.rpc('cleanup_corrupted_media');
      
      if (error) {
        console.error('Database cleanup error:', error);
        toast({
          title: "Cleanup Failed",
          description: error.message,
          variant: "destructive"
        });
      } else {
        console.log('Database cleanup result:', data);
        toast({
          title: "Database Cleaned",
          description: `Successfully cleaned corrupted media records`,
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Database cleanup failed:', error);
      toast({
        title: "Cleanup Error",
        description: "Failed to clean database",
        variant: "destructive"
      });
    }
  };

  const handleCleanPhantomFolders = () => {
    cleanPhantomFolders('content', ['ff395f9e-2cdb-436c-a928-ab82efe24d67', 'photos']);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  // Don't render anything if user doesn't have access (will be redirected)
  const hasAccess = userRoles.includes('owner') || userRoles.includes('superadmin');
  if (!hasAccess) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
              <p className="text-muted-foreground">
                System administration and maintenance tools
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Storage Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Storage Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                onClick={optimizeStorage}
                disabled={isCleaningUp || isRecreatingFolders}
                className="w-full flex items-center gap-2"
              >
                <HardDrive className="h-4 w-4" />
                {isCleaningUp ? 'Optimizing...' : 'Optimize Storage'}
              </Button>
              
              <Button
                variant="outline"
                onClick={handleCleanPhantomFolders}
                disabled={isCleaningUp || isRecreatingFolders}
                className="w-full flex items-center gap-2 bg-orange-50 hover:bg-orange-100 border-orange-200"
              >
                <Folder className="h-4 w-4" />
                {isCleaningUp ? 'Cleaning...' : 'Clean Phantom Folders'}
              </Button>

              <Button
                variant="outline"
                onClick={recreateFolders}
                disabled={isCleaningUp || isRecreatingFolders}
                className="w-full flex items-center gap-2 bg-green-50 hover:bg-green-100 border-green-200"
              >
                <FolderPlus className="h-4 w-4" />
                {isRecreatingFolders ? 'Creating...' : 'Recreate Folders'}
              </Button>
            </CardContent>
          </Card>

          {/* Database Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Database Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                onClick={handleCleanupCorruptedMedia}
                className="w-full flex items-center gap-2"
              >
                <Recycle className="h-4 w-4" />
                Clean Database
              </Button>
            </CardContent>
          </Card>

          {/* System Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                System Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Your Role:</span>
                  <span className="font-medium">
                    {userRoles.includes('owner') ? 'Owner' : 
                     userRoles.includes('superadmin') ? 'Super Admin' : 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">User ID:</span>
                  <span className="font-mono text-xs">{user?.id}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <span className={isCleaningUp || isRecreatingFolders ? 'text-orange-500' : 'text-green-500'}>
                    {isCleaningUp ? 'Cleaning...' : 
                     isRecreatingFolders ? 'Recreating...' : 'Idle'}
                  </span>
                </div>
              </div>
              
              <div className="pt-4 border-t border-border">
                <ForceLogoutButton />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 p-4 bg-muted/50 rounded-lg">
          <h3 className="font-semibold mb-2">⚠️ Important Notes</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Storage optimization should be run regularly to maintain performance</li>
            <li>• Ghost file cleaning removes orphaned records and files</li>
            <li>• Phantom folder cleanup removes empty storage folder references</li>
            <li>• Recreate Folders creates the "incoming" and "processed" folder structure</li>
            <li>• Force operations are irreversible - use with caution</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Admin;