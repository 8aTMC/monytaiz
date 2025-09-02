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
import { useSecureMedia } from '@/hooks/useSecureMedia';
import { QualitySelector } from '@/components/QualitySelector';
import { format } from 'date-fns';
import { SimpleMediaItem } from '@/hooks/useSimpleMedia';
import { CustomAudioPlayer } from '@/components/CustomAudioPlayer';

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
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  const { getSecureUrl } = useSecureMedia();

  const currentItem = mediaItems[selectedIndex];
  
  useEffect(() => {
    if (currentItem) {
      const loadUrls = async () => {
        const mainUrl = await getSecureUrl(currentItem.processed_path || currentItem.original_path);
        setMediaUrl(mainUrl);
        
        if (currentItem.thumbnail_path) {
          const thumbUrl = await getSecureUrl(currentItem.thumbnail_path);
          setThumbnailUrl(thumbUrl);
        }
      };
      loadUrls();
    }
  }, [currentItem, getSecureUrl]);

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
              {currentItem.media_type === 'image' && mediaUrl && (
                <div className="flex justify-center">
                  <img 
                    src={mediaUrl} 
                    alt={currentItem.title || currentItem.original_filename}
                    className="max-w-full max-h-96 object-contain rounded-lg"
                  />
                </div>
              )}
              
              {currentItem.media_type === 'video' && mediaUrl && (
                <div className="flex justify-center">
                  <video 
                    controls 
                    className="max-w-full max-h-96 rounded-lg"
                    poster={thumbnailUrl || undefined}
                  >
                    <source src={mediaUrl} type={currentItem.mime_type} />
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}
              
              {currentItem.media_type === 'audio' && mediaUrl && (
                <div className="flex justify-center">
                  <CustomAudioPlayer
                    src={mediaUrl}
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