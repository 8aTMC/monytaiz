import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ChangeEmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmail: string;
  onEmailChangeInitiated: (newEmail: string) => void;
}

export const ChangeEmailDialog = ({ isOpen, onClose, currentEmail, onEmailChangeInitiated }: ChangeEmailDialogProps) => {
  const [newEmail, setNewEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newEmail || newEmail === currentEmail) {
      toast({
        title: "Invalid Email",
        description: "Please enter a different email address.",
        variant: "destructive"
      });
      return;
    }

    if (!newEmail.includes('@') || !newEmail.includes('.')) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Update the user's email in Supabase Auth
      const { error } = await supabase.auth.updateUser({ 
        email: newEmail 
      });

      if (error) {
        throw error;
      }

      // Store the pending email change in profiles table
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ 
            pending_email: newEmail,
            pending_email_token: `pending_${Date.now()}` // Simple token for demo
          })
          .eq('id', user.id);

        if (profileError) {
          console.error('Error updating profile with pending email:', profileError);
        }
      }

      toast({
        title: "Verification Email Sent",
        description: `A verification email has been sent to ${newEmail}. Please check your inbox and follow the instructions to confirm your new email address.`,
        duration: 5000,
      });

      onEmailChangeInitiated(newEmail);
      onClose();
      setNewEmail('');
    } catch (error: any) {
      console.error('Error initiating email change:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to initiate email change. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setNewEmail('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Change Email Address
          </DialogTitle>
          <DialogDescription>
            Enter your new email address. You'll need to verify it before the change takes effect.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-email">Current Email</Label>
            <Input
              id="current-email"
              type="email"
              value={currentEmail}
              disabled
              className="bg-muted"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="new-email">New Email Address</Label>
            <Input
              id="new-email"
              type="email"
              placeholder="Enter your new email address"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
          </div>

          <DialogFooter className="gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={isSubmitting || !newEmail}
            >
              {isSubmitting ? 'Sending...' : 'Change Email'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};