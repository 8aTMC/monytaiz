
import { useEffect, useMemo, useState } from 'react';
import { Image, Video, Headphones, FileImage } from 'lucide-react';
import { useOptimizedMediaDisplay } from '@/hooks/useOptimizedMediaDisplay';
import { useOptimizedThumbnail } from '@/hooks/useOptimizedThumbnail';
import { useSimpleLibraryMedia } from '@/hooks/useSimpleLibraryMedia';
import { useThumbnailUrl } from '@/hooks/useThumbnailUrl';
import { WaveformIcon } from '@/components/icons/WaveformIcon';
import { MediaDebugPanel } from '@/components/MediaDebugPanel';

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
    processed_path?: string;
    original_path?: string;
    width?: number;
    height?: number;
    renditions?: {
      video_1080?: string;
      video_720?: string;
    };
  };
  file?: File; // For review queue items
  className?: string;
  isPublic?: boolean;
  debug?: boolean;
  forceSquare?: boolean;
}

export const MediaThumbnail = ({ item, file, className = "", isPublic = false, debug = false, forceSquare = false }: MediaThumbnailProps) => {
  // Detect if this is a File object (review queue) or stored media (library)
  const isFileObject = !!file;
  
  // For File objects (review queue), use optimized thumbnail generation
  const { thumbnail: fileThumbnail, isLoading: fileLoading } = useOptimizedThumbnail(file || new File([], ''));
  
  // For stored media (library), use simple library media hook
  const { getThumbnailUrl: getLibraryThumbnail, thumbnailUrl: libraryThumbnailUrl, isLoading: libraryLoading, error: libraryError, resetMedia } = useSimpleLibraryMedia();
  
  // Fallback for existing useThumbnailUrl (legacy)
  const { thumbnailUrl: legacyThumbnailUrl, loading: legacyLoading } = useThumbnailUrl(item.thumbnail_path);
  
  const [imageLoadError, setImageLoadError] = useState(false);
  const [libraryThumbnailLoaded, setLibraryThumbnailLoaded] = useState(false);

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
  }, [item.id, libraryThumbnailUrl]);

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

  // Load library media for stored items (not File objects)
  useEffect(() => {
    if (!isFileObject && stableMediaItem.id && stableMediaItem.type && !libraryThumbnailLoaded) {
      getLibraryThumbnail(stableMediaItem as any).then(() => {
        setLibraryThumbnailLoaded(true);
      });
    }

    // Reset when item changes
    if (!isFileObject) {
      return () => {
        resetMedia();
        setLibraryThumbnailLoaded(false);
      };
    }
  }, [isFileObject, stableMediaItem.id, stableMediaItem.type, libraryThumbnailLoaded, getLibraryThumbnail, resetMedia]);

  // Calculate aspect ratio respecting video proportions
  const calculateAspectRatio = () => {
    // Force square aspect ratio when requested
    if (forceSquare) {
      return '1';
    }
    
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

  return (
    <div>
      {debug && (
        <MediaDebugPanel 
          item={item} 
          mediaState={{ 
            currentUrl: libraryThumbnailUrl || legacyThumbnailUrl || fileThumbnail, 
            isLoading: libraryLoading || legacyLoading || fileLoading, 
            error: libraryError || imageLoadError 
          }} 
        />
      )}
      {renderThumbnail()}
    </div>
  );

  function renderThumbnail() {
    // Determine which thumbnail to use based on context
    let thumbnailSrc: string | null = null;
    let isLoading = false;
    let hasError = false;
    
    if (isFileObject) {
      // For File objects (review queue), use file thumbnail
      thumbnailSrc = fileThumbnail;
      isLoading = fileLoading;
    } else {
      // For stored media (library), use library thumbnail, fallback to legacy
      thumbnailSrc = libraryThumbnailUrl || legacyThumbnailUrl;
      isLoading = libraryLoading || legacyLoading;
      hasError = libraryError;
    }
    
    // For non-image types, show thumbnail if available, otherwise show icon
    if (item.type !== 'image') {
      // Also check tiny_placeholder for fallback
      const finalThumbnailSrc = thumbnailSrc || 
        (item.tiny_placeholder && item.tiny_placeholder !== 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==' ? item.tiny_placeholder : null);
      
      if (finalThumbnailSrc && !isLoading) {
        return (
          <div 
            className={`bg-muted rounded-xl relative overflow-hidden group ${className}`}
            style={{ aspectRatio }}
          >
            <img
              src={finalThumbnailSrc}
              alt={item.title || `${item.type} thumbnail`}
              className={`w-full h-full ${forceSquare || item.type !== 'video' ? 'object-cover' : 'object-contain'} block media`}
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

    // Show loading state
    if (isLoading && !thumbnailSrc) {
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

    // For images, show thumbnail or error state
    if (thumbnailSrc) {
      return (
        <div 
          className={`bg-muted rounded-xl relative overflow-hidden ${className}`}
          style={{ aspectRatio }}
        >
          <img
            src={thumbnailSrc}
            alt={item.title || 'Media thumbnail'}
            className="w-full h-full object-cover transition-opacity duration-200 block media"
            loading="lazy"
            decoding="async"
            onError={() => setImageLoadError(true)}
          />
          {/* Media type icon */}
          <div className="absolute bottom-3 right-2 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center">
            <Image className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      );
    }

    // Error state or no thumbnail available
    if (hasError || imageLoadError) {
      return (
        <div 
          className={`bg-muted rounded-xl relative overflow-hidden flex items-center justify-center ${className}`}
          style={{ aspectRatio }}
        >
          <div className="flex flex-col items-center gap-2">
            {getContentTypeIcon(item.type)}
            <span className="text-xs text-muted-foreground">Failed to load</span>
          </div>
        </div>
      );
    }

    // Default fallback
    return (
      <div 
        className={`bg-muted rounded-xl flex items-center justify-center relative overflow-hidden ${className}`}
        style={{ aspectRatio }}
      >
        <div className="flex flex-col items-center gap-2">
          {getContentTypeIcon(item.type)}
        </div>
      </div>
    );
  }
};
