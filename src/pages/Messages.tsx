import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { useTranslation } from '@/hooks/useTranslation';
import FanMessages from '@/components/FanMessages';
import { MessagesLayout } from '@/components/MessagesLayout';
import Layout from '@/components/Layout';

const Messages = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFan, setIsFan] = useState(false);
  const [isCreator, setIsCreator] = useState(false);

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

    // Check current session on component mount
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Check if user is a fan
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id);
        
        const roles = rolesData?.map(r => r.role) || [];
        setIsFan(roles.length === 1 && roles.includes('fan'));
        setIsCreator(roles.some(role => ['owner', 'creator', 'superadmin', 'admin'].includes(role)));
      }
      
      setLoading(false);
      
      if (!session?.user) {
        navigate('/');
      }
    };

    checkSession();

    // Cleanup subscription on unmount
    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Fans see a direct chat interface, management users see the full messages page
  if (isFan) {
    return (
      <Layout>
        <FanMessages user={user} />
      </Layout>
    );
  }

  // Creators and management see the full messages layout
  return (
    <Layout>
      <MessagesLayout user={user} isCreator={isCreator} />
    </Layout>
  );
};

export default Messages;