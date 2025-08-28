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
  const { loadOptimizedMedia, currentUrl, tinyPlaceholder, enhanceQuality, error } = useOptimizedMediaDisplay();

  // Convert item to the expected format
  const mediaItem = {
    id: item.id || crypto.randomUUID(),
    type: item.type,
    storage_path: item.storage_path || item.file_path,
    path: item.path,
    tiny_placeholder: item.tiny_placeholder,
    width: item.width,
    height: item.height,
    renditions: item.renditions
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-8 w-8" />;
      case 'video': return <Video className="h-8 w-8" />;
      case 'audio': return <FileAudio className="h-8 w-8" />;
      default: return <Image className="h-8 w-8" />;
    }
  };

  // Load optimized media on mount
  useEffect(() => {
    if (mediaItem.type && (mediaItem.storage_path || mediaItem.path)) {
      loadOptimizedMedia(mediaItem, isPublic);
    }
  }, [mediaItem.type, mediaItem.storage_path, mediaItem.path, loadOptimizedMedia, isPublic]);

  // For non-image types, show icon
  if (mediaItem.type !== 'image') {
    return (
      <div className={`aspect-square bg-muted rounded-t-lg flex items-center justify-center relative overflow-hidden ${className}`}>
        <div className="flex flex-col items-center gap-2">
          {getContentTypeIcon(mediaItem.type)}
          <span className="text-xs text-muted-foreground capitalize">
            {mediaItem.type}
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
  const aspectWidth = mediaItem.width ? Math.min(mediaItem.width, 256) : 256;
  const aspectHeight = mediaItem.height ? Math.round((aspectWidth / (mediaItem.width ?? 1)) * (mediaItem.height ?? 256)) : 256;

  return (
    <div 
      className={`aspect-square bg-muted rounded-t-lg flex items-center justify-center relative overflow-hidden ${className}`}
      onMouseEnter={enhanceQuality}
    >
      {/* Show current URL (progressive: tiny placeholder → thumbnail → higher quality) */}
      {currentUrl && (
        <img
          src={currentUrl}
          alt={item.title || 'Media thumbnail'}
          className={`w-full h-full object-cover transition-all duration-300 ${
            currentUrl === tinyPlaceholder ? 'filter blur-sm' : 'filter-none'
          }`}
          loading="lazy"
          decoding="async"
          width={aspectWidth}
          height={aspectHeight}
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