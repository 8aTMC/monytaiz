import React from 'react';
import { useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { MediaThumbnail } from '@/components/MediaThumbnail';

interface MediaItem {
  id: string;
  title: string | null;
  origin: 'upload' | 'story' | 'livestream' | 'message';
  storage_path: string;
  mime: string;
  type: 'image' | 'video' | 'audio';
  size_bytes: number;
  tags: string[];
  suggested_price_cents: number;
  notes: string | null;
  creator_id: string;
  created_at: string;
  updated_at: string;
  tiny_placeholder?: string;
  width?: number;
  height?: number;
}

interface LibraryGridProps {
  content: MediaItem[];
  selectedItems: Set<string>;
  selecting: boolean;
  onItemClick: (item: MediaItem, event: React.MouseEvent, index: number) => void;
  onCheckboxClick: (itemId: string, index: number, event?: React.MouseEvent) => void;
  loading?: boolean;
}

const LibraryGridComponent = ({
  content,
  selectedItems,
  selecting,
  onItemClick,
  onCheckboxClick,
  loading = false
}: LibraryGridProps) => {
  const gridContainerRef = useRef<HTMLDivElement>(null);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square bg-muted/20 rounded-lg animate-pulse"></div>
        ))}
      </div>
    );
  }

  if (content.length === 0) {
    return null;
  }

  return (
    <div 
      ref={gridContainerRef}
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1 select-none"
    >
      {content.map((item, index) => {
        // Create stable click handlers for each item
        const handleItemClick = (event: React.MouseEvent) => {
          onItemClick(item, event, index);
        };
        
        const handleCheckboxClick = (event?: React.MouseEvent) => {
          onCheckboxClick(item.id, index, event);
        };

        return (
          <Card 
            key={`${item.id}-${index}`}
            className={`group cursor-pointer border border-border hover:border-primary/50 transition-colors ${
              selectedItems.has(item.id) ? 'ring-1 ring-primary border-primary' : ''
            }`}
            onClick={handleItemClick}
          >
            {/* Selection checkbox */}
            <div className="absolute top-2 right-2 z-10">
              <div 
                className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  selectedItems.has(item.id) 
                    ? 'bg-primary border-primary text-primary-foreground' 
                    : 'bg-background/80 border-muted-foreground backdrop-blur-sm'
                }`}
                onClick={handleCheckboxClick}
              >
                {selectedItems.has(item.id) && <Check className="h-3 w-3" />}
              </div>
            </div>

            <CardContent className="p-0 relative">
              {/* Date */}
              <div className="absolute top-2 left-2 z-10 text-xs text-white bg-black/50 rounded px-1.5 py-0.5">
                {new Date(item.created_at).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </div>

              {/* Thumbnail */}
              <MediaThumbnail 
                item={{
                  type: item.type,
                  storage_path: item.storage_path,
                  title: item.title,
                  tiny_placeholder: item.tiny_placeholder,
                  width: item.width,
                  height: item.height
                }}
              />
              
              {/* Categories */}
              <div className="absolute bottom-2 left-2 right-2 z-10">
                <div className="text-xs text-white bg-black/50 rounded px-1.5 py-0.5 truncate">
                  {(() => {
                    const defaultTags = ['upload', 'story', 'livestream', 'message'];
                    const customTags = item.tags.filter(tag => !defaultTags.includes(tag.toLowerCase()));
                    return customTags.length > 0 ? customTags.join(', ') : item.origin;
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const LibraryGrid = React.memo(LibraryGridComponent);