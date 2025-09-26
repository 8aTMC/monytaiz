import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { LibraryFiltersDialog } from '@/components/LibraryFiltersDialog';
import { MediaPreviewDialog } from '@/components/MediaPreviewDialog';
import { VirtualizedLibraryGrid } from '@/components/VirtualizedLibraryGrid';
import { MediaThumbnail } from '@/components/MediaThumbnail';
import { useLibraryData } from '@/hooks/useLibraryData';
import { LibraryFilterState } from '@/types/library-filters';
import { cn } from '@/lib/utils';
import { 
  Search, 
  Filter, 
  FolderOpen, 
  Image, 
  Video, 
  Music, 
  FileText,
  X,
  Check,
  Grid3X3,
  Eye,
  EyeOff
} from 'lucide-react';

interface MediaItem {
  id: string;
  title: string;
  origin: 'upload' | 'story' | 'livestream' | 'message';
  storage_path: string;
  mime: string;
  type: 'image' | 'video' | 'audio' | 'gif';
  size_bytes: number;
  tags: string[];
  mentions: string[];
  suggested_price_cents: number;
  revenue_generated_cents?: number;
  notes: string | null;
  creator_id: string;
  created_at: string;
  updated_at: string;
  tiny_placeholder?: string;
  thumbnail_path?: string;
  width?: number;
  height?: number;
}

interface ChatLibraryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAttachFiles: (files: MediaItem[]) => void;
  currentUserId: string;
  alreadySelectedFiles?: any[];
}

