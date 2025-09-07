
import { useEffect, useMemo, useState } from 'react';
import { Image, Video, Headphones, FileImage } from 'lucide-react';
import { useOptimizedMediaDisplay } from '@/hooks/useOptimizedMediaDisplay';
import { useThumbnailUrl } from '@/hooks/useThumbnailUrl';
import { WaveformIcon } from '@/components/icons/WaveformIcon';

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
  const [imageLoadError, setImageLoadError] = useState(false);
  
  // Use the exact thumbnail_path from database - don't reconstruct it
  const { thumbnailUrl, loading: thumbnailLoading } = useThumbnailUrl(item.thumbnail_path);

  // HEIC detection utility
  const isHEICFile = (path?: string) => {
    if (!path) return false;
    const fileName = path.toLowerCase();
    return fileName.endsWith('.heic') || fileName.endsWith('.heif');
  };

  // Memoize HEIC detection to prevent re-renders
  const isCurrentHEIC = useMemo(() => {
    return isHEICFile(item.storage_path) || isHEICFile(item.file_path) || isHEICFile(item.path);
  }, [item.storage_path, item.file_path, item.path]);

  // Reset image load error when item changes
  useEffect(() => {
    setImageLoadError(false);
  }, [item.id, currentUrl]);

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
      case 'audio': return <WaveformIcon className="h-10 w-10" />;
      default: return <Image className="h-8 w-8" />;
    }
  };

  // Load optimized media on mount with stable dependencies, but skip for videos with thumbnails
  useEffect(() => {
    // Skip loading optimized media for videos that have thumbnail_path - prioritize actual thumbnails
    const shouldSkipOptimizedLoading = (stableMediaItem.type === 'video' && stableMediaItem.thumbnail_path);
    
    if (stableMediaItem.type && (stableMediaItem.storage_path || stableMediaItem.path) && !shouldSkipOptimizedLoading) {
      // Always treat content as private since content bucket is private
      loadOptimizedMedia(stableMediaItem, false);
    }

    // Cleanup function
    return () => {
      clearMedia();
    };
  }, [stableMediaItem.id, stableMediaItem.type, stableMediaItem.storage_path, stableMediaItem.path, stableMediaItem.thumbnail_path, isCurrentHEIC]);

  // Calculate aspect ratio respecting video proportions
  const calculateAspectRatio = () => {
    if (!item.width || !item.height) {
      return '1';
    }
    
    const ratio = item.width / item.height;
    
    // For videos, respect natural aspect ratio but with reasonable bounds
    if (item.type === 'video') {
      // Allow vertical videos to be taller, horizontal to be wider
      const clampedRatio = Math.max(0.5, Math.min(2, ratio));
      return clampedRatio.toFixed(3);
    }
    
    // For images, limit aspect ratios for consistent grid display
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
          className={`bg-muted rounded-xl relative overflow-hidden group ${className}`}
          style={{ aspectRatio }}
        >
          <img
            src={thumbnailSrc}
            alt={item.title || `${item.type} thumbnail`}
            className={`w-full h-full ${item.type === 'video' ? 'object-contain' : 'object-cover'} block media`}
            loading="lazy"
            decoding="async"
          />
          {/* Media type icon */}
          <div className="absolute bottom-3 right-2 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center">
            {item.type === 'video' && <Video className="w-3.5 h-3.5 text-white" />}
            {item.type === 'audio' && <Headphones className="w-3.5 h-3.5 text-white" />}
          </div>
        </div>
      );
    }
    
    // Fallback to icon if no thumbnail
    return (
      <div 
        className={`bg-muted rounded-xl flex items-center justify-center relative overflow-hidden ${className}`}
        style={{ aspectRatio }}
      >
        <div className="flex flex-col items-center gap-2">
          {getContentTypeIcon(item.type)}
        </div>
        {/* Media type icon for non-image fallback */}
        <div className="absolute bottom-3 right-2 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center">
          {item.type === 'video' && <Video className="w-3.5 h-3.5 text-white" />}
          {item.type === 'audio' && <Headphones className="w-3.5 h-3.5 text-white" />}
        </div>
      </div>
    );
  }

  // Show loading state with natural aspect ratio
  if (isLoading && !currentUrl) {
    return (
      <div 
        className={`bg-muted rounded-xl flex items-center justify-center relative overflow-hidden ${className}`}
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
      className={`bg-muted rounded-xl relative overflow-hidden ${className}`}
      style={{ aspectRatio }}
    >
      {/* Show HEIC fallback for HEIC files that fail to load or have no URL */}
      {(isCurrentHEIC && (imageLoadError || (!currentUrl && !isLoading))) ? (
        <div className="w-full h-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <FileImage className="h-8 w-8 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">HEIC</span>
          </div>
          {/* HEIC format badge */}
          <div className="absolute bottom-3 right-2 px-2 py-1 bg-orange-500/90 rounded text-white text-xs font-medium">
            HEIC
          </div>
        </div>
      ) : (
        <>
          {/* Show current URL if available */}
          {currentUrl && !error && (
            <>
              <img
                src={currentUrl}
                alt={item.title || 'Media thumbnail'}
                className="w-full h-full object-cover transition-opacity duration-200 block media"
                loading="lazy"
                decoding="async"
                width={aspectWidth}
                height={aspectHeight}
                onError={() => {
                  setImageLoadError(true);
                }}
              />
              {/* Media type icon or HEIC badge */}
              {isCurrentHEIC ? (
                <div className="absolute bottom-3 right-2 px-2 py-1 bg-orange-500/90 rounded text-white text-xs font-medium">
                  HEIC
                </div>
              ) : (
                <div className="absolute bottom-3 right-2 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center">
                  <Image className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </>
          )}

          {/* Error state for non-HEIC files */}
          {error && !isCurrentHEIC && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                {getContentTypeIcon('image')}
                <span className="text-xs text-muted-foreground">Failed to load</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
