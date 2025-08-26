import { useState, useEffect } from 'react';
import { Image, Video, FileAudio } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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

const SUPABASE_URL = "https://alzyzfjzwvofmjccirjq.supabase.co";

export const MediaThumbnail = ({ item, className = "" }: MediaThumbnailProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Helper to get type from either format
  const getItemType = () => item.type || item.content_type || 'unknown';
  
  // Helper to get storage path from either format
  const getStoragePath = () => item.storage_path || item.file_path || '';

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

  // Build transform URL for fast CDN-cached thumbnail
  const baseUrl = `${SUPABASE_URL}/storage/v1/object/public/content/${storagePath}`;
  const thumbUrl = `${baseUrl}?width=256&height=256&resize=cover&quality=70&format=webp`;

  // Calculate aspect ratio for layout stability
  const aspectWidth = item.width ? Math.min(item.width, 256) : 256;
  const aspectHeight = item.height ? Math.round((aspectWidth / (item.width ?? 1)) * (item.height ?? 256)) : 256;

  return (
    <div className={`aspect-square bg-muted rounded-t-lg flex items-center justify-center relative overflow-hidden ${className}`}>
      {item.tiny_placeholder && !imageLoaded && !hasError && (
        <img
          src={item.tiny_placeholder}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-md transition-all duration-300"
          style={{ filter: 'blur(8px)' }}
        />
      )}
      
      <img
        src={thumbUrl}
        alt={item.title || 'Thumbnail'}
        className={`w-full h-full object-cover transition-all duration-500 ${
          imageLoaded && !hasError ? 'opacity-100 blur-0' : 'opacity-0'
        }`}
        loading="lazy"
        decoding="async"
        width={aspectWidth}
        height={aspectHeight}
        srcSet={`${thumbUrl}&dpr=1 1x, ${thumbUrl}&dpr=2 2x`}
        sizes="(min-width: 1200px) 256px, 33vw"
        onLoad={() => setImageLoaded(true)}
        onError={() => setHasError(true)}
      />

      {hasError && (
        <div className="flex flex-col items-center gap-2">
          {getContentTypeIcon('image')}
          <span className="text-xs text-muted-foreground">Failed to load</span>
        </div>
      )}
    </div>
  );
};