import { useState, useEffect } from 'react';
import { Image, Video, FileAudio } from 'lucide-react';
import { useOptimizedMediaDisplay } from '@/hooks/useOptimizedMediaDisplay';

interface MediaThumbnailProps {
  item: {
    id?: string;
    type: 'image' | 'video' | 'audio';
    storage_path?: string;
    file_path?: string;
    path?: string;
    title: string | null;
    tiny_placeholder?: string;
    width?: number;
    height?: number;
    renditions?: {
      video_1080?: string;
      video_720?: string;
    };
  };
  className?: string;
  isPublic?: boolean;
}

export const MediaThumbnail = ({ item, className = "", isPublic = false }: MediaThumbnailProps) => {
  const { loadOptimizedMedia, currentUrl, enhanceQuality, error } = useOptimizedMediaDisplay();

  // Use primitive values to prevent infinite re-renders
  const itemId = item.id || crypto.randomUUID();
  const itemType = item.type;
  const storagePath = item.storage_path || item.file_path;
  const itemPath = item.path;

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-8 w-8" />;
      case 'video': return <Video className="h-8 w-8" />;
      case 'audio': return <FileAudio className="h-8 w-8" />;
      default: return <Image className="h-8 w-8" />;
    }
  };

  // Load optimized media on mount with primitive dependencies
  useEffect(() => {
    if (itemType && (storagePath || itemPath)) {
      const mediaItem = {
        id: itemId,
        type: itemType,
        storage_path: storagePath,
        path: itemPath,
        tiny_placeholder: item.tiny_placeholder,
        width: item.width,
        height: item.height
      };
      loadOptimizedMedia(mediaItem, isPublic);
    }
  }, [itemId, itemType, storagePath, itemPath, isPublic, loadOptimizedMedia, item.tiny_placeholder, item.width, item.height]);

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

  // Show loading state only if no current URL and no error
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
    >
      {/* Show current URL - processed files load instantly at full quality */}
      {currentUrl && (
        <img
          src={currentUrl}
          alt={item.title || 'Media thumbnail'}
          className="w-full h-full object-cover transition-opacity duration-200"
          loading="lazy"
          decoding="async"
          width={aspectWidth}
          height={aspectHeight}
          onError={(e) => {
            // Silently handle error
            e.currentTarget.style.display = 'none';
          }}
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