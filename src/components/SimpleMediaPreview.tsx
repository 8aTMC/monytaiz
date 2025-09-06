import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  X, 
  Calendar, 
  FileText, 
  User,
  Clock,
  HardDrive,
  Image as ImageIcon,
  Video,
  Music,
  Tag,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { usePersistentMediaCache } from '@/hooks/usePersistentMediaCache';
import { useInstantMedia } from '@/hooks/useInstantMedia';
import { QualitySelector } from '@/components/QualitySelector';
import { format } from 'date-fns';
import { SimpleMediaItem } from '@/hooks/useSimpleMedia';
import { CustomAudioPlayer } from '@/components/CustomAudioPlayer';
import { EnhancedVideoPlayer } from '@/components/EnhancedVideoPlayer';

interface SimpleMediaPreviewProps {
  mediaItems: SimpleMediaItem[];
  selectedIndex: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

export const SimpleMediaPreview: React.FC<SimpleMediaPreviewProps> = ({
  mediaItems,
  selectedIndex,
  onClose,
  onPrevious,
  onNext
}) => {
  const [currentQuality, setCurrentQuality] = useState('original');
  const { getSecureMediaUrl } = usePersistentMediaCache();
  const { 
    loadInstantMedia, 
    enhanceQuality, 
    placeholder, 
    lowQuality, 
    highQuality, 
    currentUrl, 
    isLoading, 
    error: mediaError 
  } = useInstantMedia();

  const currentItem = mediaItems[selectedIndex];
  
  useEffect(() => {
    if (currentItem) {
      const path = currentItem.processed_path || currentItem.original_path;
      if (path) {
        // Load media with instant caching and progressive enhancement
        loadInstantMedia(path, currentItem.thumbnail_path);
      }
    }
  }, [currentItem, loadInstantMedia]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getAvailableQualities = () => ['original'];

  const getMediaIcon = (mediaType: string) => {
    switch (mediaType) {
      case 'image':
        return <ImageIcon className="h-5 w-5" />;
      case 'video':
        return <Video className="h-5 w-5" />;
      case 'audio':
        return <Music className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  if (!currentItem) return null;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0">
        <div className="flex flex-col h-full">
          <DialogHeader className="p-4 border-b shrink-0">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                {getMediaIcon(currentItem.media_type)}
                <div>
                  <h3 className="text-lg font-semibold">{currentItem.title || currentItem.original_filename}</h3>
                  <p className="text-sm text-muted-foreground">{currentItem.original_filename}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {currentItem.media_type === 'video' && (
                  <QualitySelector
                    currentQuality={currentQuality}
                    onQualityChange={setCurrentQuality}
                    availableQualities={getAvailableQualities()}
                  />
                )}
                <Button variant="outline" size="sm" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 p-4 overflow-auto">
            <div className="space-y-4">
              {currentItem.media_type === 'image' && currentUrl && (
                <div className="flex justify-center relative">
                  {isLoading && placeholder && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/20 rounded-lg">
                      <img 
                        src={placeholder} 
                        alt="Loading..."
                        className="max-w-full max-h-96 object-contain rounded-lg opacity-50 blur-sm"
                      />
                    </div>
                  )}
                  <img 
                    src={currentUrl} 
                    alt={currentItem.title || currentItem.original_filename}
                    className="max-w-full max-h-96 object-contain rounded-lg transition-opacity duration-300"
                    onMouseEnter={() => enhanceQuality()}
                    style={{ opacity: isLoading ? 0.7 : 1 }}
                  />
                </div>
              )}
              
              {currentItem.media_type === 'video' && currentUrl && (
                <div className="flex justify-center">
                  <EnhancedVideoPlayer 
                    src={currentUrl}
                    className="max-w-full max-h-96 rounded-lg"
                    onError={(e) => {
                      console.error('Failed to load video:', e);
                    }}
                  />
                </div>
              )}
              
              {currentItem.media_type === 'audio' && currentUrl && (
                <div className="flex justify-center">
                  <CustomAudioPlayer
                    src={currentUrl}
                    title={currentItem.title || currentItem.original_filename}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Navigation arrows */}
          {selectedIndex > 0 && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-background/20 backdrop-blur-sm border-0 hover:bg-background/40"
              onClick={onPrevious}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}
          
          {selectedIndex < mediaItems.length - 1 && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-background/20 backdrop-blur-sm border-0 hover:bg-background/40"
              onClick={onNext}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};