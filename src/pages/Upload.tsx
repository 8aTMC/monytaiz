import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { Navigation, useSidebar } from '@/components/Navigation';
import { AdvancedFileUpload } from '@/components/AdvancedFileUpload';
import { FileFormatInfo } from '@/components/FileFormatInfo';
import { QuickOrphanedDataCleanup } from '@/components/QuickOrphanedDataCleanup';
import { useTranslation } from '@/hooks/useTranslation';

const Upload = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { isCollapsed, isNarrowScreen } = useSidebar();

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
    <div className="p-6 pt-2">
      <div className="max-w-7xl mx-auto min-w-[700px]">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            {t('upload.title', 'Upload Content')}
          </h1>
          <div className="mt-6">
            <FileFormatInfo />
          </div>
        </div>

        <AdvancedFileUpload />

        {/* Orphaned Data Cleanup - for debugging duplicate detection issues */}
        <div className="mt-12">
          <QuickOrphanedDataCleanup />
        </div>
      </div>
    </div>
  );
};

export default Upload;