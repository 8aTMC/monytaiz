import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Check if user needs onboarding when session changes
        if (session?.user) {
          setTimeout(async () => {
            try {
              const { data: profile, error } = await supabase
                .from('profiles')
                .select('signup_completed, username, display_name, temp_username, deletion_status, deleted_at')
                .eq('id', session.user.id)
                .single();
              
              // If profile doesn't exist or user has been deleted, sign out
              if (error || !profile || profile.deletion_status !== 'active' || profile.deleted_at) {
                console.log('User profile deleted or not found, signing out...');
                await supabase.auth.signOut();
                return;
              }
              
              const needsProfileCompletion = profile && (
                !profile.signup_completed || 
                !profile.username || 
                !profile.display_name ||
                profile.temp_username
              );
              
              console.log('🔍 Profile completion check:', {
                signup_completed: profile.signup_completed,
                username: profile.username,
                display_name: profile.display_name,
                temp_username: profile.temp_username,
                needsProfileCompletion
              });
              
              setNeedsOnboarding(!!needsProfileCompletion);
              setCheckingProfile(false);
            } catch (error) {
              console.error('Error checking profile completion:', error);
              // If there's an error accessing the profile, sign out to be safe
              await supabase.auth.signOut();
              setCheckingProfile(false);
            }
          }, 0);
        } else {
          setCheckingProfile(false);
          setNeedsOnboarding(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('signup_completed, username, display_name, temp_username, deletion_status, deleted_at')
            .eq('id', session.user.id)
            .single();
          
          // If profile doesn't exist or user has been deleted, sign out
          if (error || !profile || profile.deletion_status !== 'active' || profile.deleted_at) {
            console.log('User profile deleted or not found, signing out...');
            await supabase.auth.signOut();
            return;
          }
          
          const needsProfileCompletion = profile && (
            !profile.signup_completed || 
            !profile.username || 
            !profile.display_name ||
            profile.temp_username
          );
          
          console.log('🔍 Profile completion check (session check):', {
            signup_completed: profile.signup_completed,
            username: profile.username,
            display_name: profile.display_name,
            temp_username: profile.temp_username,
            needsProfileCompletion
          });
          
          setNeedsOnboarding(!!needsProfileCompletion);
          setCheckingProfile(false);
        } catch (error) {
          console.error('Error checking profile completion:', error);
          // If there's an error accessing the profile, sign out to be safe
          await supabase.auth.signOut();
          setCheckingProfile(false);
        }
      } else {
        setCheckingProfile(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Show loading while checking authentication or profile
  if (loading || checkingProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If no user/session, redirect to auth page
  if (!user || !session) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // If user needs to complete onboarding, redirect to onboarding
  if (needsOnboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // User is authenticated and profile is complete, render the protected content
  return <>{children}</>;
};