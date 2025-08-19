import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUserDeletion } from '@/hooks/useUserDeletion';
import { AlertTriangle, Clock } from 'lucide-react';

interface UserDeletionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName?: string;
  isSelfDeletion?: boolean;
}

export const UserDeletionDialog = ({
  isOpen,
  onClose,
  userId,
  userName,
  isSelfDeletion = false
}: UserDeletionDialogProps) => {
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const { loading, immediatelyDeleteFanUser, initiateUserDeletion } = useUserDeletion();

  const expectedConfirmText = isSelfDeletion ? 'DELETE MY ACCOUNT' : 'DELETE USER';
  const isConfirmed = confirmText === expectedConfirmText;

  const handleSubmit = async () => {
    if (!isConfirmed) return;

    try {
      if (isSelfDeletion) {
        // For self-deletion, use the regular 30-day process
        await initiateUserDeletion(userId, reason, isSelfDeletion);
      } else {
        // For admin deletion of fans, delete immediately
        await immediatelyDeleteFanUser(userId, reason);
      }
      onClose();
      setReason('');
      setConfirmText('');
    } catch (error) {
      // Error is handled in the hook
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {isSelfDeletion ? 'Delete Your Account' : 'Delete User Account'}
          </DialogTitle>
          <DialogDescription>
            {isSelfDeletion 
              ? "This action will initiate the account deletion process. The account will be scheduled for permanent deletion in 30 days."
              : "This action will permanently delete the fan account immediately. This cannot be undone."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {isSelfDeletion && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                    What happens during the 30-day period:
                  </h4>
                  <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                    <li>• Account will be immediately disabled (cannot log in)</li>
                    <li>• All content will be hidden from public view</li>
                    <li>• You cannot interact with the platform</li>
                    <li>• Admins can restore the account if needed</li>
                    <li>• After 30 days, all personal data will be permanently deleted</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {!isSelfDeletion && (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="font-medium text-red-800 dark:text-red-200">
                    Immediate Deletion Warning:
                  </h4>
                  <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                    <li>• User will be permanently deleted immediately</li>
                    <li>• All user data will be completely removed</li>
                    <li>• User will be removed from authentication system</li>
                    <li>• This action cannot be undone</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">
                Reason for deletion {!isSelfDeletion && '(optional)'}
              </Label>
              <Textarea
                id="reason"
                placeholder={isSelfDeletion 
                  ? "Please tell us why you're leaving (optional)" 
                  : "Reason for deleting this user account..."
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="confirm" className="text-destructive">
                Type "{expectedConfirmText}" to confirm
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={expectedConfirmText}
                className="border-destructive focus:border-destructive"
              />
            </div>

            {userName && (
              <p className="text-sm text-muted-foreground">
                {isSelfDeletion 
                  ? 'Your account will be scheduled for deletion'
                  : `User "${userName}" will be permanently deleted immediately`
                }
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!isConfirmed || loading}
          >
            {loading ? 'Processing...' : (isSelfDeletion ? 'Schedule Deletion' : 'Delete Immediately')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};