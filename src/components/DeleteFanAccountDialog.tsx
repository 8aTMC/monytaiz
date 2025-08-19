import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DeleteFanAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fan: {
    id: string;
    username: string | null;
    display_name: string | null;
  } | null;
  onSuccess: () => void;
}

export function DeleteFanAccountDialog({ 
  open, 
  onOpenChange, 
  fan,
  onSuccess 
}: DeleteFanAccountDialogProps) {
  const [step, setStep] = useState<'confirm' | 'username'>('confirm');
  const [usernameInput, setUsernameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleClose = () => {
    setStep('confirm');
    setUsernameInput('');
    onOpenChange(false);
  };

  const handleConfirm = () => {
    setStep('username');
  };

  const handleDelete = async () => {
    if (!fan) return;

    const expectedUsername = fan.username || fan.display_name || 'Anonymous';
    
    if (usernameInput !== expectedUsername) {
      toast({
        title: "Username doesn't match",
        description: "Please enter the exact username to confirm deletion.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      // Call the user deletion function
      const { data, error } = await supabase.rpc('initiate_user_deletion', {
        target_user_id: fan.id,
        deletion_reason: 'Account deleted by admin',
        is_self_delete: false
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Account deletion initiated",
        description: "The fan account has been scheduled for deletion.",
      });

      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: "Error",
        description: "Failed to delete account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!fan) return null;

  const displayName = fan.display_name || fan.username || 'Anonymous';
  const usernameToConfirm = fan.username || fan.display_name || 'Anonymous';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Account
          </DialogTitle>
        </DialogHeader>

        {step === 'confirm' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Permanently delete <strong>{displayName}'s</strong> account and all associated data. 
              This action cannot be undone immediately - there is a 30-day grace period before permanent deletion.
            </p>

            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-orange-800 dark:text-orange-200">
                    What happens when you delete this account:
                  </p>
                  <ul className="space-y-1 text-orange-700 dark:text-orange-300">
                    <li>• The account will be immediately disabled</li>
                    <li>• All content will be hidden from public view</li>
                    <li>• User will not be able to log in or use the platform</li>
                    <li>• After 30 days, all personal data will be permanently deleted</li>
                    <li>• During the 30-day period, admins may restore the account if requested</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button 
                variant="outline" 
                onClick={handleClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleConfirm}
                className="flex-1"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 'username' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              To confirm deletion, please type the username: <strong>{usernameToConfirm}</strong>
            </p>

            <div className="space-y-2">
              <Label htmlFor="username-confirm">Username confirmation</Label>
              <Input
                id="username-confirm"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder={`Type "${usernameToConfirm}" to confirm`}
                className="font-mono"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setStep('confirm')}
                className="flex-1"
                disabled={loading}
              >
                Back
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDelete}
                className="flex-1"
                disabled={loading || usernameInput !== usernameToConfirm}
              >
                {loading ? "Deleting..." : "Delete Account"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}