import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { Navigation, useSidebar } from '@/components/Navigation';
import { MyAccount } from '@/components/MyAccount';
import { DeleteAccountSection } from '@/components/DeleteAccountSection';

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { isCollapsed } = useSidebar();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Redirect non-authenticated users to login
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
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

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
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className={`transition-all duration-300 p-6 ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">My Account</h1>
          </div>

          <div className="space-y-8">
            <MyAccount />
            
            {user && (
              <DeleteAccountSection 
                userId={user.id} 
                userName={user.user_metadata?.display_name || user.email} 
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;