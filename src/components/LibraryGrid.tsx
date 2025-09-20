import React from 'react';
import { useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Folder } from 'lucide-react';
import { MediaThumbnail } from '@/components/MediaThumbnail';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MediaItem {
  id: string;
  title: string | null;
  origin: 'upload' | 'story' | 'livestream' | 'message';
  storage_path: string;
  mime: string;
  type: 'image' | 'video' | 'audio' | 'gif';
  size_bytes: number;
  tags: string[];
  folders?: string[]; // Folder names the media belongs to
  suggested_price_cents: number;
  notes: string | null;
  creator_id: string;
  created_at: string;
  updated_at: string;
  tiny_placeholder?: string;
  thumbnail_path?: string;
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
  debug?: boolean;
}

const LibraryGridComponent = ({
  content,
  selectedItems,
  selecting,
  onItemClick,
  onCheckboxClick,
  loading = false,
  debug = false
}: LibraryGridProps) => {
  const gridContainerRef = useRef<HTMLDivElement>(null);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-muted/20 rounded-xl overflow-hidden animate-pulse" style={{ aspectRatio: '1' }}>
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
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '0.75rem',
          gridAutoRows: 'min-content',
          alignItems: 'start'
        }}
      >
      {content.map((item, index) => {
        let clickTimeout: NodeJS.Timeout | null = null;
        
        // Create stable click handlers for each item
        const handleItemClick = (event: React.MouseEvent) => {
          if (selecting) {
            // In selection mode: single click selects/unselects, double click previews
            if (event.detail === 2) {
              // Double click - clear any pending single click and open preview
              if (clickTimeout) {
                clearTimeout(clickTimeout);
                clickTimeout = null;
              }
              onItemClick(item, event, index);
            } else if (event.detail === 1) {
              // Single click - delay execution to check for double click
              clickTimeout = setTimeout(() => {
                onCheckboxClick(item.id, index, event);
                clickTimeout = null;
              }, 200);
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
            className={`group cursor-pointer relative overflow-hidden transition-all duration-300 hover:shadow-shadow-hover ${
              selectedItems.has(item.id) 
                ? 'ring-2 ring-primary border-primary shadow-shadow-glow bg-gradient-selection' 
                : 'hover:border-primary bg-gradient-card hover:shadow-shadow-elevated'
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
                  id: item.id,
                  type: item.type,
                  storage_path: item.storage_path,
                  title: item.title,
                  tiny_placeholder: item.tiny_placeholder,
                  thumbnail_path: item.thumbnail_path,
                  width: item.width,
                  height: item.height
                }}
                debug={debug}
                forceSquare={true}
              />
              
              {/* Enhanced Categories and Folders with improved styling */}
              <div className="absolute bottom-3 left-3 right-10 z-10 space-y-1">
                {/* Folders */}
                {item.folders && item.folders.length > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-xs bg-blue-600/80 backdrop-blur-sm rounded-lg px-2 py-1 truncate font-medium cursor-pointer text-white">
                        <Folder className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">
                          {item.folders.length === 1 ? item.folders[0] : `${item.folders.length} folders`}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs break-words">
                        <strong>Folders:</strong> {item.folders.join(', ')}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}
                
                {/* Tags */}
                {(() => {
                  const defaultTags = ['upload', 'story', 'livestream', 'message'];
                  const customTags = item.tags.filter(tag => 
                    !defaultTags.includes(tag.toLowerCase()) && 
                    !tag.startsWith('folder:')
                  );
                  const displayText = customTags.length > 0 ? customTags.join(', ') : 'No Tags';
                  const hasCustomTags = customTags.length > 0;
                  const tooltipContent = hasCustomTags ? customTags.join(', ') : 'No Tags';
                  
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`text-xs bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 truncate font-medium cursor-pointer ${
                          hasCustomTags ? 'text-white' : 'text-white/70'
                        }`}>
                          {displayText}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs break-words">
                          <strong>Tags:</strong> {tooltipContent}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })()}
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