export const ChatLibraryDialog = ({ isOpen, onClose, onAttachFiles, currentUserId, alreadySelectedFiles = [] }: ChatLibraryDialogProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<MediaItem[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedCategory, setSelectedCategory] = useState('all-files');
  const [folders, setFolders] = useState<any[]>([]);
  const [showDefaultFolders, setShowDefaultFolders] = useState(true);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  
  // Define the preview item type to match MediaPreviewDialog
  type PreviewMediaItem = {
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
  };

  // Preview state
  const [previewItem, setPreviewItem] = useState<PreviewMediaItem | null>(null);
  
  // Advanced filters state
  const [advancedFilters, setAdvancedFilters] = useState<LibraryFilterState>(() => ({
    collaborators: [],
    tags: [],
    priceRange: [0, 1000000] // $0 to $10,000 in cents
  }));
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);

  // Default categories
  const defaultCategories = [
    { id: 'all-files', label: 'All Files', icon: Grid3X3, description: 'All media files' },
    { id: 'stories', label: 'Stories', icon: Image, description: 'Story content' },
    { id: 'messages', label: 'Messages', icon: FileText, description: 'Message attachments' }
  ];

  const {
    content: mediaData,
    loading,
    fetchContent: refreshData
  } = useLibraryData({
    selectedCategory: selectedCategory,
    searchQuery,
    selectedFilter: activeFilter,
    sortBy: sortBy,
    advancedFilters,
    currentUserId
  });

  const totalCount = mediaData.length;

  // Reset state when dialog opens and initialize with already selected files
  useEffect(() => {
    if (isOpen) {
      setShowDefaultFolders(true);
      setSelectedCategory('all-files');
      setActiveFilter('all');
      
      // Initialize selection with already attached files
      if (alreadySelectedFiles.length > 0) {
        const alreadySelectedIds = new Set(alreadySelectedFiles.map(file => file.id));
        setSelectedFiles(alreadySelectedIds);
        setSelectedItems(alreadySelectedFiles);
      }
    }
  }, [isOpen, alreadySelectedFiles]);

  // Load folders
  useEffect(() => {
    const loadFolders = async () => {
      try {
        const { data, error } = await supabase
          .from('file_folders')
          .select('*')
          .eq('creator_id', currentUserId)
          .order('name');
        
        if (error) throw error;
        setFolders(data || []);
      } catch (error) {
        console.error('Error loading folders:', error);
      }
    };

    if (isOpen) {
      loadFolders();
    }
  }, [isOpen, currentUserId]);

  // Ensure preview is fully reset when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setPreviewItem(null);
    }
  }, [isOpen]);

  // Helper function to select items in a range
  const selectItemsInRange = (startIndex: number, endIndex: number) => {
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);
    
    const newSelectedFiles = new Set(selectedFiles);
    const newSelectedItems = [...selectedItems];
    
    for (let i = minIndex; i <= maxIndex; i++) {
      const item = mediaData[i];
      if (item && !selectedFiles.has(item.id)) {
        newSelectedFiles.add(item.id);
        newSelectedItems.push(item);
      }
    }
    
    setSelectedFiles(newSelectedFiles);
    setSelectedItems(newSelectedItems);
  };

  const isAlreadyAttached = (fileId: string) => {
    return alreadySelectedFiles.some(file => file.id === fileId);
  };

  const handleFileSelection = (fileId: string, item: MediaItem, index: number, event?: React.MouseEvent) => {
    // Prevent deselection of already attached files
    if (isAlreadyAttached(fileId) && selectedFiles.has(fileId)) {
      return;
    }

    // Prevent text selection during range operations
    if (event && (event.shiftKey || event.altKey)) {
      event.preventDefault();
    }

    // Handle range selection with shift/alt + click
    if ((event?.shiftKey || event?.altKey) && lastSelectedIndex !== null) {
      selectItemsInRange(lastSelectedIndex, index);
      return;
    }

    const newSelectedFiles = new Set(selectedFiles);
    const newSelectedItems = [...selectedItems];

    if (selectedFiles.has(fileId)) {
      newSelectedFiles.delete(fileId);
      const itemIndex = newSelectedItems.findIndex(item => item.id === fileId);
      if (itemIndex > -1) {
        newSelectedItems.splice(itemIndex, 1);
      }
    } else {
      // Check if adding this file would exceed the limit (50 files)
      const totalSelected = selectedFiles.size + 1;
      if (totalSelected > 50) {
        return; // Don't add if it would exceed limit
      }
      
      newSelectedFiles.add(fileId);
      newSelectedItems.push(item);
    }

    setSelectedFiles(newSelectedFiles);
    setSelectedItems(newSelectedItems);
    setLastSelectedIndex(index);
  };

  const resetSelection = () => {
    setSelectedFiles(new Set());
    setSelectedItems([]);
  };

  const handleAttach = () => {
    // Only attach newly selected files (not already attached ones)
    const newlySelectedItems = selectedItems.filter(item => !isAlreadyAttached(item.id));
    onAttachFiles(newlySelectedItems);
    resetSelection();
    onClose();
  };

  const handleCancel = () => {
    resetSelection();
    onClose();
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      resetSelection();
      setPreviewItem(null);
      setFiltersDialogOpen(false);
      onClose();
    }
  };

  // Helper function to convert local MediaItem to MediaPreviewDialog MediaItem
  const convertToPreviewItem = (item: MediaItem) => {
    const { mentions, revenue_generated_cents, thumbnail_path, ...previewItem } = item;
    return previewItem;
  };

  const convertToPreviewItems = (items: MediaItem[]) => {
    return items.map(convertToPreviewItem);
  };

  const handleDoubleClick = async (item: MediaItem) => {
    setPreviewItem(convertToPreviewItem(item));
  };

  const handlePreviewClose = () => {
    setPreviewItem(null);
  };

  // Advanced filter handlers
  const handleFiltersChange = (newFilters: LibraryFilterState) => {
    setAdvancedFilters(newFilters);
  };

  const hasActiveFilters = 
    advancedFilters.collaborators.length > 0 || 
    advancedFilters.tags.length > 0 || 
    advancedFilters.priceRange[0] > 0 || 
    advancedFilters.priceRange[1] < 1000000;

  const getFileTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      case 'audio': return <Music className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getFileTypeCount = (type: string) => {
    return selectedItems.filter(item => item.type === type).length;
  };


  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="max-w-6xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Library</span>
            <div className="flex items-center gap-2">
              {selectedFiles.size > 0 && (
                <Badge variant="secondary">
                  {selectedFiles.size}/50 files
                </Badge>
              )}
              {alreadySelectedFiles.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {alreadySelectedFiles.length} attached
                </Badge>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex gap-4 min-h-0">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0 border-r">
            <div className="space-y-4">
              {/* Default Folders */}
              {showDefaultFolders && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Default Folders</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDefaultFolders(!showDefaultFolders)}
                      className="text-xs px-2 h-7 hover:bg-gradient-glass transition flex items-center gap-1"
                    >
                      <EyeOff className="h-3 w-3" />
                      <span>Hide</span>
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {defaultCategories.map((category) => (
                      <Button
                        key={category.id}
                        variant={selectedCategory === category.id ? 'secondary' : 'ghost'}
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => setSelectedCategory(category.id)}
                      >
                        <category.icon className="h-4 w-4 mr-2" />
                        {category.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {!showDefaultFolders && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Default Folders</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDefaultFolders(true)}
                      className="text-xs px-2 h-7 hover:bg-gradient-glass transition flex items-center gap-1"
                    >
                      <Eye className="h-3 w-3" />
                      <span>Show</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Custom Folders */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">My Folders</h4>
                <div className="space-y-1">
                  {folders.map((folder) => (
                    <Button
                      key={folder.id}
                      variant={selectedCategory === folder.id ? 'secondary' : 'ghost'}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setSelectedCategory(folder.id)}
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />
                      {folder.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className={cn("flex-1 flex flex-col min-h-0", previewItem ? "pointer-events-none select-none" : "")} aria-hidden={!!previewItem}>
            {/* Enhanced Header with Controls */}
            <div className="pb-4 border-b">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {/* Media Type Filter Tabs */}
                  <div className="flex bg-muted rounded-lg p-1">
                    {[
                      { filter: 'all', icon: Grid3X3, label: 'All files' },
                      { filter: 'image', icon: Image, label: 'Photos' },
                      { filter: 'video', icon: Video, label: 'Videos' },
                      { filter: 'audio', icon: Music, label: 'Audio' }
                    ].map(({ filter, icon: Icon, label }) => (
                      <Button
                        key={filter}
                        variant={activeFilter === filter ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveFilter(filter)}
                        className="px-3 py-1 text-xs"
                        aria-label={label}
                        title={label}
                      >
                        <Icon className="h-4 w-4" />
                      </Button>
                    ))}
                  </div>

                  {/* Advanced Filters Button */}
                  <Button
                    variant={hasActiveFilters ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFiltersDialogOpen(true)}
                    className="shrink-0"
                  >
                    <Filter className="h-4 w-4 mr-1" />
                    Filters
                    {hasActiveFilters && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-background/20 rounded">
                        {advancedFilters.collaborators.length + advancedFilters.tags.length + (advancedFilters.priceRange[0] > 0 || advancedFilters.priceRange[1] < 1000000 ? 1 : 0)}
                      </span>
                    )}
                  </Button>

                  {/* Search Field */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search files..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                </div>

                {/* Sort */}
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="name-asc">Name A-Z</SelectItem>
                    <SelectItem value="name-desc">Name Z-A</SelectItem>
                    <SelectItem value="size-desc">Largest First</SelectItem>
                    <SelectItem value="size-asc">Smallest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {totalCount} files
                </div>
                {selectedFiles.size > 0 && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    {getFileTypeCount('image') > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {getFileTypeCount('image')} <Image className="h-3 w-3 ml-1" />
                      </Badge>
                    )}
                    {getFileTypeCount('video') > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {getFileTypeCount('video')} <Video className="h-3 w-3 ml-1" />
                      </Badge>
                    )}
                    {getFileTypeCount('audio') > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {getFileTypeCount('audio')} <Music className="h-3 w-3 ml-1" />
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* File Grid */}
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="grid grid-cols-6 gap-4">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-6 gap-4">
                  {mediaData.map((item, index) => (
                     <div
                       key={item.id}
                       className={cn(
                         "relative aspect-square rounded-lg border-2 cursor-pointer transition-all hover:scale-105 select-none",
                         selectedFiles.has(item.id) 
                           ? isAlreadyAttached(item.id)
                             ? "border-green-500 bg-green-500/20"
                             : "border-primary bg-primary/10"
                           : "border-transparent hover:border-muted-foreground"
                       )}
                       onClick={(e) => handleFileSelection(item.id, item, index, e)}
                       onDoubleClick={() => handleDoubleClick(item)}
                       title="Click to select • Shift/Alt+click for range • Double-click to preview"
                     >
                       {/* Checkbox */}
                       <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
                         <Checkbox
                           checked={selectedFiles.has(item.id)}
                           onCheckedChange={() => handleFileSelection(item.id, item, index)}
                           className={cn(
                             "h-4 w-4 p-0 bg-background/80 border-2",
                             isAlreadyAttached(item.id) && selectedFiles.has(item.id) 
                               ? "data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                               : ""
                           )}
                           aria-label="Select file"
                           disabled={isAlreadyAttached(item.id) && selectedFiles.has(item.id)}
                         />
                       </div>

                       {/* Already Attached Label */}
                       {isAlreadyAttached(item.id) && (
                         <div className="absolute bottom-2 left-2 px-2 py-1 bg-green-500 text-white text-xs rounded-md z-10">
                           Attached
                         </div>
                       )}

                      {/* File Type Badge */}
                      <div className="absolute top-2 right-2 z-10">
                        <Badge variant="secondary" className="text-xs">
                          {getFileTypeIcon(item.type)}
                        </Badge>
                      </div>

                      {/* Preview */}
                      <div className="w-full h-full rounded-lg overflow-hidden">
                        <MediaThumbnail
                          item={item}
                          className="w-full h-full"
                          gridMode={true}
                          forceSquare={true}
                        />
                      </div>

                      {/* File Info */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2 rounded-b-lg">
                        <p className="text-xs truncate">{item.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Advanced Filters Dialog */}
        <LibraryFiltersDialog
          open={filtersDialogOpen}
          onOpenChange={(open) => setFiltersDialogOpen(open)}
          filters={advancedFilters}
          onFiltersChange={handleFiltersChange}
        />

        {/* Media Preview Dialog */}
        <MediaPreviewDialog
          open={!!previewItem}
          onOpenChange={(open) => !open && handlePreviewClose()}
          item={previewItem}
          allItems={convertToPreviewItems(mediaData)}
          selectedItems={selectedFiles}
          onToggleSelection={(id) => {
            const item = mediaData.find(i => i.id === id);
            if (item) {
              const index = mediaData.findIndex(i => i.id === id);
              handleFileSelection(id, item, index);
            }
          }}
          onItemChange={(item) => setPreviewItem(item)}
          selecting={true}
        />

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {selectedFiles.size > 0 && (
              <span>
                {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} selected
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button 
              onClick={handleAttach}
              disabled={selectedFiles.size === 0}
              className="min-w-[100px]"
            >
              <Check className="h-4 w-4 mr-2" />
              Attach ({selectedFiles.size})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};