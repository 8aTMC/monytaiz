import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AuthForm } from '@/components/AuthForm';
import { User, Session } from '@supabase/supabase-js';

const Auth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Redirect authenticated users
        if (session?.user) {
          // Check if it's a new Google user needing onboarding
          if (event === 'SIGNED_IN' && session.user.app_metadata.provider === 'google') {
            // For Google users, always redirect to onboarding first
            // The onboarding component will check if profile is complete
            setTimeout(() => {
              navigate('/onboarding');
            }, 0);
          } else {
            navigate('/dashboard');
          }
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        navigate('/dashboard');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // If user is already authenticated, don't show auth form
  if (user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-r from-purple-400 via-purple-600 to-black relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-purple-300/20 via-purple-500/30 to-transparent"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/10 to-black/50"></div>
      <div className="w-full max-w-md relative z-10">
        <AuthForm mode={mode} onModeChange={setMode} />
      </div>
    </div>
  );
};

export default Auth;