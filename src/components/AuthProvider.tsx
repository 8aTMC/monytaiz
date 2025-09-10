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
    console.log('🚀 AuthProvider initializing...');
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔄 Auth state change:', event, session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Simple initialization with timeout
    const initializeAuth = async () => {
      try {
        console.log('🔍 Getting initial session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.warn('Session error:', error);
          setSession(null);
          setUser(null);
        } else {
          console.log('✅ Got session:', !!session);
          setSession(session);
          setUser(session?.user ?? null);
        }
      } catch (error) {
        console.error('Auth init error:', error);
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Loading timeout failsafe
    const timeout = setTimeout(() => {
      console.warn('⚠️ Auth loading timeout - forcing completion');
      setLoading(false);
    }, 5000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      console.log('Attempting to sign out...');
      
      // Clear local state immediately
      setSession(null);
      setUser(null);
      
      // Comprehensive auth data cleanup
      const authKeys = [
        'supabase.auth.token',
        'sb-alzyzfjzwvofmjccirjq-auth-token',
        'supabase.auth.refresh_token',
        'sb-alzyzfjzwvofmjccirjq-auth-token-code-verifier'
      ];
      
      authKeys.forEach(key => localStorage.removeItem(key));
      sessionStorage.clear();
      
      // Attempt graceful server sign out with timeout
      const signOutPromise = supabase.auth.signOut();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Sign out timeout')), 5000)
      );
      
      try {
        await Promise.race([signOutPromise, timeoutPromise]);
      } catch (error) {
        console.warn('Server signOut failed or timed out:', error);
        // Force local cleanup
        await supabase.auth.signOut({ scope: 'local' });
      }
      
      console.log('Sign out completed');
      
      // Redirect immediately
      window.location.href = '/';
      
    } catch (error) {
      console.error('Critical signOut error:', error);
      
      // Emergency cleanup
      setSession(null);
      setUser(null);
      localStorage.clear();
      sessionStorage.clear();
      
      // Still redirect
      window.location.href = '/';
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