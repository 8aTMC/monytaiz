import { useEffect, useMemo } from 'react';
import { Image, Video, FileAudio, Play } from 'lucide-react';
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
  const { loadOptimizedMedia, currentUrl, isLoading, error, clearMedia } = useOptimizedMediaDisplay();

  // Create stable media item object to prevent infinite re-renders
  const stableMediaItem = useMemo(() => ({
    id: item.id || crypto.randomUUID(),
    type: item.type,
    storage_path: item.storage_path || item.file_path,
    path: item.path,
    tiny_placeholder: item.tiny_placeholder,
    width: item.width,
    height: item.height
  }), [
    item.id, 
    item.type, 
    item.storage_path, 
    item.file_path, 
    item.path, 
    item.tiny_placeholder, 
    item.width, 
    item.height
  ]);

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-8 w-8" />;
      case 'video': return <Video className="h-8 w-8" />;
      case 'audio': return <FileAudio className="h-8 w-8" />;
      default: return <Image className="h-8 w-8" />;
    }
  };

  // Load optimized media on mount with stable dependencies
  useEffect(() => {
    if (stableMediaItem.type && (stableMediaItem.storage_path || stableMediaItem.path)) {
      // Always treat content as private since content bucket is private
      loadOptimizedMedia(stableMediaItem, false);
    }

    // Cleanup function
    return () => {
      clearMedia();
    };
  }, [stableMediaItem.id, stableMediaItem.type, stableMediaItem.storage_path, stableMediaItem.path]);

  // For non-image types, show thumbnail if available, otherwise show icon with natural aspect ratio
  if (item.type !== 'image') {
    const aspectRatio = item.width && item.height 
      ? (item.width / item.height).toFixed(3)
      : '16/9'; // Default aspect ratio for video/audio
    
    // If we have a tiny_placeholder (thumbnail), use it instead of icon
    if (item.tiny_placeholder && item.tiny_placeholder !== 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==') {
      return (
        <div 
          className={`bg-muted rounded-t-lg flex items-center justify-center relative overflow-hidden group ${className}`}
          style={{ aspectRatio }}
        >
          <img
            src={item.tiny_placeholder}
            alt={item.title || `${item.type} thumbnail`}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
          {item.type === 'video' && (
            <>
              {/* Play button overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                  <Play className="w-5 h-5 text-primary ml-0.5" />
                </div>
              </div>
              {/* Video label */}
              <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                Video
              </div>
            </>
          )}
        </div>
      );
    }
    
    // Fallback to icon if no thumbnail
    return (
      <div 
        className={`bg-muted rounded-t-lg flex items-center justify-center relative overflow-hidden ${className}`}
        style={{ aspectRatio }}
      >
        <div className="flex flex-col items-center gap-2">
          {getContentTypeIcon(item.type)}
          <span className="text-xs text-muted-foreground capitalize">
            {item.type}
          </span>
        </div>
      </div>
    );
  }

  // Show loading state with natural aspect ratio
  if (isLoading && !currentUrl) {
    const aspectRatio = item.width && item.height 
      ? (item.width / item.height).toFixed(3)
      : '1';
      
    return (
      <div 
        className={`bg-muted rounded-t-lg flex items-center justify-center relative overflow-hidden ${className}`}
        style={{ aspectRatio }}
      >
        <div className="animate-pulse">
          <Image className="h-8 w-8 text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Calculate natural aspect ratio
  const aspectRatio = item.width && item.height 
    ? (item.width / item.height).toFixed(3)
    : '1';
  
  // Calculate display dimensions
  const aspectWidth = item.width ? Math.min(item.width, 256) : 256;
  const aspectHeight = item.height ? Math.round((aspectWidth / (item.width ?? 1)) * (item.height ?? 256)) : 256;

  return (
    <div 
      className={`bg-muted rounded-t-lg flex items-center justify-center relative overflow-hidden ${className}`}
      style={{ aspectRatio }}
    >
      {/* Show current URL if available */}
      {currentUrl && !error && (
        <img
          src={currentUrl}
          alt={item.title || 'Media thumbnail'}
          className="w-full h-full object-cover transition-opacity duration-200"
          loading="lazy"
          decoding="async"
          width={aspectWidth}
          height={aspectHeight}
          onError={(e) => {
            // Hide broken image
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