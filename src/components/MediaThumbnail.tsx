import { useState, useEffect } from 'react';
import { Image, Video, FileAudio } from 'lucide-react';
import { useInstantMedia } from '@/hooks/useInstantMedia';

interface MediaThumbnailProps {
  item: {
    type?: string;
    content_type?: string;
    storage_path?: string;
    file_path?: string;
    title: string | null;
    tiny_placeholder?: string;
    width?: number;
    height?: number;
  };
  className?: string;
}

export const MediaThumbnail = ({ item, className = "" }: MediaThumbnailProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const { loadInstantMedia, currentUrl, placeholder, error, enhanceQuality } = useInstantMedia();

  // Helper to get type from either format
  const getItemType = () => item.type || item.content_type || 'unknown';
  
  // Helper to get storage path from either format  
  const getStoragePath = () => {
    const path = item.storage_path || item.file_path || '';
    // Remove content/ prefix if exists since we'll add it in the URL
    return path.startsWith('content/') ? path.substring(8) : path;
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-8 w-8" />;
      case 'video': return <Video className="h-8 w-8" />;
      case 'audio': return <FileAudio className="h-8 w-8" />;
      default: return <Image className="h-8 w-8" />;
    }
  };

  const itemType = getItemType();
  const storagePath = getStoragePath();

  // Load media with instant placeholders
  useEffect(() => {
    if (itemType === 'image' && storagePath) {
      loadInstantMedia(storagePath, item.tiny_placeholder);
    }
  }, [itemType, storagePath, loadInstantMedia, item.tiny_placeholder]);

  // For non-image types, show icon
  if (itemType !== 'image') {
    return (
      <div className={`aspect-square bg-muted rounded-t-lg flex items-center justify-center relative overflow-hidden ${className}`}>
        <div className="flex flex-col items-center gap-2">
          {getContentTypeIcon(itemType)}
          <span className="text-xs text-muted-foreground capitalize">
            {itemType}
          </span>
        </div>
      </div>
    );
  }

  // Show loading state only if no placeholder and no error
  if (!currentUrl && !error) {
    return (
      <div className={`aspect-square bg-muted rounded-t-lg flex items-center justify-center relative overflow-hidden ${className}`}>
        <div className="animate-pulse">
          <Image className="h-8 w-8 text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Calculate aspect ratio for layout stability
  const aspectWidth = item.width ? Math.min(item.width, 256) : 256;
  const aspectHeight = item.height ? Math.round((aspectWidth / (item.width ?? 1)) * (item.height ?? 256)) : 256;

  return (
    <div 
      className={`aspect-square bg-muted rounded-t-lg flex items-center justify-center relative overflow-hidden ${className}`}
      onMouseEnter={enhanceQuality}
    >
      {/* Always show current URL (instant placeholder first, then better quality) */}
      {currentUrl && (
        <img
          src={currentUrl}
          alt={item.title || 'Thumbnail'}
          className={`w-full h-full object-cover transition-all duration-300 ${
            currentUrl === placeholder ? 'filter blur-sm' : 'filter-none'
          }`}
          loading="lazy"
          decoding="async"
          width={aspectWidth}
          height={aspectHeight}
          onLoad={() => setImageLoaded(true)}
          onError={() => console.error('Failed to load thumbnail')}
        />
      )}

      {/* Error state */}
      {error && (
        <div className="flex flex-col items-center gap-2">
          {getContentTypeIcon('image')}
          <span className="text-xs text-muted-foreground">Failed to load</span>
        </div>
      )}
    </div>
  );
};