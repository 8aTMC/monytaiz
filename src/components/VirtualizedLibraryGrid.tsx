import React, { memo, useMemo, useCallback, useRef, useEffect } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { Card, CardContent } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { MediaThumbnail } from '@/components/MediaThumbnail';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

interface MediaItem {
  id: string;
  title: string | null;
  origin: 'upload' | 'story' | 'livestream' | 'message';
  storage_path: string;
  mime: string;
  type: 'image' | 'video' | 'audio' | 'gif';
  size_bytes: number;
  tags: string[];
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

interface VirtualizedLibraryGridProps {
  items: MediaItem[];
  selectedItems: Set<string>;
  selecting: boolean;
  onItemClick: (item: MediaItem, event: React.MouseEvent, index: number) => void;
  onCheckboxClick: (itemId: string, index: number, event?: React.MouseEvent) => void;
  onLoadMore: () => void;
  hasNextPage: boolean;
  isLoadingMore: boolean;
  loading?: boolean;
  height?: number;
  debug?: boolean;
}

const ITEM_SIZE = 180; // Fixed item size for consistent grid
const GAP_SIZE = 12; // Gap between items

// Calculate responsive columns based on container width
const getColumnCount = (containerWidth: number): number => {
  if (containerWidth < 640) return 2; // mobile
  if (containerWidth < 768) return 3; // tablet
  if (containerWidth < 1024) return 4; // desktop
  if (containerWidth < 1280) return 5; // large desktop
  return 6; // extra large
};

interface GridItemData {
  items: MediaItem[];
  selectedItems: Set<string>;
  selecting: boolean;
  onItemClick: (item: MediaItem, event: React.MouseEvent, index: number) => void;
  onCheckboxClick: (itemId: string, index: number, event?: React.MouseEvent) => void;
  columnCount: number;
  debug?: boolean;
}

const GridItem = memo(({ 
  rowIndex, 
  columnIndex, 
  style, 
  data 
}: { 
  rowIndex: number; 
  columnIndex: number; 
  style: React.CSSProperties; 
  data: GridItemData 
}) => {
  const { items, selectedItems, selecting, onItemClick, onCheckboxClick, columnCount, debug } = data;
  const itemIndex = rowIndex * columnCount + columnIndex;
  const item = items[itemIndex];

  // Apply gap to style
  const itemStyle = {
    ...style,
    left: (style.left as number) + GAP_SIZE,
    top: (style.top as number) + GAP_SIZE,
    width: (style.width as number) - GAP_SIZE,
    height: (style.height as number) - GAP_SIZE,
  };

  if (!item) {
    // Show loading skeleton for items that are being loaded
    if (itemIndex < items.length + 30) { // Show skeletons for next batch
      return (
        <div style={itemStyle}>
          <Card className="h-full">
            <CardContent className="p-0 h-full">
              <Skeleton className="w-full h-full rounded-lg" />
            </CardContent>
          </Card>
        </div>
      );
    }
    return null;
  }

  const handleItemClick = (event: React.MouseEvent) => {
    if (selecting) {
      if (event.detail === 2) {
        onItemClick(item, event, itemIndex);
      } else if (event.detail === 1) {
        setTimeout(() => {
          onCheckboxClick(item.id, itemIndex, event);
        }, 200);
      }
    } else {
      onItemClick(item, event, itemIndex);
    }
  };

  const handleCheckboxClick = (event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    onCheckboxClick(item.id, itemIndex, event);
  };

  return (
    <div style={itemStyle}>
      <Card 
        className={`group cursor-pointer relative overflow-hidden transition-all duration-300 hover:shadow-shadow-hover h-full ${
          selectedItems.has(item.id) 
            ? 'ring-2 ring-primary border-primary shadow-shadow-glow bg-gradient-selection' 
            : 'hover:border-primary bg-gradient-card hover:shadow-shadow-elevated'
        }`}
        onClick={handleItemClick}
      >
        {/* Selection checkbox */}
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

        <CardContent className="p-0 relative overflow-hidden h-full">
          {/* Date badge */}
          <div className="absolute top-3 left-3 z-10 text-xs text-white bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 font-medium">
            {new Date(item.created_at).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric' 
            })}
          </div>
          
          {/* Overlay gradient */}
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
            className="w-full h-full"
          />
          
          {/* Tags */}
          <div className="absolute bottom-3 left-3 right-10 z-10">
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
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={`text-xs bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 truncate font-medium cursor-pointer ${
                        hasCustomTags ? 'text-white' : 'text-white/70'
                      }`}>
                        {displayText}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs break-words">{tooltipContent}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })()}
          </div>
          
          {/* Hover overlay effect */}
          <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-10 transition-opacity duration-300 z-5"></div>
        </CardContent>
      </Card>
    </div>
  );
});

