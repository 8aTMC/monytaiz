import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navigation } from '@/components/Navigation';
import { User, Session } from '@supabase/supabase-js';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HardDrive, Recycle, LogOut, Shield, Database, Folder, FolderPlus, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import { useStorageCleanup } from '@/hooks/useStorageCleanup';
import { useFolderRecreation } from '@/hooks/useFolderRecreation';
import { useToast } from '@/hooks/use-toast';
import { ForceLogoutButton } from '@/components/ForceLogoutButton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { OrphanedDataManager } from '@/components/OrphanedDataManager';

const Admin = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [folderCheckLoading, setFolderCheckLoading] = useState(false);
  const [folderCleanupLoading, setFolderCleanupLoading] = useState(false);
  const [folderInconsistencies, setFolderInconsistencies] = useState<any>(null);
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

  const handleCheckFolderInconsistencies = async () => {
    setFolderCheckLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('folder-cleanup', {
        body: { action: 'check_inconsistencies' }
      });

      if (error) throw error;

      setFolderInconsistencies(data.inconsistencies);
      toast({
        title: "Folder Check Complete",
        description: data.message,
        variant: data.inconsistencies.orphaned_collections.length > 0 ? "destructive" : "default"
      });
    } catch (error: any) {
      console.error('Folder check error:', error);
      toast({
        title: "Check Failed",
        description: error.message || "Failed to check folder inconsistencies",
        variant: "destructive"
      });
    } finally {
      setFolderCheckLoading(false);
    }
  };

  const handleCleanupOrphanedCollections = async () => {
    setFolderCleanupLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('folder-cleanup', {
        body: { action: 'cleanup_orphaned_collections' }
      });

      if (error) throw error;

      toast({
        title: "Cleanup Complete",
        description: data.message,
        variant: "default"
      });

      // Refresh the inconsistencies check
      if (folderInconsistencies) {
        handleCheckFolderInconsistencies();
      }
    } catch (error: any) {
      console.error('Folder cleanup error:', error);
      toast({
        title: "Cleanup Failed",
        description: error.message || "Failed to cleanup orphaned collections",
        variant: "destructive"
      });
    } finally {
      setFolderCleanupLoading(false);
    }
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

        {/* Database Cleanup Manager - Primary cleanup tool */}
        <div className="mb-6">
          <OrphanedDataManager />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Storage Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Storage Management
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Optimize physical storage, clean phantom folders, and manage storage structure
              </p>
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
                className="w-full flex items-center gap-2 bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30 text-orange-700 dark:text-orange-300"
              >
                <Folder className="h-4 w-4" />
                {isCleaningUp ? 'Cleaning...' : 'Clean Phantom Folders'}
              </Button>

              <Button
                variant="outline"
                onClick={recreateFolders}
                disabled={isCleaningUp || isRecreatingFolders}
                className="w-full flex items-center gap-2 bg-green-500/10 hover:bg-green-500/20 border-green-500/30 text-green-700 dark:text-green-300"
              >
                <FolderPlus className="h-4 w-4" />
                {isRecreatingFolders ? 'Creating...' : 'Recreate Folders'}
              </Button>
            </CardContent>
          </Card>

          {/* Folder Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Folder className="h-5 w-5" />
                Folder Management
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Check and fix folder consistency issues in the database
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                onClick={handleCheckFolderInconsistencies}
                disabled={folderCheckLoading || folderCleanupLoading}
                className="w-full flex items-center gap-2"
              >
                <AlertTriangle className="h-4 w-4" />
                {folderCheckLoading ? 'Checking...' : 'Check Folder Issues'}
              </Button>

              {folderInconsistencies && (
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    {folderInconsistencies.orphaned_collections.length > 0 ? (
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    <span>
                      {folderInconsistencies.orphaned_collections.length} orphaned collections
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Total: {folderInconsistencies.total_collections} collections, {folderInconsistencies.total_file_folders} file folders
                  </div>
                </div>
              )}

              {folderInconsistencies?.orphaned_collections.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleCleanupOrphanedCollections}
                  disabled={folderCheckLoading || folderCleanupLoading}
                  className="w-full flex items-center gap-2 bg-red-50 hover:bg-red-100 border-red-200 text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  {folderCleanupLoading ? 'Cleaning...' : 'Delete Orphaned Collections'}
                </Button>
              )}
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
            <li>• <strong>Database Cleanup Manager:</strong> Comprehensive scan and cleanup of orphaned database records (recommended for HEIC file issues)</li>
            <li>• <strong>Storage Management:</strong> Optimize storage regularly for performance; phantom folder cleanup removes empty storage references</li>
            <li>• <strong>Folder Management:</strong> Check and fix database folder inconsistencies; recreate folder structure when needed</li>
            <li>• All cleanup operations are irreversible - review scan results before proceeding</li>
            <li>• Run "Scan for Orphaned Data" first to identify issues before cleanup</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Admin;