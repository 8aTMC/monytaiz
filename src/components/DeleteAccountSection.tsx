import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserDeletionDialog } from '@/components/UserDeletionDialog';
import { useUserDeletion } from '@/hooks/useUserDeletion';
import { AlertTriangle, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DeleteAccountSectionProps {
  userId: string;
  userName?: string;
}

export const DeleteAccountSection = ({ userId, userName }: DeleteAccountSectionProps) => {
  const [deletionDialogOpen, setDeletionDialogOpen] = useState(false);
  const [deletionStatus, setDeletionStatus] = useState<any>(null);
  const { checkUserDeletionStatus } = useUserDeletion();

  useState(() => {
    const checkStatus = async () => {
      const status = await checkUserDeletionStatus(userId);
      setDeletionStatus(status);
    };
    checkStatus();
  });

  const handleDeleteAccount = () => {
    setDeletionDialogOpen(true);
  };

  const handleDeletionComplete = async () => {
    setDeletionDialogOpen(false);
    // Sign out the user since their account is now pending deletion
    await supabase.auth.signOut();
  };

  // Don't show the delete section if account is already pending deletion or deleted
  if (deletionStatus?.deletion_status === 'pending_deletion' || deletionStatus?.deletion_status === 'deleted') {
    return null;
  }

  return (
    <Card className="border-destructive/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Delete Account
        </CardTitle>
        <CardDescription>
          Permanently delete your account and all associated data. This action cannot be undone 
          immediately - there is a 30-day grace period before permanent deletion.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-2">
              <h4 className="font-medium text-amber-800 dark:text-amber-200">
                What happens when you delete your account:
              </h4>
              <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                <li>• Your account will be immediately disabled</li>
                <li>• All your content will be hidden from public view</li>
                <li>• You will not be able to log in or use the platform</li>
                <li>• After 30 days, all your personal data will be permanently deleted</li>
                <li>• During the 30-day period, admins may restore your account if requested</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button 
            variant="destructive" 
            onClick={handleDeleteAccount}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Delete My Account
          </Button>
        </div>

        <UserDeletionDialog
          isOpen={deletionDialogOpen}
          onClose={handleDeletionComplete}
          userId={userId}
          userName={userName}
          isSelfDeletion={true}
        />
      </CardContent>
    </Card>
  );
};