import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  forceSignOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
  forceSignOut: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.id);
        
        // Handle session expiry or invalid sessions
        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          setSession(session);
          setUser(session?.user ?? null);
        } else if (event === 'SIGNED_IN') {
          setSession(session);
          setUser(session?.user ?? null);
        } else {
          // For other events, validate the session
          if (session) {
            try {
              // Test if the session is valid by making a simple API call
              const { error } = await supabase.auth.getUser();
              if (error) {
                console.warn('Invalid session detected, clearing auth state');
                // Clear invalid session locally
                setSession(null);
                setUser(null);
                // Force sign out to clean up any lingering session data
                await supabase.auth.signOut({ scope: 'local' });
              } else {
                setSession(session);
                setUser(session?.user ?? null);
              }
            } catch (error) {
              console.error('Session validation error:', error);
              setSession(null);
              setUser(null);
              await supabase.auth.signOut({ scope: 'local' });
            }
          } else {
            setSession(null);
            setUser(null);
          }
        }
        setLoading(false);
      }
    );

    // Check for existing session with validation
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.warn('Session error on init:', error);
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }
        
        if (session) {
          // Validate the session by testing it
          const { error: userError } = await supabase.auth.getUser();
          if (userError) {
            console.warn('Invalid session on init, clearing');
            await supabase.auth.signOut({ scope: 'local' });
            setSession(null);
            setUser(null);
          } else {
            setSession(session);
            setUser(session.user);
          }
        } else {
          setSession(null);
          setUser(null);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      console.log('Attempting to sign out...');
      
      // First try normal sign out
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.warn('Server signOut failed:', error);
        // If server sign out fails, force local cleanup
        await supabase.auth.signOut({ scope: 'local' });
      }
      
      // Force clear local state regardless of server response
      setSession(null);
      setUser(null);
      
      // Clear any cached auth data
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.clear();
      
      console.log('Sign out completed');
      
      // Redirect to home page after a short delay
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
      
    } catch (error) {
      console.error('Error during signOut:', error);
      
      // Force clear everything even if there's an error
      setSession(null);
      setUser(null);
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.clear();
      
      // Still redirect to clear the state
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
    }
  };

  const forceSignOut = async () => {
    console.log('Force signing out...');
    
    // Immediately clear local state
    setSession(null);
    setUser(null);
    
    // Clear all auth-related storage
    localStorage.removeItem('supabase.auth.token');
    localStorage.removeItem('sb-alzyzfjzwvofmjccirjq-auth-token');
    sessionStorage.clear();
    
    // Try to sign out from server (but don't wait for it)
    supabase.auth.signOut({ scope: 'local' }).catch(() => {
      // Ignore any errors
    });
    
    // Redirect immediately
    window.location.href = '/';
  };

  const value = {
    user,
    session,
    loading,
    signOut,
    forceSignOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};