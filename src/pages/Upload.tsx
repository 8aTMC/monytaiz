import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { Navigation, useSidebar } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload as UploadIcon, Image, Video, FileText } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

const Upload = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Upload Content</h1>
            <p className="text-muted-foreground">Share your content with your fans</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Photo Upload */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="text-center">
                <div className="mx-auto h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Image className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Upload Photos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Share high-quality images with your audience
                </p>
                <Button className="w-full" disabled>
                  <UploadIcon className="h-4 w-4 mr-2" />
                  Coming Soon
                </Button>
              </CardContent>
            </Card>

            {/* Video Upload */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="text-center">
                <div className="mx-auto h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Video className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Upload Videos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Upload engaging video content for your fans
                </p>
                <Button className="w-full" disabled>
                  <UploadIcon className="h-4 w-4 mr-2" />
                  Coming Soon
                </Button>
              </CardContent>
            </Card>

            {/* Document Upload */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="text-center">
                <div className="mx-auto h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Upload Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Share PDFs, documents, and other files
                </p>
                <Button className="w-full" disabled>
                  <UploadIcon className="h-4 w-4 mr-2" />
                  Coming Soon
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Quick Upload Form */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Quick Upload</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Title</label>
                <Input placeholder="Enter content title..." className="mt-1" />
              </div>
              
              <div>
                <label className="text-sm font-medium text-foreground">Description</label>
                <Textarea 
                  placeholder="Describe your content..." 
                  className="mt-1 min-h-[100px]"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">Price</label>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  className="mt-1"
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <UploadIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">Drag and drop files here or click to browse</p>
                <Button variant="outline" disabled>
                  Select Files
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Supported formats: JPG, PNG, MP4, PDF (Max 100MB)
                </p>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" disabled>
                  <UploadIcon className="h-4 w-4 mr-2" />
                  Upload Content
                </Button>
                <Button variant="outline">
                  Save as Draft
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Upload;