import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, X } from 'lucide-react';

interface OnboardingFormProps {
  userEmail: string;
  userId: string;
}

export const OnboardingForm = ({ userEmail, userId }: OnboardingFormProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    bio: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username.trim() || !formData.displayName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both username and display name",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Update the user profile
      const { error } = await supabase
        .from('profiles')
        .update({
          username: formData.username.trim(),
          display_name: formData.displayName.trim(),
          bio: formData.bio.trim() || null,
          signup_completed: true,
          temp_username: false,
        })
        .eq('id', userId);

      if (error) throw error;

      // Sync profile data to auth.users metadata
      try {
        await supabase.functions.invoke('sync-profile-to-auth', {
          body: {
            userId: userId,
            displayName: formData.displayName.trim(),
            username: formData.username.trim(),
          }
        });
      } catch (syncError) {
        console.warn('Profile sync to auth failed:', syncError);
        // Don't block the flow if sync fails
      }

      toast({
        title: "Welcome!",
        description: "Your profile has been set up successfully",
      });

      navigate('/fans');
    } catch (error: any) {
      let errorMessage = error.message;
      
      // Handle specific error cases
      if (error.message?.includes('duplicate key value violates unique constraint') &&
          error.message?.includes('profiles_username_key')) {
        errorMessage = t('platform.validation.usernameExists');
      } else if (error.message?.includes('unique constraint')) {
        errorMessage = t('platform.validation.usernameExists');
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      // Delete the user account since they're canceling onboarding
      const { error } = await supabase.auth.admin.deleteUser(userId);
      
      if (error) {
        console.error('Error deleting user:', error);
      }

      // Sign out the user
      await supabase.auth.signOut();
      
      toast({
        title: "Setup Cancelled",
        description: "Your account has been cancelled",
      });

      navigate('/');
    } catch (error: any) {
      console.error('Error during cancellation:', error);
      // Still sign out even if deletion fails
      await supabase.auth.signOut();
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card/90 backdrop-blur-sm border-border shadow-lg">
        <CardHeader className="space-y-1 relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            className="absolute right-0 top-0 h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
          <CardTitle className="text-2xl font-bold text-center text-foreground">
            Complete Your Profile
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Let's set up your account with a few details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                value={userEmail}
                disabled
                className="bg-muted text-muted-foreground cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username" className="text-foreground">
                Username <span className="text-destructive">*</span>
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                className="bg-background/50 border-border focus:border-primary"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-foreground">
                Display Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Enter your display name"
                value={formData.displayName}
                onChange={(e) => handleInputChange('displayName', e.target.value)}
                className="bg-background/50 border-border focus:border-primary"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio" className="text-foreground">Bio (Optional)</Label>
              <Textarea
                id="bio"
                placeholder="Tell us about yourself..."
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                className="bg-background/50 border-border focus:border-primary min-h-[80px]"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up...
                </>
              ) : (
                'Complete Setup'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};