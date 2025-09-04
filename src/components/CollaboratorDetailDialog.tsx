import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Globe, BarChart3, Image as ImageIcon, Video, DollarSign, ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CollaboratorDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collaborator: {
    id: string;
    name: string;
    url: string;
    description?: string;
    profile_picture_url?: string;
  } | null;
}

interface CollaboratorStats {
  images: {
    count: number;
    revenue: number;
  };
  videos: {
    count: number;
    revenue: number;
  };
}

export function CollaboratorDetailDialog({ 
  open, 
  onOpenChange, 
  collaborator 
}: CollaboratorDetailDialogProps) {
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<CollaboratorStats>({
    images: { count: 0, revenue: 0 },
    videos: { count: 0, revenue: 0 }
  });
  const [loadingStats, setLoadingStats] = useState(false);

  const fetchCollaboratorStats = async () => {
    if (!collaborator) return;
    
    setLoadingStats(true);
    try {
      // Query for media where collaborator is mentioned
      const { data: mediaData, error } = await supabase
        .from('simple_media')
        .select('media_type, revenue_generated_cents')
        .contains('mentions', [collaborator.name]);

      if (error) {
        console.error('Error fetching collaborator stats:', error);
        return;
      }

      // Calculate stats
      const imageStats = { count: 0, revenue: 0 };
      const videoStats = { count: 0, revenue: 0 };

      (mediaData || []).forEach(media => {
        const revenue = (media.revenue_generated_cents || 0) / 100; // Convert cents to dollars
        
        if (media.media_type === 'image') {
          imageStats.count++;
          imageStats.revenue += revenue;
        } else if (media.media_type === 'video') {
          videoStats.count++;
          videoStats.revenue += revenue;
        }
      });

      setStats({
        images: imageStats,
        videos: videoStats
      });
    } catch (error) {
      console.error('Error fetching collaborator stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleStatsClick = () => {
    if (!showStats) {
      fetchCollaboratorStats();
    }
    setShowStats(!showStats);
  };

  // Reset showStats when dialog closes
  useEffect(() => {
    if (!open) {
      setShowStats(false);
    }
  }, [open]);

  if (!collaborator) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-gradient-card border-border/50">
        <DialogHeader className="sr-only">
          <DialogTitle>Collaborator Details</DialogTitle>
          <DialogDescription>
            View collaborator profile and performance statistics
          </DialogDescription>
        </DialogHeader>
        {/* Stats Button - Top Left */}
        <Button
          variant="outline"
          size="sm"
          className="absolute top-4 left-4 z-10"
          onClick={handleStatsClick}
        >
          {showStats ? (
            <>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Profile
            </>
          ) : (
            <>
              <BarChart3 className="h-4 w-4 mr-2" />
              Stats
            </>
          )}
        </Button>

        {/* Flip Container */}
        <div className="relative w-full h-full preserve-3d">
          <div 
            className={`w-full transition-transform duration-700 transform-style-preserve-3d ${
              showStats 
                ? 'animate-fade-out pointer-events-none' 
                : 'animate-fade-in'
            }`}
            style={{ 
              transform: showStats ? 'rotateY(180deg)' : 'rotateY(0deg)',
              display: showStats ? 'none' : 'block'
            }}
          >
            {/* Profile View */}
            <div className="flex flex-col items-center space-y-8 py-8">
              {/* Large Avatar */}
              <div className="relative">
                <Avatar className="h-36 w-36 border-4 border-primary/20 shadow-glow ring-2 ring-primary/10">
                  <AvatarImage 
                    src={collaborator.profile_picture_url} 
                    className="object-cover" 
                  />
                  <AvatarFallback className="text-4xl font-bold bg-gradient-primary text-primary-foreground">
                    {collaborator.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Name */}
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  {collaborator.name}
                </h2>
                <div className="h-px w-16 bg-gradient-primary mx-auto opacity-60" />
              </div>

              {/* URL */}
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="lg"
                  className="px-6 py-3 rounded-md hover:bg-accent/50 transition-colors"
                  onClick={() => window.open(collaborator.url, '_blank')}
                >
                  <Globe className="h-4 w-4 mr-2" />
                  Visit Profile
                </Button>
              </div>

              {/* About Section */}
              {collaborator.description && (
                <div className="w-full space-y-3">
                  <h3 className="text-lg font-semibold text-foreground">About</h3>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {collaborator.description}
                    </p>
                  </div>
                </div>
              )}

              {!collaborator.description && (
                <div className="w-full space-y-3">
                  <h3 className="text-lg font-semibold text-foreground">About</h3>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground italic">
                      No description available
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stats View */}
          <div 
            className={`w-full absolute top-0 transition-transform duration-700 transform-style-preserve-3d ${
              showStats 
                ? 'animate-fade-in' 
                : 'animate-fade-out pointer-events-none'
            }`}
            style={{ 
              transform: showStats ? 'rotateY(0deg)' : 'rotateY(-180deg)',
              display: showStats ? 'block' : 'none'
            }}
          >
            <div className="flex flex-col items-center space-y-8 py-8">
              {/* Stats Header */}
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  {collaborator.name}
                </h2>
                <p className="text-muted-foreground">Performance Statistics</p>
                <div className="h-px w-16 bg-gradient-primary mx-auto opacity-60" />
              </div>

              {loadingStats ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="w-full space-y-6">
                  {/* Images Stats */}
                  <div className="bg-muted/50 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                          <ImageIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">Images</h3>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">{stats.images.count}</p>
                        <p className="text-sm text-muted-foreground">Files Tagged</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <p className="text-2xl font-bold text-green-600">
                            {stats.images.revenue.toFixed(2)}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">Revenue Generated</p>
                      </div>
                    </div>
                  </div>

                  {/* Videos Stats */}
                  <div className="bg-muted/50 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                          <Video className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">Videos</h3>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">{stats.videos.count}</p>
                        <p className="text-sm text-muted-foreground">Files Tagged</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <p className="text-2xl font-bold text-green-600">
                            {stats.videos.revenue.toFixed(2)}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">Revenue Generated</p>
                      </div>
                    </div>
                  </div>

                  {/* Total Summary */}
                  <div className="bg-gradient-primary/10 rounded-lg p-6 border border-primary/20">
                    <h3 className="text-lg font-semibold text-foreground mb-4 text-center">Total Performance</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <p className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                          {stats.images.count + stats.videos.count}
                        </p>
                        <p className="text-sm text-muted-foreground">Total Files</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <DollarSign className="h-5 w-5 text-green-600" />
                          <p className="text-3xl font-bold text-green-600">
                            {(stats.images.revenue + stats.videos.revenue).toFixed(2)}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">Total Revenue</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}