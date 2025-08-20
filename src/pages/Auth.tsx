import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AuthForm } from '@/components/AuthForm';
import { User, Session } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';

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
        
        // Redirect authenticated users (defer async calls to prevent deadlock)
        if (session?.user) {
          setTimeout(async () => {
            // Check for email verification from URL
            const urlParams = new URLSearchParams(window.location.search);
            const isEmailVerification = urlParams.get('type') === 'signup' || 
                                       urlParams.get('type') === 'email_change' ||
                                       urlParams.get('type') === 'recovery';
            
            // Check if user needs to complete signup
            if (event === 'SIGNED_IN') {
              try {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('signup_completed, username, display_name, provider, google_verified, temp_username, email_confirmed')
                  .eq('id', session.user.id)
                  .single();
                
                console.log('🔍 Profile completion check:', {
                  signup_completed: profile?.signup_completed,
                  username: profile?.username,
                  display_name: profile?.display_name,
                  temp_username: profile?.temp_username,
                  provider: profile?.provider,
                  email_confirmed: profile?.email_confirmed,
                  needsProfileCompletion: profile && profile.provider === 'google' && (!profile.username || !profile.display_name || profile.temp_username === true)
                });

                // Show success message for email verification
                if (profile?.provider === 'email' && isEmailVerification) {
                  toast({
                    title: "✅ Account Activated!",
                    description: "Your email has been verified successfully. Welcome to Monytaiz! 🎉",
                    duration: 3000,
                    className: "bg-green-600 text-white border-none shadow-xl font-semibold opacity-100",
                  });
                }
                
                // Only redirect to onboarding for Google users who need to complete their profile
                // Email users should NEVER see onboarding after email verification
                if (profile && profile.provider === 'google' && (!profile.username || !profile.display_name || profile.temp_username === true)) {
                  navigate('/onboarding');  
                  return;
                }
                
                // If this is an email user and they don't have signup_completed set, fix it
                if (profile && profile.provider === 'email' && profile.signup_completed !== true) {
                  await supabase
                    .from('profiles')
                    .update({ 
                      signup_completed: true,
                      email_confirmed: true 
                    })
                    .eq('id', session.user.id);
                }
              } catch (error) {
                console.error('Error checking profile completion:', error);
              }
            }
            
            // Default redirect to dashboard
            navigate('/dashboard');
          }, 0);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Check for email verification from URL on initial load
        const urlParams = new URLSearchParams(window.location.search);
        const isEmailVerification = urlParams.get('type') === 'signup' || 
                                   urlParams.get('type') === 'email_change' ||
                                   urlParams.get('type') === 'recovery';
        
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('signup_completed, username, display_name, provider, google_verified, temp_username, email_confirmed')
            .eq('id', session.user.id)
            .single();

          // Show success message for email verification on initial load
          if (profile?.provider === 'email' && isEmailVerification) {
            setTimeout(() => {
              toast({
                title: "✅ Account Activated!",
                description: "Your email has been verified successfully. Welcome to Monytaiz! 🎉",
                duration: 3000,
                className: "bg-green-600 text-white border-none shadow-xl font-semibold opacity-100",
              });
            }, 1000); // Delay to ensure dashboard loads first
          }
          
          // Only redirect to onboarding for Google users who need to complete their profile
          // Email users should NEVER see onboarding after email verification
          if (profile && profile.provider === 'google' && (!profile.username || !profile.display_name || profile.temp_username === true)) {
            navigate('/onboarding');  
            return;
          }
          
          // If this is an email user and they don't have signup_completed set, fix it
          if (profile && profile.provider === 'email' && profile.signup_completed !== true) {
            await supabase
              .from('profiles')
              .update({ 
                signup_completed: true,
                email_confirmed: true 
              })
              .eq('id', session.user.id);
          }
        } catch (error) {
          console.error('Error checking profile completion:', error);
        }
        
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
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: 'url(/lovable-uploads/7b2c5fa3-3869-4efc-97dd-928cb31ff437.png)' }}
    >
      <div className="w-full max-w-lg lg:max-w-xl xl:max-w-2xl">
        <AuthForm mode={mode} onModeChange={setMode} />
      </div>
    </div>
  );
};

export default Auth;