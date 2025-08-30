import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { OnboardingForm } from '@/components/OnboardingForm';
import { ForceLogoutButton } from '@/components/ForceLogoutButton';

const Onboarding = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Redirect non-authenticated users to auth page
        if (!session?.user) {
          navigate('/');
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (!session?.user) {
        navigate('/');
      } else {
        // Check if user already has a complete profile
        checkProfileStatus(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkProfileStatus = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('username, display_name, signup_completed, temp_username')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error checking profile:', error);
        return;
      }

      // If profile is already complete, redirect to library
      if (profile?.username && profile?.display_name && profile?.signup_completed && !profile?.temp_username) {
        console.log('✅ Profile already complete, redirecting to library');
        navigate('/library');
      }
    } catch (error) {
      console.error('Error checking profile status:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div>
      <div className="absolute top-4 right-4">
        <ForceLogoutButton />
      </div>
      <OnboardingForm 
        userEmail={user.email || ''} 
        userId={user.id}
      />
    </div>
  );
};

export default Onboarding;