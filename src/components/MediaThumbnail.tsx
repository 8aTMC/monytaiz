
import { useEffect, useMemo } from 'react';
import { Image, Video, FileAudio } from 'lucide-react';
import { useOptimizedMediaDisplay } from '@/hooks/useOptimizedMediaDisplay';
import { useThumbnailUrl } from '@/hooks/useThumbnailUrl';

interface MediaThumbnailProps {
  item: {
    id?: string;
    type: 'image' | 'video' | 'audio';
    storage_path?: string;
    file_path?: string;
    path?: string;
    title: string | null;
    tiny_placeholder?: string;
    thumbnail_path?: string;
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
  
  // Use the exact thumbnail_path from database - don't reconstruct it
  console.log('MediaThumbnail - item thumbnail_path:', item.thumbnail_path, 'type:', item.type);
  const { thumbnailUrl, loading: thumbnailLoading } = useThumbnailUrl(item.thumbnail_path);

  // Create stable media item object to prevent infinite re-renders
  const stableMediaItem = useMemo(() => ({
    id: item.id || crypto.randomUUID(),
    type: item.type,
    storage_path: item.storage_path || item.file_path,
    path: item.path,
    tiny_placeholder: item.tiny_placeholder,
    thumbnail_path: item.thumbnail_path,
    width: item.width,
    height: item.height
  }), [
    item.id, 
    item.type, 
    item.storage_path, 
    item.file_path, 
    item.path, 
    item.tiny_placeholder,
    item.thumbnail_path,
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

  // Load optimized media on mount with stable dependencies, but skip for videos with thumbnails
  useEffect(() => {
    // Skip loading optimized media for videos that have thumbnail_path - prioritize actual thumbnails
    const shouldSkipOptimizedLoading = stableMediaItem.type === 'video' && stableMediaItem.thumbnail_path;
    
    if (stableMediaItem.type && (stableMediaItem.storage_path || stableMediaItem.path) && !shouldSkipOptimizedLoading) {
      // Always treat content as private since content bucket is private
      loadOptimizedMedia(stableMediaItem, false);
    }

    // Cleanup function
    return () => {
      clearMedia();
    };
  }, [stableMediaItem.id, stableMediaItem.type, stableMediaItem.storage_path, stableMediaItem.path, stableMediaItem.thumbnail_path]);

  // Calculate aspect ratio with consistent heights for grid display
  const calculateAspectRatio = () => {
    // Force videos to use 1:1 aspect ratio for consistent grid height
    if (item.type === 'video') {
      return '1';
    }
    
    if (!item.width || !item.height) {
      return '1';
    }
    
    const ratio = item.width / item.height;
    // Limit aspect ratios for consistent grid display
    const clampedRatio = Math.max(0.75, Math.min(1.33, ratio));
    return clampedRatio.toFixed(3);
  };
  
  const aspectRatio = calculateAspectRatio();

  // For non-image types, show thumbnail if available, otherwise show icon with natural aspect ratio
  if (item.type !== 'image') {
    // Check for thumbnail from simple_media first, then tiny_placeholder
    const thumbnailSrc = thumbnailUrl || 
      (item.tiny_placeholder && item.tiny_placeholder !== 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==' ? item.tiny_placeholder : null);
    
    if (thumbnailSrc && !thumbnailLoading) {
      return (
        <div 
          className={`bg-muted rounded-t-lg relative overflow-hidden group ${className}`}
          style={{ aspectRatio }}
        >
          <img
            src={thumbnailSrc}
            alt={item.title || `${item.type} thumbnail`}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
          {/* Media type icon */}
          <div className="absolute bottom-2 right-2 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center">
            {item.type === 'video' && <Video className="w-3.5 h-3.5 text-white" />}
            {item.type === 'audio' && <FileAudio className="w-3.5 h-3.5 text-white" />}
          </div>
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

  // Calculate display dimensions
  const aspectWidth = item.width ? Math.min(item.width, 256) : 256;
  const aspectHeight = item.height ? Math.round((aspectWidth / (item.width ?? 1)) * (item.height ?? 256)) : 256;

  return (
    <div 
      className={`bg-muted rounded-t-lg relative overflow-hidden ${className}`}
      style={{ aspectRatio }}
    >
      {/* Show current URL if available */}
      {currentUrl && !error && (
        <>
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
          {/* Media type icon */}
          <div className="absolute bottom-2 right-2 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center">
            <Image className="w-3.5 h-3.5 text-white" />
          </div>
        </>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            {getContentTypeIcon('image')}
            <span className="text-xs text-muted-foreground">Failed to load</span>
          </div>
        </div>
      )}
    </div>
  );
};
