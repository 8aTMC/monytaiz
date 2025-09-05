import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogPortal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Image, Video, FileAudio, FileText, X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useSidebar } from '@/components/Navigation';
import { useProgressiveMediaLoading } from '@/hooks/useProgressiveMediaLoading';
import { useIntersectionPreloader } from '@/hooks/useIntersectionPreloader';
import { CustomAudioPlayer } from '@/components/CustomAudioPlayer';
import { SimpleAdaptiveVideoPlayer } from '@/components/SimpleAdaptiveVideoPlayer';

// Use the MediaItem interface from ContentLibrary
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

interface MediaPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MediaItem | null;
  allItems: MediaItem[];
  selectedItems: Set<string>;
  onToggleSelection: (id: string) => void;
  onItemChange?: (item: MediaItem) => void;
  selecting?: boolean;
}

export const MediaPreviewDialog = ({
  open,
  onOpenChange,
  item,
  allItems,
  selectedItems,
  onToggleSelection,
  onItemChange,
  selecting,
}: MediaPreviewDialogProps) => {
  // Comprehensive debug logging
  console.log('🔍 MediaPreviewDialog render:', { 
    selecting, 
    itemId: item?.id, 
    hasItem: !!item, 
    open,
    selectedItemsSize: selectedItems?.size || 0
  });
  
  const sidebar = useSidebar();
  const { 
    loadProgressiveMedia, 
    enhanceQuality, 
    getCurrentUrl, 
    currentQuality,
    loadingQuality,
    isLoading 
  } = useProgressiveMediaLoading();
  const { preloadForNavigation } = useIntersectionPreloader(allItems);
  
  // Disabled preloader for media preview
  // const { preloadMore } = useMediaPreloader(allItems, {
  //   initialBatchSize: 5,
  //   scrollBatchSize: 3,
  //   preloadDelay: 50
  // });

  // Navigation functions
  const getCurrentIndex = () => {
    return allItems.findIndex(i => i.id === item?.id);
  };

  const handlePrevious = () => {
    const currentIndex = getCurrentIndex();
    if (currentIndex > 0 && onItemChange) {
      const previousItem = allItems[currentIndex - 1];
      onItemChange(previousItem);
      // Preload navigation items for instant switching
      preloadForNavigation(previousItem.id, 'both');
    }
  };

  const handleNext = () => {
    const currentIndex = getCurrentIndex();
    if (currentIndex < allItems.length - 1 && onItemChange) {
      const nextItem = allItems[currentIndex + 1];
      onItemChange(nextItem);
      // Preload navigation items for instant switching
      preloadForNavigation(nextItem.id, 'both');
    }
  };

  const handleMediaClick = (e: React.MouseEvent) => {
    // Double click on media closes the dialog
    if (e.detail === 2) {
      onOpenChange(false);
    }
  };

  const getTypeValue = (type: string | any): string => {
    return typeof type === 'object' && type?.value ? type.value : type || 'unknown';
  };

  const getStoragePath = (path: string | any): string | null => {
    if (typeof path === 'string' && path.trim()) {
      // Database paths are like "processed/uuid.webp", edge function expects "content/processed/uuid.webp"
      const cleanPath = path.startsWith('content/') ? path : `content/${path}`;
      console.log('Storage path processed:', path, '->', cleanPath);
      return cleanPath;
    }
    if (typeof path === 'object' && path?.value && typeof path.value === 'string') {
      const pathStr = path.value;
      const cleanPath = pathStr.startsWith('content/') ? pathStr : `content/${pathStr}`;
      console.log('Storage path processed (object):', pathStr, '->', cleanPath);
      return cleanPath;
    }
    console.warn('Invalid storage path:', path);
    return null;
  };

  // Helper functions to handle data
  const getItemType = (item: MediaItem): string => {
    return item.type || 'unknown';
  };

  const getItemStoragePath = (item: MediaItem): string | null => {
    return getStoragePath(item.storage_path);
  };

  const getItemSize = (item: MediaItem): number => {
    return item.size_bytes || 0;
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-8 w-8" />;
      case 'video': return <Video className="h-8 w-8" />;
      case 'audio': return <FileAudio className="h-8 w-8" />;
      
      default: return <FileText className="h-8 w-8" />;
    }
  };

  // Stable media loading - prevent infinite loops
  useEffect(() => {
    if (!open || !item) return;
    
    const storagePath = getItemStoragePath(item);
    console.log('Loading media for item:', item.id, 'storagePath:', storagePath);
    
    if (!storagePath) {
      console.error('No storage path available for item:', item.id);
      return;
    }

    let isMounted = true;
    
    const loadMedia = async () => {
      try {
        console.log('Starting progressive media load for path:', storagePath);
        if (isMounted) {
          await loadProgressiveMedia(storagePath, item.tiny_placeholder);
        }
      } catch (error) {
        console.error('Failed to load media for item:', item.id, 'path:', storagePath, 'error:', error);
      }
    };

    loadMedia();

    return () => {
      isMounted = false;
    };
  }, [open, item?.id, item?.storage_path]); // Only depend on stable values

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const capitalizeFirstLetter = (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  const truncateFileName = (name: string, maxLength: number = 30): string => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength) + '...';
  };

  if (!item) return null;

  const typeValue = getItemType(item);
  const itemSize = getItemSize(item);

  // Dynamic sizing based on sidebar state
  const getModalSize = () => {
    if (sidebar.isCollapsed) {
      return "max-w-5xl"; // Larger when sidebar is collapsed
    }
    return "max-w-3xl"; // Smaller when sidebar is expanded
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        {/* Custom overlay that will properly cover everything */}
        <div 
          className="fixed inset-0 bg-black/80 z-[200]" 
          onClick={() => onOpenChange(false)}
        />
        <div className={`fixed left-[50%] top-[50%] z-[210] grid w-full ${getModalSize()} max-h-[90vh] translate-x-[-50%] translate-y-[-50%] gap-4 border-0 bg-background/95 backdrop-blur-sm p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg overflow-hidden`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getContentTypeIcon(typeValue)}
              {truncateFileName(item.title || "Untitled")}
              <div className="flex items-center gap-2 ml-2">
                <Badge variant="secondary">{capitalizeFirstLetter(typeValue)}</Badge>
                {itemSize > 0 && (
                  <Badge variant="outline">{formatFileSize(itemSize)}</Badge>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Media Actions Bar */}
          <div className="flex flex-wrap gap-2 pb-4 border-b border-border">
            <Button variant="outline" size="sm">
              @ Mentions
            </Button>
            <Button variant="outline" size="sm">
              Tags
            </Button>
            <Button variant="outline" size="sm">
              Folders
            </Button>
            <Button variant="outline" size="sm">
              Description
            </Button>
            <Button variant="outline" size="sm">
              Price: ${(item.suggested_price_cents / 100).toFixed(2)}
            </Button>
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-center w-full bg-muted/20 rounded-lg overflow-hidden">
              {/* Error handling */}
              {!getItemStoragePath(item) && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <X className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-2">No storage path available</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    This media item may have corrupted data or the file may be missing.
                  </p>
                </div>
              )}

              {getItemStoragePath(item) && (
                <>
                  {/* Show loading overlay only if no media available yet */}
                  {(isLoading && !getCurrentUrl()) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/10 rounded z-10">
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary/60"></div>
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    </div>
                  )}

                  {typeValue === 'image' && (
                    <div className="relative w-full" onClick={enhanceQuality}>
                      {/* Progressive image loading */}
                      {getCurrentUrl() ? (
                        <img 
                          src={getCurrentUrl()}
                          alt={item.title || 'Preview'} 
                          className="w-full h-auto object-contain rounded transition-all duration-300 max-h-[70vh]"
                          style={{
                            aspectRatio: item.width && item.height ? `${item.width}/${item.height}` : 'auto'
                          }}
                          onError={(e) => {
                            console.error('Failed to load image:', e);
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-64 bg-muted/20 rounded">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary/60"></div>
                        </div>
                      )}
                      
                      {/* Quality indicator */}
                      {getCurrentUrl() && (
                        <div className="absolute top-2 left-2 z-10">
                          <div className="flex items-center gap-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                            <div className={`w-2 h-2 rounded-full ${
                              currentQuality === 'high' ? 'bg-green-400' :
                              currentQuality === 'medium' ? 'bg-yellow-400' :
                              currentQuality === 'low' ? 'bg-orange-400' : 'bg-red-400'
                            }`} />
                            {currentQuality.toUpperCase()}
                            {loadingQuality && (
                              <div className="animate-spin w-3 h-3 border border-white/30 border-t-white rounded-full ml-1" />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {typeValue === 'video' && getCurrentUrl() && (
                    <SimpleAdaptiveVideoPlayer
                      src={getCurrentUrl()}
                      aspectRatio={item.width && item.height ? `${item.width}/${item.height}` : '16/9'}
                      className="max-h-[70vh]"
                      autoPlay={false}
                      onError={(e) => {
                        console.error('Failed to load secure video:', e);
                      }}
                    />
                  )}

                  {typeValue === 'audio' && getCurrentUrl() && (
                    <div className="flex flex-col items-center gap-4 p-8">
                      <FileAudio className="h-16 w-16 text-muted-foreground" />
                      <CustomAudioPlayer
                        src={getCurrentUrl()}
                        title={item.title || 'Audio File'}
                      />
                    </div>
                  )}

                  {typeValue !== 'image' && typeValue !== 'video' && typeValue !== 'audio' && (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                      {getContentTypeIcon(typeValue)}
                      <p className="text-muted-foreground mt-4 mb-2">No preview available</p>
                      <p className="text-sm text-muted-foreground">
                        This file type cannot be previewed directly.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Selection checkbox - positioned to avoid overlap with close button */}
          {selecting && (
            <div 
              className="absolute top-4 right-16 z-[220] bg-primary p-3 rounded-lg border-2 border-white shadow-2xl"
              onClick={(e) => {
                console.log('✅ Selection checkbox clicked for item:', item.id);
                e.stopPropagation();
                onToggleSelection(item.id);
              }}
            >
              <div className={`w-8 h-8 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                selectedItems.has(item.id)
                  ? 'bg-white border-white text-primary' 
                  : 'bg-transparent border-white text-white hover:bg-white/20'
              }`}>
                {selectedItems.has(item.id) && <Check className="h-6 w-6" />}
              </div>
            </div>
          )}

          {/* Navigation arrows */}
          {getCurrentIndex() > 0 && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-[220] bg-background/80 backdrop-blur-sm"
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          
          {getCurrentIndex() < allItems.length - 1 && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-[220] bg-background/80 backdrop-blur-sm"
              onClick={handleNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}

          {/* Close button */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-[220]"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </div>
      </DialogPortal>
    </Dialog>
  );
};