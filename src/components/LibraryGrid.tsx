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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-muted/20 rounded-lg animate-pulse" style={{ aspectRatio: '1' }}>
            <div className="w-full h-28"></div>
          </div>
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
      className="masonry-grid select-none"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: '0.75rem',
        gridAutoRows: 'min-content'
      }}
    >
      {content.map((item, index) => {
        // Create stable click handlers for each item
        const handleItemClick = (event: React.MouseEvent) => {
          console.log('Item clicked, detail:', event.detail, 'selecting:', selecting);
          if (selecting) {
            // In selection mode: single click selects/unselects, double click previews
            if (event.detail === 2) {
              console.log('Double click detected - opening preview');
              onItemClick(item, event, index);
            } else {
              console.log('Single click detected - selecting item');
              onCheckboxClick(item.id, index, event);
            }
          } else {
            // Default mode: single click previews
            onItemClick(item, event, index);
          }
        };
        
        const handleCheckboxClick = (event?: React.MouseEvent) => {
          if (event) {
            event.preventDefault();
            event.stopPropagation();
          }
          onCheckboxClick(item.id, index, event);
        };

        return (
          <Card 
            key={`${item.id}-${index}`}
            className={`group cursor-pointer relative overflow-hidden transition-all duration-300 hover:shadow-shadow-hover transform hover:-translate-y-1 ${
              selectedItems.has(item.id) 
                ? 'ring-2 ring-primary border-primary shadow-shadow-glow bg-gradient-selection' 
                : 'border border-border/50 hover:border-primary/30 bg-gradient-card hover:shadow-shadow-elevated'
            }`}
            onClick={handleItemClick}
          >
            {/* Enhanced Selection checkbox */}
            <div className="absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-all duration-300">
              <div 
                className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all duration-300 backdrop-blur-md ${
                  selectedItems.has(item.id) 
                    ? 'bg-gradient-primary border-white/30 text-white shadow-shadow-glow scale-110 opacity-100' 
                    : 'bg-black/30 border-white/40 hover:bg-black/50 hover:border-white/60 hover:scale-110'
                }`}
                onClick={handleCheckboxClick}
              >
                {selectedItems.has(item.id) && <Check className="h-4 w-4 font-bold" />}
              </div>
            </div>

            <CardContent className="p-0 relative overflow-hidden">
              {/* Enhanced Date badge */}
              <div className="absolute top-3 left-3 z-10 text-xs text-white bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 font-medium">
                {new Date(item.created_at).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </div>
              
              {/* Overlay gradient for better text readability */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40 z-5"></div>

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
              
              {/* Enhanced Categories with improved styling */}
              <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between">
                <div className="flex-1 mr-2">
                  <div className="text-xs text-white bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 truncate font-medium">
                    {(() => {
                      const defaultTags = ['upload', 'story', 'livestream', 'message'];
                      const customTags = item.tags.filter(tag => !defaultTags.includes(tag.toLowerCase()));
                      return customTags.length > 0 ? customTags.join(', ') : item.origin;
                    })()}
                  </div>
                </div>
                
                {/* File type indicator */}
                <div className="flex-shrink-0">
                  <div className={`w-2 h-2 rounded-full ${
                    item.type === 'video' ? 'bg-red-400' :
                    item.type === 'audio' ? 'bg-green-400' : 'bg-blue-400'
                  }`}></div>
                </div>
              </div>
              
              {/* Hover overlay effect */}
              <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-10 transition-opacity duration-300 z-5"></div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const LibraryGrid = React.memo(LibraryGridComponent);