GridItem.displayName = 'GridItem';

export const VirtualizedLibraryGrid = memo(({
  items,
  selectedItems,
  selecting,
  onItemClick,
  onCheckboxClick,
  onLoadMore,
  hasNextPage,
  isLoadingMore,
  loading = false,
  height,
  debug = false
}: VirtualizedLibraryGridProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState(1200);
  const [containerHeight, setContainerHeight] = React.useState(600);

  // Update container dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
        setContainerHeight(containerRef.current.offsetHeight);
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    // Use ResizeObserver for more accurate container size tracking
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
      resizeObserver.disconnect();
    };
  }, []);

  const columnCount = useMemo(() => getColumnCount(containerWidth), [containerWidth]);
  const rowCount = Math.ceil((items.length + (hasNextPage ? 30 : 0)) / columnCount);

  const itemData = useMemo<GridItemData>(() => ({
    items,
    selectedItems,
    selecting,
    onItemClick,
    onCheckboxClick,
    columnCount,
    debug
  }), [items, selectedItems, selecting, onItemClick, onCheckboxClick, columnCount, debug]);

  const isItemLoaded = useCallback((index: number) => {
    return index < items.length;
  }, [items.length]);

  const loadMoreItems = useCallback(() => {
    if (hasNextPage && !isLoadingMore) {
      onLoadMore();
    }
  }, [hasNextPage, isLoadingMore, onLoadMore]);

  // Use provided height or calculated height
  const gridHeight = height || containerHeight;

  if (loading) {
    return (
      <div ref={containerRef} className="w-full h-full">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i} className="aspect-square">
              <CardContent className="p-0 h-full">
                <Skeleton className="w-full h-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div ref={containerRef} className="flex items-center justify-center py-12 text-muted-foreground h-full">
        <div className="text-center">
          <p className="text-lg font-medium">No media found</p>
          <p className="text-sm">Try adjusting your filters or search terms</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full" style={{ height: gridHeight }}>
      <InfiniteLoader
        isItemLoaded={isItemLoaded}
        itemCount={hasNextPage ? items.length + 30 : items.length}
        loadMoreItems={loadMoreItems}
        threshold={5}
      >
        {({ onItemsRendered, ref }) => (
          <Grid
            ref={ref}
            height={gridHeight}
            width={containerWidth}
            columnCount={columnCount}
            rowCount={rowCount}
            columnWidth={Math.floor((containerWidth - GAP_SIZE * (columnCount + 1)) / columnCount)}
            rowHeight={ITEM_SIZE + GAP_SIZE}
            itemData={itemData}
            onItemsRendered={({
              visibleRowStartIndex,
              visibleRowStopIndex,
              visibleColumnStartIndex,
              visibleColumnStopIndex,
            }) => {
              onItemsRendered({
                overscanStartIndex: visibleRowStartIndex * columnCount,
                overscanStopIndex: visibleRowStopIndex * columnCount + visibleColumnStopIndex,
                visibleStartIndex: visibleRowStartIndex * columnCount + visibleColumnStartIndex,
                visibleStopIndex: visibleRowStopIndex * columnCount + visibleColumnStopIndex,
              });
            }}
            overscanRowCount={2}
            style={{ paddingLeft: GAP_SIZE, paddingTop: GAP_SIZE }}
            className="scrollbar-default"
          >
            {GridItem}
          </Grid>
        )}
      </InfiniteLoader>
      
      {/* Loading more indicator */}
      {isLoadingMore && (
        <div className="flex justify-center py-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span>Loading more...</span>
          </div>
        </div>
      )}
    </div>
  );
});

VirtualizedLibraryGrid.displayName = 'VirtualizedLibraryGrid';