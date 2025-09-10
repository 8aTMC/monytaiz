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
    console.log('🛡️ ProtectedRoute initializing...');
    
    const checkProfile = async (userId: string) => {
      setCheckingProfile(true);
      try {
        console.log('🔍 Checking profile for user:', userId);
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('signup_completed, username, display_name, temp_username, deletion_status, deleted_at')
          .eq('id', userId)
          .maybeSingle();
        
        if (error) {
          console.error('Profile check error:', error);
          setCheckingProfile(false);
          return;
        }
        
        if (!profile || profile.deletion_status !== 'active' || profile.deleted_at) {
          console.log('❌ Profile deleted or not found, signing out...');
          await supabase.auth.signOut();
          return;
        }
        
        const needsCompletion = !profile.signup_completed || 
                              !profile.username || 
                              !profile.display_name || 
                              profile.temp_username;
        
        console.log('✅ Profile check complete:', { needsCompletion });
        setNeedsOnboarding(needsCompletion);
      } catch (error) {
        console.error('Profile check failed:', error);
      } finally {
        setCheckingProfile(false);
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔄 ProtectedRoute auth change:', event, !!session);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        if (session?.user) {
          checkProfile(session.user.id);
        } else {
          setCheckingProfile(false);
          setNeedsOnboarding(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('🔍 Initial session check:', !!session);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        checkProfile(session.user.id);
      } else {
        setCheckingProfile(false);
      }
    });

    // Failsafe timeout
    const timeout = setTimeout(() => {
      console.warn('⚠️ ProtectedRoute loading timeout');
      setLoading(false);
      setCheckingProfile(false);
    }, 10000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
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