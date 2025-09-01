import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QualitySelector } from './QualitySelector';
import { Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react';

interface MediaPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    title: string | null;
    media_type: 'image' | 'video' | 'audio';
    processed_path?: string;
    thumbnail_path?: string;
    original_size_bytes: number;
    optimized_size_bytes?: number;
    width?: number;
    height?: number;
    mime_type: string;
  };
  isAdmin?: boolean;
}

export const MediaPreview = ({ 
  open, 
  onOpenChange, 
  item, 
  isAdmin = false 
}: MediaPreviewProps) => {
  const [currentQuality, setCurrentQuality] = useState('480p');
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Generate quality URLs based on processed path
  const getQualityUrls = () => {
    if (!item.processed_path || item.media_type !== 'video') return {};
    
    const basePath = item.processed_path.replace(/\.(webm|mp4)$/, '');
    return {
      '480p': `${basePath}_480p.webm`,
      '720p': `${basePath}_720p.webm`,
      '1080p': `${basePath}_1080p.webm`
    };
  };

  const qualityUrls = getQualityUrls();
  
  useEffect(() => {
    if (item.media_type === 'video' && qualityUrls[currentQuality as keyof typeof qualityUrls]) {
      setCurrentUrl(qualityUrls[currentQuality as keyof typeof qualityUrls]);
    } else if (item.processed_path) {
      setCurrentUrl(item.processed_path);
    }
  }, [currentQuality, item.processed_path, item.media_type, qualityUrls]);

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const compressionRatio = item.optimized_size_bytes 
    ? Math.round(((item.original_size_bytes - item.optimized_size_bytes) / item.original_size_bytes) * 100)
    : 0;

  const togglePlayback = () => {
    const video = document.querySelector('video');
    if (video) {
      if (isPlaying) {
        video.pause();
      } else {
        video.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    const video = document.querySelector('video');
    if (video) {
      video.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    const videoContainer = document.querySelector('.video-container');
    if (videoContainer) {
      if (!isFullscreen) {
        videoContainer.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
      setIsFullscreen(!isFullscreen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{item.title || 'Untitled'}</span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {item.media_type}
              </Badge>
              {compressionRatio > 0 && (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  {compressionRatio}% compressed
                </Badge>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Quality Selector for Videos */}
          {isAdmin && item.media_type === 'video' && Object.keys(qualityUrls).length > 0 && (
            <QualitySelector
              qualities={qualityUrls}
              currentQuality={currentQuality}
              onQualityChange={setCurrentQuality}
              className="justify-center"
            />
          )}

          {/* Media Display */}
          <div className="relative bg-muted rounded-lg overflow-hidden">
            {item.media_type === 'image' && currentUrl && (
              <img
                src={currentUrl}
                alt={item.title || 'Media preview'}
                className="w-full h-auto max-h-[60vh] object-contain"
                loading="lazy"
              />
            )}

            {item.media_type === 'video' && currentUrl && (
              <div className="video-container relative">
                <video
                  src={currentUrl}
                  className="w-full h-auto max-h-[60vh] object-contain"
                  controls={false}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onVolumeChange={(e) => setIsMuted(e.currentTarget.muted)}
                >
                  Your browser does not support video playback.
                </video>
                
                {/* Custom Video Controls */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={togglePlayback}
                        className="text-white hover:bg-white/20"
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleMute}
                        className="text-white hover:bg-white/20"
                      >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </Button>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleFullscreen}
                      className="text-white hover:bg-white/20"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {item.media_type === 'audio' && currentUrl && (
              <div className="p-8 text-center">
                <audio
                  src={currentUrl}
                  controls
                  className="w-full max-w-md mx-auto"
                >
                  Your browser does not support audio playback.
                </audio>
              </div>
            )}
          </div>

          {/* File Information */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <span className="text-sm font-medium text-muted-foreground">Type</span>
              <p className="text-sm capitalize">{item.media_type} • {item.mime_type}</p>
            </div>
            
            {item.width && item.height && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Dimensions</span>
                <p className="text-sm">{item.width} × {item.height}</p>
              </div>
            )}
            
            <div>
              <span className="text-sm font-medium text-muted-foreground">Original Size</span>
              <p className="text-sm">{formatFileSize(item.original_size_bytes)}</p>
            </div>
            
            {item.optimized_size_bytes && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Optimized Size</span>
                <div className="text-sm">
                  <p className="text-emerald-600 font-medium">{formatFileSize(item.optimized_size_bytes)}</p>
                  <p className="text-xs text-muted-foreground">
                    {compressionRatio}% reduction
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Quality Information for Videos */}
          {isAdmin && item.media_type === 'video' && Object.keys(qualityUrls).length > 0 && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Available Qualities</h4>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {Object.entries(qualityUrls).map(([quality, url]) => (
                  <div key={quality} className="text-center p-2 bg-background rounded border">
                    <div className="font-medium">{quality}</div>
                    <div className="text-muted-foreground">WebM</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};