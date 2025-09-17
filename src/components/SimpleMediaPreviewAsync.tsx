import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Download, AtSign, Hash, FolderOpen, FileText, DollarSign, ChevronLeft, ChevronRight, Edit, Maximize } from 'lucide-react';
import { FullscreenImageViewer } from './FullscreenImageViewer';
import { SimpleMediaItem, useSimpleMedia } from '@/hooks/useSimpleMedia';
import { MentionsDialog } from './MentionsDialog';
import { TagsDialog } from './TagsDialog';
import { FolderSelectDialog } from './FolderSelectDialog';
import { DescriptionDialog } from './DescriptionDialog';
import { PriceDialog } from './PriceDialog';
import { EditTitleDialog } from './EditTitleDialog';
import { RevenueAnalyticsDialog } from './RevenueAnalyticsDialog';
import { CustomAudioPlayer } from '@/components/CustomAudioPlayer';
import { EnhancedVideoPlayer } from '@/components/EnhancedVideoPlayer';
import { formatRevenue } from '@/lib/formatRevenue';
import { supabase } from '@/integrations/supabase/client';

interface SimpleMediaPreviewAsyncProps {
  item: SimpleMediaItem | null;
  isOpen: boolean;
  onClose: () => void;
  getFullUrlAsync: (item: SimpleMediaItem) => Promise<string | null>;
  mediaItems?: SimpleMediaItem[];
  selectedIndex?: number;
  onPrevious?: () => void;
  onNext?: () => void;
  updateMediaMetadata: (mediaId: string, metadata: Partial<Pick<SimpleMediaItem, 'title' | 'description' | 'tags' | 'mentions' | 'suggested_price_cents'>>) => Promise<any>;
  addToFolders: (mediaId: string, folderIds: string[]) => Promise<void>;
  selecting?: boolean;
  selectedItems?: Set<string>;
  onToggleSelection?: (itemId: string) => void;
}

