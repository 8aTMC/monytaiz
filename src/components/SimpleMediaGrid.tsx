import React, { useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Volume1, Image as ImageIcon } from 'lucide-react';
import { SimpleMediaItem } from '@/hooks/useSimpleMedia';
import { useInstantMedia } from '@/hooks/useInstantMedia';

interface SimpleMediaGridProps {
  media: SimpleMediaItem[];
  loading: boolean;
  onItemClick: (item: SimpleMediaItem, event: React.MouseEvent, index: number) => void;
  getThumbnailUrl?: (item: SimpleMediaItem) => Promise<string | null>;
}

const MediaThumbnail: React.FC<{ item: SimpleMediaItem; onHover?: () => void }> = ({ item, onHover }) => {
  const { 
    loadInstantMedia, 
    enhanceQuality, 
    placeholder, 
    currentUrl, 
    isLoading,
    error
  } = useInstantMedia();
  
  React.useEffect(() => {
    // For HEIC files, use original_path as they don't have processed thumbnails
    const isHEIC = item.original_filename?.toLowerCase().includes('.heic') || 
                   item.original_filename?.toLowerCase().includes('.heif');
    
    const thumbnailPath = isHEIC 
      ? item.original_path 
      : (item.thumbnail_path || item.processed_path || item.original_path);
    
    if (thumbnailPath) {
      console.log('Loading thumbnail:', {
        filename: item.original_filename,
        path: thumbnailPath,
        isHEIC
      });
      loadInstantMedia(thumbnailPath);
    }
  }, [item, loadInstantMedia]);

  if (currentUrl) {
    return (
      <img
        src={currentUrl}
        alt={item.title || item.original_filename}
        className="w-full h-full object-cover transition-all duration-300 hover:scale-105"
        onMouseEnter={() => {
          enhanceQuality();
          onHover?.();
        }}
        style={{ 
          opacity: isLoading ? 0.7 : 1,
          filter: isLoading ? 'blur(1px)' : 'none'
        }}
        onLoad={() => console.log('Thumbnail loaded successfully:', item.original_filename)}
        onError={(e) => {
          console.error('Thumbnail failed to load:', item.original_filename, e);
        }}
      />
    );
  }

  if (placeholder) {
    return (
      <img
        src={placeholder}
        alt="Loading..."
        className="w-full h-full object-cover opacity-50 blur-sm"
        onError={() => console.warn('Placeholder failed to load:', item.original_filename)}
      />
    );
  }

  // Show loading state for longer loads
  if (isLoading) {
    return (
      <div className="w-full h-full bg-muted/30 flex items-center justify-center animate-pulse">
        <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
        <div className="absolute top-1 right-1 w-2 h-2 bg-primary/60 rounded-full animate-pulse" />
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-muted/50 flex items-center justify-center">
      <MediaTypeIcon type={item.media_type} />
    </div>
  );
};

const MediaTypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'video':
      return <Play className="w-6 h-6 text-white/80" />;
    case 'audio':
      return <Volume1 className="w-6 h-6 text-white/80" />;
    default:
      return <ImageIcon className="w-6 h-6 text-white/80" />;
  }
};

export const SimpleMediaGrid: React.FC<SimpleMediaGridProps> = ({ 
  media, 
  loading, 
  onItemClick,
  getThumbnailUrl 
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 12 }).map((_, index) => (
          <Card key={index} className="aspect-square rounded-xl overflow-hidden animate-pulse bg-muted" />
        ))}
      </div>
    );
  }

  if (!media.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No media found</h3>
        <p className="text-muted-foreground">Upload some files to get started</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {media.map((item, index) => (
        <Card 
          key={item.id} 
          className="aspect-square rounded-xl overflow-hidden cursor-pointer hover:scale-105 transition-transform duration-200 relative group"
          onClick={(e) => onItemClick?.(item, e, index)}
        >
          <div className="relative w-full h-full overflow-hidden">
            <MediaThumbnail item={item} />
            
            {/* Processing status overlay */}
            {item.processing_status && item.processing_status !== 'processed' && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Badge 
                  variant={
                    item.processing_status === 'pending' ? 'secondary' :
                    item.processing_status === 'processing' ? 'default' : 
                    'destructive'
                  }
                  className="text-xs"
                >
                  {item.processing_status === 'pending' ? 'Processing...' :
                   item.processing_status === 'processing' ? 'Converting...' :
                   'Failed'}
                </Badge>
              </div>
            )}
            
            {/* Media type badge */}
            {item.media_type !== 'image' && (
              <div className="absolute top-2 right-2 bg-black/50 rounded-full p-1">
                <MediaTypeIcon type={item.media_type} />
              </div>
            )}
            
            {/* Title overlay on hover */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-white text-xs font-medium truncate">
                {item.title || item.original_filename}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};