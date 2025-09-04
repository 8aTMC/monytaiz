import React from 'react';
import { Card } from '@/components/ui/card';
import { Play, Volume1, Image as ImageIcon } from 'lucide-react';
import { SimpleMediaItem } from '@/hooks/useSimpleMedia';
import { formatRevenue } from '@/lib/formatRevenue';

interface SimpleMediaGridProps {
  media: SimpleMediaItem[];
  loading: boolean;
  onItemClick: (item: SimpleMediaItem) => void;
  getThumbnailUrl: (item: SimpleMediaItem) => string | null;
}

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
        {Array.from({ length: 10 }).map((_, i) => (
          <Card key={i} className="aspect-square rounded-xl overflow-hidden animate-pulse bg-muted" />
        ))}
      </div>
    );
  }

  if (media.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No media found</h3>
        <p className="text-muted-foreground">Upload some files to get started</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {media.map((item) => {
        const thumbnailUrl = getThumbnailUrl(item);
        
        return (
          <Card
            key={item.id}
            className="aspect-square rounded-xl overflow-hidden cursor-pointer hover:scale-105 transition-transform duration-200 relative group"
            onClick={() => onItemClick(item)}
          >
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={item.title || item.original_filename}
                className="w-full h-full object-cover block media"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <MediaTypeIcon type={item.media_type} />
              </div>
            )}
            
            {/* Processing status indicator */}
            {item.processing_status === 'pending' && (
              <div className="absolute top-2 left-2 bg-amber-500/90 text-white px-2 py-1 rounded text-xs font-medium">
                Processing...
              </div>
            )}
            {item.processing_status === 'processing' && (
              <div className="absolute top-2 left-2 bg-blue-500/90 text-white px-2 py-1 rounded text-xs font-medium animate-pulse">
                Converting...
              </div>
            )}
            {item.processing_status === 'failed' && (
              <div className="absolute top-2 left-2 bg-red-500/90 text-white px-2 py-1 rounded text-xs font-medium">
                Failed
              </div>
            )}
            
            {/* Revenue badge - top right corner */}
            {item.revenue_generated_cents && item.revenue_generated_cents > 0 && (
              <div className="absolute top-2 right-2 bg-green-500/90 text-white px-2 py-1 rounded text-xs font-medium">
                {formatRevenue(item.revenue_generated_cents)}
              </div>
            )}
            
            {/* Media type indicator - positioned to avoid revenue badge overlap */}
            {item.media_type !== 'image' && (
              <div className={`absolute bg-black/50 rounded-full p-1 ${
                item.revenue_generated_cents && item.revenue_generated_cents > 0 
                  ? 'bottom-2 right-2' 
                  : 'top-2 right-2'
              }`}>
                <MediaTypeIcon type={item.media_type} />
              </div>
            )}
            
            {/* Title overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-white text-xs font-medium truncate">
                {item.title || item.original_filename}
              </p>
            </div>
          </Card>
        );
      })}
    </div>
  );
};