export const SimpleMediaPreviewAsync: React.FC<SimpleMediaPreviewAsyncProps> = ({
  item: propItem,
  isOpen,
  onClose,
  getFullUrlAsync,
  mediaItems = [],
  selectedIndex = 0,
  onPrevious,
  onNext,
  updateMediaMetadata,
  addToFolders,
  selecting = false,
  selectedItems = new Set(),
  onToggleSelection
}) => {
  // Local item state for instant updates
  const [item, setItem] = useState<SimpleMediaItem | null>(propItem);
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isUrlLoading, setIsUrlLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Dialog states
  const [mentionsDialogOpen, setMentionsDialogOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [foldersDialogOpen, setFoldersDialogOpen] = useState(false);
  const [descriptionDialogOpen, setDescriptionDialogOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [editTitleDialogOpen, setEditTitleDialogOpen] = useState(false);
  const [revenueAnalyticsDialogOpen, setRevenueAnalyticsDialogOpen] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  
  // Folder selection state
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  
  // Use the passed functions instead of creating a new useSimpleMedia instance
  const { getMediaFolders } = useSimpleMedia();
  
  // Update local item when prop changes
  useEffect(() => {
    console.log('SimpleMediaPreviewAsync: Item changed', { 
      oldId: item?.id, 
      newId: propItem?.id, 
      oldTitle: item?.title, 
      newTitle: propItem?.title 
    });
    
    // Set navigation state to prevent interaction
    if (item?.id !== propItem?.id) {
      setIsNavigating(true);
      setTimeout(() => setIsNavigating(false), 300);
    }
    
    setItem(propItem);
    // Clear URL immediately to prevent showing wrong content
    setFullUrl(null);
  }, [propItem]);

  useEffect(() => {
    // Cancel any pending operations
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Clear states immediately
    setFullUrl(null);
    setSelectedFolders([]);
    setIsUrlLoading(false);
    setLoading(false);
    
    if (!item || !isOpen) {
      return;
    }

    console.log('SimpleMediaPreviewAsync: Loading URL for item', { id: item.id, title: item.title });

    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const loadUrl = async () => {
      if (!getFullUrlAsync || typeof getFullUrlAsync !== 'function') {
        console.error('getFullUrlAsync is not a function:', typeof getFullUrlAsync);
        return;
      }

      setIsUrlLoading(true);
      setLoading(true);
      
      try {
        // Check if aborted before proceeding
        if (abortController.signal.aborted) return;
        
        let url = await getFullUrlAsync(item);
        
        // If no URL and it's a GIF, try direct signed URL as fallback
        if (!url && (item.media_type === 'gif' || item.mime_type === 'image/gif')) {
          console.log('🔄 GIF fallback: trying direct signed URL for', item.original_path);
          try {
            const { data } = await supabase.storage
              .from('content')
              .createSignedUrl(item.original_path.replace(/^content\//, ''), 3600);
            if (data?.signedUrl) {
              url = data.signedUrl;
              console.log('✅ GIF fallback successful');
            }
          } catch (error) {
            console.warn('⚠️ GIF fallback failed:', error);
          }
        }
        
        // Check if aborted after async operation
        if (abortController.signal.aborted) return;
        
        setFullUrl(url);
        
        // Load current folder assignments when opening
        if (item.id) {
          const folders = await getMediaFolders(item.id);
          if (!abortController.signal.aborted) {
            setSelectedFolders(folders);
          }
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error('Failed to load media URL:', error);
          setFullUrl(null);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsUrlLoading(false);
          setLoading(false);
        }
      }
    };

    loadUrl();
    
    // Cleanup function
    return () => {
      abortController.abort();
    };
  }, [item, isOpen, getFullUrlAsync, getMediaFolders]);

  // Metadata update handlers
  const handleMentionsChange = async (mentions: string[]) => {
    if (!item) return;
    try {
      // Update local state immediately for instant UI feedback
      setItem(prevItem => prevItem ? { ...prevItem, mentions } : null);
      
      await updateMediaMetadata(item.id, { mentions });
    } catch (error) {
      console.error('Error updating mentions:', error);
      // Revert on error
      setItem(prevItem => prevItem ? { ...prevItem, mentions: item.mentions } : null);
    }
  };

  const handleTagsChange = async (tags: string[]) => {
    if (!item) return;
    try {
      // Update local state immediately for instant UI feedback
      setItem(prevItem => prevItem ? { ...prevItem, tags } : null);
      
      await updateMediaMetadata(item.id, { tags });
    } catch (error) {
      console.error('Error updating tags:', error);
      // Revert on error
      setItem(prevItem => prevItem ? { ...prevItem, tags: item.tags } : null);
    }
  };

  const handleFoldersChange = async (folderIds: string[]) => {
    if (!item) return;
    try {
      await addToFolders(item.id, folderIds);
      setSelectedFolders(folderIds);
    } catch (error) {
      console.error('Error updating folders:', error);
    }
  };

  const handleDescriptionChange = async (description: string) => {
    if (!item) return;
    try {
      // Update local state immediately for instant UI feedback
      setItem(prevItem => prevItem ? { ...prevItem, description } : null);
      
      await updateMediaMetadata(item.id, { description });
    } catch (error) {
      console.error('Error updating description:', error);
      // Revert on error
      setItem(prevItem => prevItem ? { ...prevItem, description: item.description } : null);
    }
  };

  const handlePriceChange = async (price: number | null) => {
    if (!item) return;
    try {
      const suggested_price_cents = price ? Math.round(price * 100) : 0;
      
      // Update local state immediately for instant UI feedback
      setItem(prevItem => prevItem ? { ...prevItem, suggested_price_cents } : null);
      
      await updateMediaMetadata(item.id, { suggested_price_cents });
    } catch (error) {
      console.error('Error updating price:', error);
      // Revert on error
      setItem(prevItem => prevItem ? { ...prevItem, suggested_price_cents: item.suggested_price_cents } : null);
    }
  };

  const handleTitleChange = async (title: string) => {
    if (!item) return;
    try {
      // Update local state immediately for instant UI feedback
      setItem(prevItem => prevItem ? { ...prevItem, title } : null);
      
      await updateMediaMetadata(item.id, { title });
    } catch (error) {
      console.error('Error updating title:', error);
      // Revert on error
      setItem(prevItem => prevItem ? { ...prevItem, title: item.title } : null);
    }
  };

  if (!item) return null;

  const handleDownload = async () => {
    if (!fullUrl || !item) return;
    
    try {
      // Fetch the actual file blob
      const response = await fetch(fullUrl);
      if (!response.ok) throw new Error('Failed to fetch file');
      
      const blob = await response.blob();
      
      // Generate clean filename from original filename
      const originalFilename = item.original_filename || item.title || 'download';
      let cleanFilename = originalFilename;
      
      // Remove existing extension and add appropriate one
      const nameWithoutExt = cleanFilename.replace(/\.[^/.]+$/, '');
      
      // For processed images, use .webp extension
      if (item.media_type === 'image' && (item.processed_path || item.optimized_size_bytes)) {
        cleanFilename = `${nameWithoutExt}.webp`;
      } else if (item.media_type === 'video') {
        cleanFilename = `${nameWithoutExt}.mp4`; // Default to mp4 for processed videos
      } else {
        // Keep original extension or add generic one
        const originalExt = originalFilename.split('.').pop();
        cleanFilename = originalExt ? `${nameWithoutExt}.${originalExt}` : nameWithoutExt;
      }
      
      // Create download link
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = cleanFilename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Failed to download file:', error);
      // Fallback to original behavior
      window.open(fullUrl, '_blank');
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Calculate responsive dimensions based on viewport
  const isVertical = item?.width && item?.height && item.height > item.width;
  const isSquare = item?.width && item?.height && Math.abs(item.width - item.height) < 10;
  
  // Calculate available space (90vh modal - header ~120px - metadata ~100px)
  const availableHeight = 'calc(90vh - 220px)';
  const availableWidth = 'calc(90vw - 100px)';
  
  let containerStyle: React.CSSProperties;
  let aspectRatio: string;
  
  if (item?.width && item?.height) {
    aspectRatio = `${item.width}/${item.height}`;
  } else if (isSquare) {
    aspectRatio = '1/1';
  } else if (isVertical) {
    aspectRatio = '9/16';
  } else {
    aspectRatio = '16/9';
  }
  
  // Dedicated width for audio: make the player wider
  if (item?.media_type === 'audio') {
    containerStyle = {
      maxHeight: availableHeight,
      maxWidth: '90vw',
      width: 'min(90vw, 1000px)',
      height: 'auto'
    };
  } else if (isVertical) {
    // For vertical images/videos, limit height and calculate width proportionally
    containerStyle = {
      maxHeight: availableHeight,
      maxWidth: availableWidth,
      height: 'min(60vh, 600px)',
      width: '100%',
      aspectRatio: aspectRatio
    };
  } else if (isSquare) {
    // For square content, use minimum of available dimensions
    containerStyle = {
      maxHeight: availableHeight,
      maxWidth: availableWidth,
      height: 'min(50vh, 500px)',
      width: 'min(50vh, 500px)',
      aspectRatio: aspectRatio
    };
  } else {
    // For horizontal content, limit width and calculate height proportionally
    containerStyle = {
      maxHeight: availableHeight,
      maxWidth: availableWidth,
      width: 'min(80vw, 800px)',
      height: 'auto',
      aspectRatio: aspectRatio
    };
  }

  if (!isOpen) return null;

  return (
    <>
      {ReactDOM.createPortal(
        <>
          {/* Custom overlay that covers EVERYTHING including sidebar */}
          <div 
            className="media-overlay"
            onClick={onClose}
          />
          
          {/* Dialog content positioned above everything */}
          <div 
            className="media-dialog border bg-background shadow-lg rounded-lg overflow-hidden flex flex-col"
            style={{
              width: 'fit-content',
              height: 'fit-content',
              maxWidth: '90vw',
              maxHeight: '90vh',
              minWidth: '700px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sr-only" id="media-preview-description">
              Preview dialog for media file: {item?.title || item?.original_filename || 'Unknown file'}
            </div>
            
            {/* Header */}
            <div className="p-4 border-b">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold truncate">
                    {item?.title || item?.original_filename || 'Untitled'}
                  </h2>
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => {
                       console.log('Edit button clicked, opening dialog');
                       setEditTitleDialogOpen(true);
                     }}
                     className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                     aria-label="Edit title"
                   >
                     <Edit className="h-3 w-3" />
                   </Button>
                 </div>
                 <div className="flex items-center gap-2">
                   {/* Selection checkbox - only shown when selecting is active */}
                   {selecting && onToggleSelection && (
                      <div 
                        className="flex items-center justify-center w-8 h-8 cursor-pointer rounded hover:bg-muted/50 transition-colors z-[115]"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSelection(item.id);
                        }}
                      >
                       <Checkbox
                         checked={selectedItems.has(item.id)}
                         onChange={() => {}} // Handled by parent div onClick
                         className="h-4 w-4"
                       />
                     </div>
                   )}
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={handleDownload}
                     disabled={!fullUrl || loading}
                   >
                     <Download className="w-4 h-4" />
                   </Button>
                   <Button variant="ghost" size="sm" onClick={onClose}>
                     <X className="w-4 h-4" />
                   </Button>
                 </div>
              </div>
              
              {/* File Info Tags */}
              <div className="flex gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span className="font-medium">Type:</span>
                   <span className="capitalize bg-muted px-2 py-1 rounded text-xs">
                     {item.media_type === 'gif' ? 'GIF' : (item.media_type || 'Unknown')}
                   </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium">Size:</span>
                  <span className="bg-muted px-2 py-1 rounded text-xs">
                    {formatFileSize(item.optimized_size_bytes || item.original_size_bytes || 0)}
                  </span>
                </div>
              </div>
            </div>

             {/* Content */}
             <div className="flex-1 overflow-auto">
                 {/* Media Display with Fixed Aspect Ratio */}
                {loading || isNavigating ? (
                  <div className="p-4">
                    <div 
                      className="flex items-center justify-center text-muted-foreground bg-muted/20 rounded-lg"
                      style={containerStyle}
                    >
                       <div className="text-center">
                         <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                         <p>{isNavigating ? 'Loading next file...' : 'Loading media...'}</p>
                       </div>
                    </div>
                  </div>
                ) : fullUrl ? (
                   <div className="p-4">
                     <div 
                       key={`${item.id}-${selectedIndex}`}
                       className="flex items-center justify-center bg-muted/20 rounded-lg overflow-hidden"
                       style={containerStyle}
                     >
                       {(item?.media_type === 'image' || 
                         (item?.mime_type && (item.mime_type.startsWith('image/') || 
                          item.mime_type === 'image/heic' || item.mime_type === 'image/heif')) ||
                         (item?.original_filename && /\.(heic|heif|jpg|jpeg|png|gif|webp)$/i.test(item.original_filename))) && (
                         <div 
                           className="relative w-full h-full"
                           onMouseEnter={() => setIsHovering(true)}
                           onMouseLeave={() => setIsHovering(false)}
                         >
                           <img
                              src={fullUrl}
                              alt={item.title || item.original_filename}
                              className="w-full h-full object-contain object-center"
                              onError={async (e) => {
                                console.error('Failed to load image:', e, 'URL:', fullUrl, 'item:', item);
                                try {
                                  const isGif =
                                    item?.media_type === 'gif' ||
                                    item?.mime_type === 'image/gif' ||
                                    (item?.original_path && /\.gif$/i.test(item.original_path));
                                  const candidates: string[] = [];
                                  if (isGif && item?.original_path) candidates.push(item.original_path);
                                  if (item?.processed_path && !isGif) candidates.push(item.processed_path);
                                  if (item?.thumbnail_path) candidates.push(item.thumbnail_path);
                                  if (item?.original_path && !candidates.includes(item.original_path)) candidates.push(item.original_path);

                                  for (const p of candidates) {
                                    try {
                                      const cleanPath = p.replace(/^content\//, '');
                                      const { data, error } = await supabase.storage
                                        .from('content')
                                        .createSignedUrl(cleanPath, 3600);
                                      if (data?.signedUrl && !error) {
                                        console.log('✅ Fallback image URL generated:', data.signedUrl);
                                        setFullUrl(data.signedUrl);
                                        return;
                                      }
                                    } catch (innerErr) {
                                      console.warn('Fallback attempt failed for path:', p, innerErr);
                                    }
                                  }
                                } catch (fallbackError) {
                                  console.error('❌ Exception in fallback image URL generation:', fallbackError);
                                }
                                setFullUrl(null);
                              }}
                            />
                            <Button
                              variant="secondary"
                              size="default"
                              onClick={() => setFullscreenOpen(true)}
                              className="absolute bottom-3 right-3 bg-black backdrop-blur-sm text-white hover:bg-gray-800 border border-white/20 shadow-lg transition-all duration-200 z-10 ring-1 ring-white/10"
                            >
                              <Maximize className="w-4 h-4" />
                            </Button>
                         </div>
                       )}
                        {item?.media_type === 'video' && (
                          <EnhancedVideoPlayer
                            key={`video-${item.id}-${selectedIndex}-${fullUrl?.substring(0, 10)}`}
                            src={fullUrl}
                            aspectRatio={aspectRatio}
                            className="w-full h-full"
                            onError={async (e) => {
                              console.error('Failed to load video:', e, 'URL:', fullUrl);
                              console.log('Attempting fallback URL generation for video:', item);
                              
                              // Try direct fallback for videos
                              if (item?.processed_path || item?.original_path) {
                                try {
                                  const fallbackPath = item.processed_path || item.original_path;
                                  console.log('Generating fallback URL for path:', fallbackPath);
                                  
                                  // Generate direct signed URL as fallback
                                  const { data, error } = await supabase.storage
                                    .from('content')
                                    .createSignedUrl(fallbackPath.replace(/^content\//, ''), 3600);
                                  
                                  if (data?.signedUrl && !error) {
                                    console.log('✅ Generated fallback video URL:', data.signedUrl);
                                    setFullUrl(data.signedUrl);
                                    return;
                                  } else {
                                    console.error('❌ Fallback URL generation failed:', error);
                                  }
                                } catch (fallbackError) {
                                  console.error('❌ Exception in fallback URL generation:', fallbackError);
                                }
                              }
                              
                              // If all fails, set to null
                              setFullUrl(null);
                            }}
                          />
                        )}
                        {item?.media_type === 'audio' && (
                          <div className="flex items-center justify-center w-full">
                            <CustomAudioPlayer
                              key={`audio-${item.id}-${selectedIndex}-${fullUrl?.substring(0, 10)}`}
                              src={fullUrl}
                              title={item?.title || item?.original_filename}
                              className="w-full"
                              onError={async (e) => {
                                console.error('Failed to load audio:', e, 'URL:', fullUrl);
                                console.log('Attempting fallback URL generation for audio:', item);
                                
                                // Try direct fallback for audio
                                if (item?.original_path || item?.processed_path) {
                                  try {
                                    const fallbackPath = item.original_path || item.processed_path;
                                    console.log('Generating fallback URL for audio path:', fallbackPath);
                                    
                                    // Generate direct signed URL as fallback
                                    const { data, error } = await supabase.storage
                                      .from('content')
                                      .createSignedUrl(fallbackPath.replace(/^content\//, ''), 3600);
                                    
                                    if (data?.signedUrl && !error) {
                                      console.log('✅ Generated fallback audio URL:', data.signedUrl);
                                      setFullUrl(data.signedUrl);
                                      return;
                                    } else {
                                      console.error('❌ Audio fallback URL generation failed:', error);
                                    }
                                  } catch (fallbackError) {
                                    console.error('❌ Exception in audio fallback URL generation:', fallbackError);
                                  }
                                }
                                
                                // If all fails, set to null
                                setFullUrl(null);
                              }}
                            />
                          </div>
                         )}
                     </div>
                   </div>
                 ) : (
                  <div 
                    className="flex items-center justify-center text-muted-foreground bg-muted/20 rounded-lg h-full m-4"
                    style={{ minHeight: '60vh' }}
                  >
                    <div className="text-center">
                      <Download className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg">Media not available</p>
                      <p className="text-sm opacity-70 mt-2">
                        {item?.mime_type === 'image/heic' || item?.mime_type === 'image/heif' ? 
                          'HEIC conversion may be processing...' : 
                          'Unable to load media file'
                        }
                      </p>
                    </div>
                  </div>
                 )}

                {/* Navigation arrows */}
                {mediaItems.length > 1 && selectedIndex > 0 && onPrevious && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-background/20 backdrop-blur-sm border-0 hover:bg-background/40"
                    onClick={onPrevious}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                )}
                
                {mediaItems.length > 1 && selectedIndex < mediaItems.length - 1 && onNext && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-background/20 backdrop-blur-sm border-0 hover:bg-background/40"
                    onClick={onNext}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                )}
             </div>

            {/* Metadata Editing Menu Bar */}
            {item && (
              <div className="p-4 border-t bg-background">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMentionsDialogOpen(true)}
                    className="text-xs"
                  >
                    <AtSign className="w-3 h-3 mr-1" />
                    Mentions {(item.mentions?.length || 0) > 0 && `(${item.mentions?.length})`}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTagsDialogOpen(true)}
                    className="text-xs"
                  >
                    <Hash className="w-3 h-3 mr-1" />
                    Tags {(item.tags?.length || 0) > 0 && `(${item.tags?.length})`}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFoldersDialogOpen(true)}
                    className="text-xs"
                  >
                    <FolderOpen className="w-3 h-3 mr-1" />
                    Folders
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDescriptionDialogOpen(true)}
                    className="text-xs"
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    Description {item.description && item.description.length > 0 && '✓'}
                  </Button>
                  
                   <Button
                     variant="outline"
                     size="sm"
                     onClick={() => setPriceDialogOpen(true)}
                     className="text-xs"
                   >
                     <DollarSign className="w-3 h-3 mr-1" />
                     Price {item.suggested_price_cents && item.suggested_price_cents > 0 && `($${(item.suggested_price_cents / 100).toFixed(2)})`}
                   </Button>
                   
                   {/* Revenue Display Button */}
                   <Button
                     size="sm"
                     className="text-xs bg-green-500 border-green-500 text-white hover:bg-green-600 font-medium opacity-100"
                     onClick={() => setRevenueAnalyticsDialogOpen(true)}
                   >
                     Revenue 💰 {formatRevenue(item.revenue_generated_cents)}
                   </Button>
                 </div>

                {/* Show current metadata values */}
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {item.mentions && item.mentions.length > 0 && (
                    <div>
                      <span className="font-medium">Mentions:</span> {item.mentions.join(', ')}
                    </div>
                  )}
                  {item.tags && item.tags.length > 0 && (
                    <div>
                      <span className="font-medium">Tags:</span> {item.tags.join(', ')}
                    </div>
                  )}
                  {item.description && (
                    <div>
                      <span className="font-medium">Description:</span> {item.description.length > 60 ? `${item.description.substring(0, 60)}...` : item.description}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>,
        document.body
      )}
      
      {/* All metadata editing dialogs - rendered outside the media preview portal */}
      {item && (
        <>
          <MentionsDialog
            open={mentionsDialogOpen}
            onOpenChange={setMentionsDialogOpen}
            mentions={item.mentions || []}
            onMentionsChange={handleMentionsChange}
          />
          
          <TagsDialog
            open={tagsDialogOpen}
            onOpenChange={setTagsDialogOpen}
            tags={item.tags || []}
            onTagsChange={handleTagsChange}
          />
          
          <FolderSelectDialog
            open={foldersDialogOpen}
            onOpenChange={setFoldersDialogOpen}
            selectedFolders={selectedFolders}
            onFoldersChange={handleFoldersChange}
          />
          
          <DescriptionDialog
            open={descriptionDialogOpen}
            onOpenChange={setDescriptionDialogOpen}
            description={item.description || ''}
            onDescriptionChange={handleDescriptionChange}
          />
          
          <PriceDialog
            open={priceDialogOpen}
            onOpenChange={setPriceDialogOpen}
            price={item.suggested_price_cents ? item.suggested_price_cents / 100 : null}
            onPriceChange={handlePriceChange}
          />
          
          <EditTitleDialog
            open={editTitleDialogOpen}
            onOpenChange={setEditTitleDialogOpen}
            title={item.title || ''}
            onTitleChange={handleTitleChange}
          />
          
          <RevenueAnalyticsDialog
            open={revenueAnalyticsDialogOpen}
            onOpenChange={setRevenueAnalyticsDialogOpen}
            mediaId={item.id}
            mediaTitle={item.title || 'Untitled Media'}
          />
          
          <FullscreenImageViewer
            isOpen={fullscreenOpen}
            onClose={() => setFullscreenOpen(false)}
            imageUrl={fullUrl || ''}
            title={item.title || item.original_filename || 'Media preview'}
          />
        </>
      )}
    </>
  );
};