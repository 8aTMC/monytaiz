import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Download, AtSign, Hash, FolderOpen, FileText, DollarSign, ChevronLeft, ChevronRight, Edit } from 'lucide-react';
import { SimpleMediaItem, useSimpleMedia } from '@/hooks/useSimpleMedia';
import { MentionsDialog } from './MentionsDialog';
import { TagsDialog } from './TagsDialog';
import { FolderSelectDialog } from './FolderSelectDialog';
import { DescriptionDialog } from './DescriptionDialog';
import { PriceDialog } from './PriceDialog';
import { EditTitleDialog } from './EditTitleDialog';
import { CustomAudioPlayer } from '@/components/CustomAudioPlayer';
import { EnhancedVideoPlayer } from '@/components/EnhancedVideoPlayer';
import { formatRevenue } from '@/lib/formatRevenue';

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
  
  // Dialog states
  const [mentionsDialogOpen, setMentionsDialogOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [foldersDialogOpen, setFoldersDialogOpen] = useState(false);
  const [descriptionDialogOpen, setDescriptionDialogOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [editTitleDialogOpen, setEditTitleDialogOpen] = useState(false);
  
  // Folder selection state
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  
  // Use the passed functions instead of creating a new useSimpleMedia instance
  const { getMediaFolders } = useSimpleMedia();
  
  // Update local item when prop changes
  useEffect(() => {
    setItem(propItem);
  }, [propItem]);

  useEffect(() => {
    if (!item || !isOpen) {
      setFullUrl(null);
      setSelectedFolders([]);
      return;
    }

    const loadUrl = async () => {
      if (!getFullUrlAsync || typeof getFullUrlAsync !== 'function') {
        console.error('getFullUrlAsync is not a function:', typeof getFullUrlAsync);
        setFullUrl(null);
        return;
      }

      setLoading(true);
      try {
        const url = await getFullUrlAsync(item);
        setFullUrl(url);
        
        // Load current folder assignments when opening
        if (item.id) {
          const folders = await getMediaFolders(item.id);
          setSelectedFolders(folders);
        }
      } catch (error) {
        console.error('Failed to load media URL:', error);
        setFullUrl(null);
      } finally {
        setLoading(false);
      }
    };

    loadUrl();
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

  const handleDownload = () => {
    if (fullUrl) {
      window.open(fullUrl, '_blank');
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Determine orientation and aspect ratio - increased sizes
  const isVertical = item?.width && item?.height && item.height > item.width;
  const aspectRatio = isVertical ? '9/16' : '16/9';
  const containerWidth = isVertical ? '500px' : '900px';
  const containerHeight = isVertical ? '889px' : '506px';

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
              minWidth: '400px'
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
                       className="flex items-center justify-center w-8 h-8 cursor-pointer rounded hover:bg-muted/50 transition-colors z-[220]"
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
                    {item.media_type || 'Unknown'}
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
               <div className="p-4">
                 {loading ? (
                   <div 
                     className="flex items-center justify-center text-muted-foreground bg-muted/20 rounded-lg"
                     style={{
                       width: containerWidth,
                       height: containerHeight,
                       aspectRatio: aspectRatio
                     }}
                   >
                     <div className="text-center">
                       <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                       <p>Loading media...</p>
                     </div>
                   </div>
                 ) : fullUrl ? (
                   <div 
                     className="flex items-center justify-center bg-muted/20 rounded-lg overflow-hidden"
                     style={{
                       width: containerWidth,
                       height: containerHeight,
                       aspectRatio: aspectRatio
                     }}
                   >
                     {item?.media_type === 'image' && (
                       <img
                         src={fullUrl}
                         alt={item.title || item.original_filename}
                         className="w-full h-full object-contain"
                         onError={(e) => {
                           console.error('Failed to load image:', e);
                           setFullUrl(null);
                         }}
                       />
                     )}
                      {item?.media_type === 'video' && (
                        <EnhancedVideoPlayer
                          src={fullUrl}
                          aspectRatio={aspectRatio}
                          className="w-full h-full"
                          onError={(e) => {
                            console.error('Failed to load video:', e);
                            setFullUrl(null);
                          }}
                        />
                      )}
                      {item?.media_type === 'audio' && (
                        <div className="flex items-center justify-center w-full h-full">
                          <CustomAudioPlayer
                            src={fullUrl}
                            title={item.title || item.original_filename}
                          />
                        </div>
                       )}
                    </div>
                  ) : (
                    <div 
                      className="flex items-center justify-center text-muted-foreground bg-muted/20 rounded-lg"
                      style={{
                        width: containerWidth,
                        height: containerHeight,
                        aspectRatio: aspectRatio
                      }}
                    >
                      <div className="text-center">
                        <Download className="w-12 h-12 mx-auto mb-4" />
                        <p>Media not available</p>
                      </div>
                    </div>
                   )}
                </div>

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
                     className="text-xs bg-green-500 border-green-500 text-white hover:bg-green-600 font-medium"
                     disabled
                   >
                     💰 {formatRevenue(item.revenue_generated_cents)}
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
        </>
      )}
    </>
  );
};