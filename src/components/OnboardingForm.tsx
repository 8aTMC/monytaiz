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
      console.log('🚀 STARTING ONBOARDING SUBMISSION');
      console.log('📋 User ID:', userId);
      console.log('📋 Form Data:', {
        username: formData.username.trim(),
        displayName: formData.displayName.trim(),
        bio: formData.bio.trim() || null
      });

      // STEP 1: Update the user profile with detailed logging
      console.log('🔄 Step 1: Updating profile in database...');
      const updatePayload = {
        username: formData.username.trim(),
        display_name: formData.displayName.trim(),
        bio: formData.bio.trim() || null,
        signup_completed: true,
        temp_username: false,
      };
      
      console.log('📤 Database update payload:', updatePayload);

      const { data: updateData, error: updateError } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', userId)
        .select('id, username, display_name, signup_completed, temp_username'); // Get back the updated data

      if (updateError) {
        console.error('❌ PROFILE UPDATE FAILED:', updateError);
        throw new Error(`Database update failed: ${updateError.message}`);
      }

      if (!updateData || updateData.length === 0) {
        console.error('❌ NO DATA RETURNED FROM UPDATE');
        throw new Error('No data returned from database update - user may not exist');
      }

      console.log('✅ Step 1 COMPLETE - Profile updated:', updateData[0]);

      // STEP 2: Verify the update was successful
      console.log('🔄 Step 2: Verifying database update...');
      const { data: verifyData, error: verifyError } = await supabase
        .from('profiles')
        .select('id, signup_completed, temp_username, username, display_name')
        .eq('id', userId)
        .single();

      if (verifyError) {
        console.error('❌ VERIFICATION FAILED:', verifyError);
        throw new Error(`Verification failed: ${verifyError.message}`);
      }

      console.log('🔍 Verification result:', verifyData);

      // CRITICAL CHECK: Ensure the fields were actually updated
      if (!verifyData.signup_completed) {
        console.error('❌ CRITICAL: signup_completed is still false!');
        throw new Error('Database update failed: signup_completed was not set to true');
      }

      if (verifyData.temp_username) {
        console.error('❌ CRITICAL: temp_username is still true!');
        throw new Error('Database update failed: temp_username was not set to false');
      }

      if (!verifyData.username || !verifyData.display_name) {
        console.error('❌ CRITICAL: username or display_name is missing!');
        throw new Error('Database update failed: username or display_name is missing');
      }

      console.log('✅ Step 2 COMPLETE - Verification passed');

      // STEP 3: Sync profile data to auth.users metadata
      console.log('🔄 Step 3: Syncing to auth metadata...');
      try {
        const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-profile-to-auth', {
          body: {
            userId: userId,
            displayName: formData.displayName.trim(),
            username: formData.username.trim(),
          }
        });

        if (syncError) {
          console.warn('⚠️ Auth sync failed (non-blocking):', syncError);
        } else {
          console.log('✅ Step 3 COMPLETE - Auth sync successful:', syncData);
        }
      } catch (syncError) {
        console.warn('⚠️ Auth sync failed (non-blocking):', syncError);
      }

      // STEP 4: Success! Show message and redirect
      console.log('🎉 ONBOARDING COMPLETED SUCCESSFULLY!');
      console.log('🚀 Redirecting to /fans...');

      toast({
        title: "Welcome!",
        description: "Your profile has been set up successfully. You're now an active user!",
      });

      // Small delay to ensure database changes propagate
      setTimeout(() => {
        navigate('/fans');
      }, 500);

    } catch (error: any) {
      console.error('💥 ONBOARDING FAILED:', error);
      
      let errorMessage = error.message;
      
      // Handle specific error cases
      if (error.message?.includes('duplicate key value violates unique constraint') &&
          error.message?.includes('profiles_username_key')) {
        errorMessage = 'This username is already taken. Please choose a different one.';
      } else if (error.message?.includes('unique constraint')) {
        errorMessage = 'This username is already taken. Please choose a different one.';
      }
      
      toast({
        title: "Setup Failed",
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