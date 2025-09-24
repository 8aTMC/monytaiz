import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogPortal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Image, Video, FileAudio, FileText, X, ChevronLeft, ChevronRight, Check, Play, Pause, Maximize, AtSign, Hash, FolderOpen, DollarSign, Edit } from 'lucide-react';
import { useSidebar } from '@/components/Navigation';
import { useProgressiveMediaLoading } from '@/hooks/useProgressiveMediaLoading';
import { useIntersectionPreloader } from '@/hooks/useIntersectionPreloader';
import { CustomAudioPlayer } from '@/components/CustomAudioPlayer';
import { EnhancedVideoPlayer } from '@/components/EnhancedVideoPlayer';
import { FullscreenImageViewer } from '@/components/FullscreenImageViewer';
import { MentionsDialog } from './MentionsDialog';
import { TagsDialog } from './TagsDialog';
import { FolderSelectDialog } from './FolderSelectDialog';
import { DescriptionDialog } from './DescriptionDialog';
import { PriceDialog } from './PriceDialog';
import { EditTitleDialog } from './EditTitleDialog';

// Use the MediaItem interface from ContentLibrary
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
  // Metadata props
  onMetadataUpdate?: (itemId: string, field: string, value: any) => void;
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
  onMetadataUpdate,
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
  const modalRef = useRef<HTMLDivElement>(null);
  const [needsScroll, setNeedsScroll] = useState(false);
  const [gifPlaying, setGifPlaying] = useState(true);
  const [gifNonce, setGifNonce] = useState(0);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  
  // Dialog states for metadata editing
  const [mentionsDialogOpen, setMentionsDialogOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [foldersDialogOpen, setFoldersDialogOpen] = useState(false);
  const [descriptionDialogOpen, setDescriptionDialogOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [editTitleDialogOpen, setEditTitleDialogOpen] = useState(false);
  
  // Local metadata state for immediate visual feedback
  const [currentMetadata, setCurrentMetadata] = useState({
    mentions: [] as string[],
    tags: [] as string[],
    folders: [] as string[],
    description: '',
    suggestedPrice: 0,
    title: ''
  });
  
  const { 
    loadProgressiveMedia, 
    enhanceQuality, 
    getCurrentUrl, 
    currentQuality,
    loadingQuality,
    isLoading,
    usingFallback
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
      // Close all metadata dialogs when navigating
      setMentionsDialogOpen(false);
      setTagsDialogOpen(false);
      setFoldersDialogOpen(false);
      setDescriptionDialogOpen(false);
      setPriceDialogOpen(false);
      setEditTitleDialogOpen(false);
    }
  };

  const handleNext = () => {
    const currentIndex = getCurrentIndex();
    if (currentIndex < allItems.length - 1 && onItemChange) {
      const nextItem = allItems[currentIndex + 1];
      onItemChange(nextItem);
      // Preload navigation items for instant switching
      preloadForNavigation(nextItem.id, 'both');
      // Close all metadata dialogs when navigating
      setMentionsDialogOpen(false);
      setTagsDialogOpen(false);
      setFoldersDialogOpen(false);
      setDescriptionDialogOpen(false);
      setPriceDialogOpen(false);
      setEditTitleDialogOpen(false);
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
      // Strip content/ prefix to avoid double prefixing - let edge function handle it
      let processedPath = path.replace(/^content\//, '');
      console.log('📁 Storage path normalized:', path, '->', processedPath);
      return processedPath;
    }
    if (typeof path === 'object' && path?.value && typeof path.value === 'string') {
      let processedPath = path.value.replace(/^content\//, '');
      console.log('📁 Storage path normalized (object):', path.value, '->', processedPath);
      return processedPath;
    }
    console.warn('❌ Invalid storage path:', path);
    return null;
  };

  // Helper functions to handle data
  const getItemType = (item: MediaItem): string => {
    // Check if this is a GIF based on MIME type or storage path
    if (item.mime === 'image/gif' || 
        item.storage_path?.toLowerCase().includes('.gif') ||
        (item.type === 'image' && item.storage_path?.toLowerCase().includes('.gif'))) {
      return 'gif';
    }
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
      case 'gif': return <Image className="h-8 w-8" />;
      case 'video': return <Video className="h-8 w-8" />;
      case 'audio': return <FileAudio className="h-8 w-8" />;
      
      default: return <FileText className="h-8 w-8" />;
    }
  };

  // Stable media loading - prevent infinite loops
  useEffect(() => {
    if (!open || !item) return;
    
    const storagePath = getItemStoragePath(item);
    console.log('🎬 Loading media for item:', item.id, 'storagePath:', storagePath);
    
    if (!storagePath) {
      console.error('❌ No storage path available for item:', item.id);
      return;
    }

    let isMounted = true;
    
    const derivedType = getItemType(item);
    const loadMedia = async () => {
      try {
        console.log('🚀 Starting progressive media load for path:', storagePath, 'derivedType:', derivedType);
        if (isMounted) {
          await loadProgressiveMedia(storagePath, item.tiny_placeholder, derivedType);
        }
      } catch (error) {
        console.error('❌ Failed to load media for item:', item.id, 'path:', storagePath, 'error:', error);
      }
    };

    loadMedia();

    return () => {
      isMounted = false;
    };
  }, [open, item?.id, item?.storage_path]); // Only depend on stable values

  // Sync metadata when item changes (navigation) or dialog opens
  useEffect(() => {
    if (open && item) {
      const latestMetadata = getCurrentMetadata();
      setCurrentMetadata(latestMetadata);
    }
  }, [open, item?.id, item?.tags, item?.notes, item?.suggested_price_cents, item?.title]);


  // Dynamic overflow detection - only show scroll when content truly overflows
  useEffect(() => {
    if (!open || !modalRef.current) return;

    const checkOverflow = () => {
      const modal = modalRef.current;
      if (!modal) return;

      const modalScrollHeight = modal.scrollHeight;
      const modalClientHeight = modal.clientHeight;
      const viewportHeight = window.innerHeight * 0.9; // 90vh max height
      
      // Only enable scroll if content actually overflows the modal bounds
      const contentOverflows = modalScrollHeight > modalClientHeight && modalClientHeight >= viewportHeight;
      setNeedsScroll(contentOverflows);
    };

    // Check overflow after content loads
    const timeoutId = setTimeout(checkOverflow, 200);
    
    // Also check on window resize
    window.addEventListener('resize', checkOverflow);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', checkOverflow);
    };
  }, [open, item, getCurrentUrl()]);

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

  // Helper function to get current metadata from item
  const getCurrentMetadata = () => {
    if (!item) {
      return {
        mentions: [] as string[],
        tags: [] as string[],
        folders: [] as string[],
        description: '',
        suggestedPrice: 0,
        title: ''
      };
    }
    
    return {
      mentions: [] as string[], // TODO: Add mentions support
      tags: item.tags || [],
      folders: [] as string[], // TODO: Add folders support  
      description: item.notes || '',
      suggestedPrice: item.suggested_price_cents || 0,
      title: item.title || ''
    };
  };

  // Metadata handlers
  const handleMetadataUpdate = (field: string, value: any) => {
    if (!item) return;
    
    // Update metadata state optimistically for immediate visual feedback
    setCurrentMetadata(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (onMetadataUpdate) {
      onMetadataUpdate(item.id, field, value);
    }
  };

  // Helper function to check if metadata exists - using local state for immediate feedback
  const hasMetadata = (field: string): boolean => {
    switch (field) {
      case 'mentions':
        return currentMetadata.mentions && currentMetadata.mentions.length > 0;
      case 'tags':
        return currentMetadata.tags && currentMetadata.tags.length > 0;
      case 'folders':
        return currentMetadata.folders && currentMetadata.folders.length > 0;
      case 'description':
        return currentMetadata.description && currentMetadata.description.trim().length > 0;
      case 'price':
        return currentMetadata.suggestedPrice && currentMetadata.suggestedPrice > 0;
      default:
        return false;
    }
  };

  if (!item) return null;

  const typeValue = getItemType(item);
  const itemSize = getItemSize(item);
  const isSelected = selectedItems.has(item.id);

  // Simple modal sizing based on sidebar state - no complex calculations
  const getModalMaxWidth = () => {
    const base = sidebar.isCollapsed ? 80 : 70;
    const isAudio = typeValue === 'audio';
    const adjusted = isAudio ? Math.min(base * 1.25, 90) : base; // cap at 90vw for safety
    return `${adjusted}vw`;
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        {/* Custom overlay that will properly cover everything */}
        <div 
          className="fixed inset-0 bg-black/80 z-[980]" 
          onClick={() => onOpenChange(false)}
        />
        <div 
          ref={modalRef}
          className={`fixed left-[50%] top-[50%] z-[990] grid translate-x-[-50%] translate-y-[-50%] gap-2 border-0 bg-background/95 backdrop-blur-sm p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg ${needsScroll ? 'overflow-y-auto' : 'overflow-hidden'}`}
          style={{ maxWidth: getModalMaxWidth(), maxHeight: '90vh' }}
        >
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
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setMentionsDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <AtSign className="h-4 w-4" />
              Mentions
              {hasMetadata('mentions') && <Check className="h-3 w-3 text-green-500" />}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setTagsDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Hash className="h-4 w-4" />
              Tags
              {hasMetadata('tags') && <Check className="h-3 w-3 text-green-500" />}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setFoldersDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <FolderOpen className="h-4 w-4" />
              Folders
              {hasMetadata('folders') && <Check className="h-3 w-3 text-green-500" />}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setDescriptionDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Description
              {hasMetadata('description') && <Check className="h-3 w-3 text-green-500" />}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setPriceDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <DollarSign className="h-4 w-4" />
              Price: ${((currentMetadata.suggestedPrice || 0) / 100).toFixed(2)}
              {hasMetadata('price') && <Check className="h-3 w-3 text-green-500" />}
            </Button>
            {onMetadataUpdate && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setEditTitleDialogOpen(true)}
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit Title
              </Button>
            )}
          </div>

          <div className="flex-1 flex items-center">
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
                          className="w-full h-auto object-contain rounded transition-all duration-300 max-h-[85vh]"
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
                            {usingFallback && <span className="text-xs opacity-75">(DIRECT)</span>}
                            {loadingQuality && (
                              <div className="animate-spin w-3 h-3 border border-white/30 border-t-white rounded-full ml-1" />
                            )}
                          </div>
                        </div>
                      )}

                      {/* Fullscreen toggle button - always visible and prominent */}
                      {getCurrentUrl() && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="secondary"
                                size="default"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFullscreenOpen(true);
                                }}
                                className="absolute top-3 right-3 z-20 bg-background/90 backdrop-blur-sm border-2 border-primary/20 shadow-lg hover:bg-background hover:border-primary/40 hover:scale-105 transition-all duration-200"
                              >
                                <Maximize className="w-5 h-5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>View fullscreen</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  )}

                  {typeValue === 'gif' && (
                    <div className="relative w-full">
                      {/* Direct GIF loading without progressive optimization + play/pause overlay */}
                      {(() => {
                        const gifUrl = getCurrentUrl();
                        const cacheBust = gifUrl ? (gifUrl.includes('?') ? `&t=${gifNonce}` : `?t=${gifNonce}`) : '';
                        const effectiveSrc = gifPlaying
                          ? (gifUrl ? `${gifUrl}${cacheBust}` : null)
                          : (item.tiny_placeholder || gifUrl);
                        return (
                          <>
                            {effectiveSrc ? (
                              <img
                                src={effectiveSrc}
                                alt={item.title || 'GIF Preview'}
                                className="w-full h-auto object-contain rounded transition-all duration-300 max-h-[85vh]"
                                style={{
                                  aspectRatio: item.width && item.height ? `${item.width}/${item.height}` : 'auto'
                                }}
                                loading="eager"
                                decoding="async"
                                draggable={false}
                                onError={(e) => {
                                  console.error('Failed to load GIF:', e);
                                }}
                              />
                            ) : (
                              <div className="flex items-center justify-center h-64 bg-muted/20 rounded">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary/60"></div>
                              </div>
                            )}

                            {/* Play/Pause control */}
                            {gifUrl && (
                              <div className="absolute bottom-4 left-4 z-20">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setGifPlaying((p) => !p);
                                    setGifNonce((n) => n + 1); // restart animation when toggling play
                                  }}
                                  aria-pressed={gifPlaying}
                                  aria-label={gifPlaying ? 'Pause GIF' : 'Play GIF'}
                                  className="bg-background/80 backdrop-blur-sm"
                                >
                                  {gifPlaying ? (
                                    <div className="flex items-center gap-2">
                                      <Pause className="h-4 w-4" />
                                      Pause
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <Play className="h-4 w-4" />
                                      Play
                                    </div>
                                  )}
                                </Button>
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* GIF indicator */}
                      {getCurrentUrl() && (
                        <div className="absolute top-2 left-2 z-10">
                          <div className="flex items-center gap-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                            <div className="w-2 h-2 rounded-full bg-purple-400" />
                            GIF
                            <span className="text-xs opacity-75">(ANIMATED)</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {typeValue === 'video' && (
                    getCurrentUrl() ? (
                      <EnhancedVideoPlayer
                        src={getCurrentUrl()}
                        className="w-full"
                        onError={(e) => {
                          console.error('Failed to load secure video:', e);
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-64 bg-muted/20 rounded">
                        <div className="flex flex-col items-center gap-2">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary/60"></div>
                          <p className="text-sm text-muted-foreground">Loading video...</p>
                        </div>
                      </div>
                    )
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

                  {typeValue !== 'image' && typeValue !== 'gif' && typeValue !== 'video' && typeValue !== 'audio' && (
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
              key={`checkbox-${item.id}`}
              className="absolute top-4 right-16 z-[115] bg-primary p-3 rounded-lg border-2 border-white shadow-2xl"
              onClick={(e) => {
                console.log('✅ Selection checkbox clicked for item:', item.id, 'current state:', isSelected);
                e.stopPropagation();
                e.preventDefault();
                onToggleSelection(item.id);
              }}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.stopPropagation();
                  e.preventDefault();
                  onToggleSelection(item.id);
                }
              }}
            >
              <div 
                role="checkbox"
                aria-checked={isSelected}
                tabIndex={0}
                className={`w-8 h-8 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-white border-white text-primary' 
                    : 'bg-transparent border-white text-white hover:bg-white/20'
                }`}>
                {isSelected && <Check className="h-6 w-6" />}
              </div>
            </div>
          )}

          {/* Navigation arrows */}
          {getCurrentIndex() > 0 && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-[115] bg-background/80 backdrop-blur-sm"
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          
          {getCurrentIndex() < allItems.length - 1 && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-[115] bg-background/80 backdrop-blur-sm"
              onClick={handleNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}

          {/* Close button */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-[115]"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </div>
      </DialogPortal>
      
      {/* Fullscreen Image Viewer */}
      <FullscreenImageViewer
        isOpen={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
        imageUrl={getCurrentUrl() || ''}
        title={item.title || 'Media preview'}
      />

      {/* Metadata Dialogs */}
      {item && (
        <>
          <MentionsDialog
            key={`mentions-${item.id}`}
            open={mentionsDialogOpen}
            onOpenChange={setMentionsDialogOpen}
            mentions={currentMetadata.mentions}
            onMentionsChange={(mentions) => handleMetadataUpdate('mentions', mentions)}
          />

          <TagsDialog
            key={`tags-${item.id}`}
            open={tagsDialogOpen}
            onOpenChange={setTagsDialogOpen}
            tags={currentMetadata.tags}
            onTagsChange={(tags) => handleMetadataUpdate('tags', tags)}
          />

          <FolderSelectDialog
            key={`folders-${item.id}`}
            open={foldersDialogOpen}
            onOpenChange={setFoldersDialogOpen}
            selectedFolders={currentMetadata.folders}
            onFoldersChange={(folders) => handleMetadataUpdate('folders', folders)}
          />

          <DescriptionDialog
            key={`description-${item.id}`}
            open={descriptionDialogOpen}
            onOpenChange={setDescriptionDialogOpen}
            description={currentMetadata.description}
            onDescriptionChange={(description) => handleMetadataUpdate('description', description)}
          />

          <PriceDialog
            key={`price-${item.id}`}
            open={priceDialogOpen}
            onOpenChange={setPriceDialogOpen}
            price={currentMetadata.suggestedPrice / 100}
            onPriceChange={(price) => handleMetadataUpdate('suggestedPrice', Math.round((price || 0) * 100))}
          />

          {onMetadataUpdate && (
            <EditTitleDialog
              key={`title-${item.id}`}
              open={editTitleDialogOpen}
              onOpenChange={setEditTitleDialogOpen}
              title={currentMetadata.title}
              onTitleChange={(title) => handleMetadataUpdate('title', title)}
            />
          )}
        </>
      )}
    </Dialog>
  );
};