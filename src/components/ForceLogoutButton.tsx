import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/AuthProvider';
import { LogOut, AlertTriangle } from 'lucide-react';

export const ForceLogoutButton = () => {
  const { forceSignOut } = useAuth();

  const handleForceLogout = async () => {
    console.log('Force logout initiated by user...');
    await forceSignOut();
  };

  return (
    <Button 
      variant="destructive" 
      size="sm" 
      onClick={handleForceLogout}
      className="flex items-center gap-2"
    >
      <AlertTriangle className="h-4 w-4" />
      <LogOut className="h-4 w-4" />
      Force Logout
    </Button>
  );
};