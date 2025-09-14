
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSimpleMedia, SimpleMediaItem } from '@/hooks/useSimpleMedia';
import { SimpleMediaPreviewAsync } from '@/components/SimpleMediaPreviewAsync';
import { LibrarySidebar } from '@/components/LibrarySidebar';
import { LibraryGrid } from '@/components/LibraryGrid';
import { LibrarySelectionToolbar } from '@/components/LibrarySelectionToolbar';
import { LibraryFiltersDialog } from '@/components/LibraryFiltersDialog';
import { SmartPreloadController } from '@/components/SmartPreloadController';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Database, MessageSquare, Zap, FileImage, Search, Folder, Filter, Grid3X3, Image, Video, Music } from 'lucide-react';
import { LibraryFilterState } from '@/types/library-filters';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMediaOperations } from '@/hooks/useMediaOperations';

export default function SimpleLibrary() {
  const { media, loading, error, fetchMedia, getFullUrlAsync, updateMediaMetadata, addToFolders } = useSimpleMedia();
  const [selectedItem, setSelectedItem] = useState<SimpleMediaItem | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  // Selection state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  
  // Filter and search state
  const [selectedCategory, setSelectedCategory] = useState('all-files');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  
  // Advanced filters state
  const [advancedFilters, setAdvancedFilters] = useState<LibraryFilterState>(() => {
    const saved = localStorage.getItem(`library-filters-${selectedCategory}`);
    return saved ? JSON.parse(saved) : {
      collaborators: [],
      tags: [],
      priceRange: [0, 1000000] // $0 to $10,000 in cents
    };
  });
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  
  // Folders state
  const [customFolders, setCustomFolders] = useState<any[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [folderContent, setFolderContent] = useState<string[]>([]);
  const [folderContentLoading, setFolderContentLoading] = useState(false);
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
  const { toast } = useToast();

  // Fetch folders from database
  const fetchFolders = useCallback(async () => {
    setFoldersLoading(true);
    try {
      const { data, error } = await supabase
        .from('file_folders')
        .select('*')
        .order('name');

      if (error) throw error;

      // Transform folders to match LibrarySidebar expected format
      const folders = data.map(folder => ({
        id: folder.id,
        label: folder.name,
        icon: Folder,
        description: folder.description || 'Custom folder',
        isDefault: false
      }));

      setCustomFolders(folders);
      
      // Fetch counts for all folders
      await refreshFolderCounts(folders);
    } catch (error: any) {
      console.error('Error fetching folders:', error);
      toast({
        title: "Error",
        description: "Failed to load folders",
        variant: "destructive",
      });
    } finally {
      setFoldersLoading(false);
    }
  }, [toast]);

  // Fetch counts for all custom folders
  const refreshFolderCounts = useCallback(async (folders?: any[]) => {
    console.log('Refreshing folder counts...');
    
    try {
      // If no folders provided, get the latest list from the database
      let foldersToCount = folders;
      if (!foldersToCount) {
        const { data: latestFolders, error: foldersError } = await supabase
          .from('file_folders')
          .select('id, name')
          .order('created_at', { ascending: false });
        
        if (foldersError) {
          console.error('Error fetching folders for count refresh:', foldersError);
          return;
        }
        
        foldersToCount = latestFolders || [];
      }
      
      if (!foldersToCount.length) {
        console.log('No folders to count');
        return;
      }

      const counts: Record<string, number> = {};
      
      // Fetch count for each folder with better error handling
      const countPromises = foldersToCount.map(async (folder) => {
        try {
          const { count, error } = await supabase
            .from('file_folder_contents')
            .select('*', { count: 'exact' })
            .eq('folder_id', folder.id);
          
          if (!error) {
            counts[folder.id] = count || 0;
            console.log(`Folder ${folder.name || folder.id}: ${count || 0} items`);
          } else {
            console.error(`Error counting folder ${folder.name || folder.id}:`, error);
            counts[folder.id] = 0;
          }
        } catch (err) {
          console.error(`Exception counting folder ${folder.name || folder.id}:`, err);
          counts[folder.id] = 0;
        }
      });
      
      await Promise.all(countPromises);
      
      console.log('Updated folder counts:', counts);
      setFolderCounts(counts);
    } catch (error: any) {
      console.error('Error refreshing folder counts:', error);
    }
  }, []); // Remove customFolders dependency to avoid race conditions
  
  // Media operations
  const { 
    loading: mediaOperationsLoading, 
    copyToCollection, 
    removeFromFolder,
    deleteMediaHard 
  } = useMediaOperations({
    onRefreshNeeded: fetchMedia,
    onCountsRefreshNeeded: (affectedFolderIds?: string[]) => {
      // Only refresh folder structure if new folders were created (affectedFolderIds indicates copy operation)
      if (affectedFolderIds?.length) {
        // For copy operations, refresh the specific folder counts
        refreshFolderCounts();
      } else {
        // For delete operations, only refresh counts without refetching folder structure  
        refreshFolderCounts();
      }
    }
  });

  useEffect(() => {
    fetchMedia();
    fetchFolders();
  }, [fetchMedia, fetchFolders]);

  // Stable event handlers
  const handlePreviewClose = useCallback(() => {
    console.log('Preview closed');
    setIsPreviewOpen(false);
    setSelectedItem(null);
    setSelectedIndex(0);
  }, []);

  const handlePrevious = useCallback(() => {
    if (selectedIndex > 0) {
      const newIndex = selectedIndex - 1;
      setSelectedIndex(newIndex);
      setSelectedItem(media[newIndex] || null);
    }
  }, [selectedIndex, media]);

  const handleNext = useCallback(() => {
    if (selectedIndex < media.length - 1) {
      const newIndex = selectedIndex + 1;
      setSelectedIndex(newIndex);
      setSelectedItem(media[newIndex] || null);
    }
  }, [selectedIndex, media]);

  const handleFilterChange = useCallback((filter: string) => {
    console.log('Filter changed to:', filter);
    setSelectedFilter(filter);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    console.log('Search changed to:', value);
    setSearchQuery(value);
  }, []);

  const handleSortChange = useCallback((sort: string) => {
    console.log('Sort changed to:', sort);
    setSortBy(sort);
  }, []);

  // Folder management handlers
  const handleFolderCreated = useCallback(() => {
    fetchFolders();
  }, [fetchFolders]);

  const handleFolderUpdated = useCallback(() => {
    fetchFolders();
  }, [fetchFolders]);

  // Convert SimpleMediaItem to the format expected by LibraryGrid - stable conversion with pre-computed data
  const convertedMedia = useMemo(() => {
    if (!media?.length) return [];
    
    console.log('Converting media items:', media.length);
    
    return media.map(item => ({
      id: item.id,
      title: item.title,
      origin: 'upload' as const,
      storage_path: item.processed_path || '',
      thumbnail_path: item.thumbnail_path,
      mime: item.mime_type,
      type: item.media_type as 'image' | 'video' | 'audio',
      size_bytes: item.optimized_size_bytes || item.original_size_bytes,
      tags: item.tags || [],
      suggested_price_cents: item.suggested_price_cents || 0, // Use actual price from source
      mentions: item.mentions || [], // Pre-compute mentions for filtering
      notes: item.description || null,
      creator_id: '',
      created_at: item.created_at,
      updated_at: item.created_at,
      width: item.width,
      height: item.height
    }));
  }, [media]);

  // Fetch folder content when folder is selected
  const fetchFolderContent = useCallback(async (folderId: string) => {
    setFolderContentLoading(true);
    try {
      const { data, error } = await supabase
        .from('file_folder_contents')
        .select('media_id')
        .eq('folder_id', folderId);

      if (error) throw error;
      
      const mediaIds = data.map(item => item.media_id);
      setFolderContent(mediaIds);
    } catch (error: any) {
      console.error('Error fetching folder content:', error);
      setFolderContent([]);
    } finally {
      setFolderContentLoading(false);
    }
  }, []);

  // Advanced filter handlers
  const handleFiltersChange = useCallback((newFilters: LibraryFilterState) => {
    setAdvancedFilters(newFilters);
    // Save filters per category
    localStorage.setItem(`library-filters-${selectedCategory}`, JSON.stringify(newFilters));
  }, [selectedCategory]);

  const hasActiveFilters = useMemo(() => {
    return advancedFilters.collaborators.length > 0 || 
           advancedFilters.tags.length > 0 || 
           advancedFilters.priceRange[0] > 0 || 
           advancedFilters.priceRange[1] < 1000000;
  }, [advancedFilters]);

  // Filter media based on current filters - optimized to prevent O(n²) operations
  const filteredMedia = useMemo(() => {
    console.log('Filtering media with advanced filters:', advancedFilters);
    
    if (!convertedMedia?.length) {
      return [];
    }
    
    let filtered = convertedMedia.filter(Boolean);
    
    // Handle folder filtering
    if (selectedCategory !== 'all-files') {
      // Check if it's a custom folder
      const isCustomFolder = customFolders.some(folder => folder.id === selectedCategory);
      if (isCustomFolder) {
        // Only show items in the selected folder if we have folder content loaded
        if (folderContent.length > 0) {
          const folderContentSet = new Set(folderContent);
          filtered = filtered.filter(item => folderContentSet.has(item.id));
        } else {
          // No content loaded yet, show empty
          return [];
        }
      } else {
        // For other categories (stories, livestreams, messages), return empty for now
        return [];
      }
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item?.title?.toLowerCase().includes(searchLower) ||
        item?.notes?.toLowerCase().includes(searchLower) ||
        item?.tags?.some(tag => tag?.toLowerCase().includes(searchLower))
      );
    }
    
    // Apply media type filter
    if (selectedFilter !== 'All') {
      filtered = filtered.filter(item => {
        switch (selectedFilter) {
          case 'Photo': return item?.type === 'image';
          case 'Video': return item?.type === 'video';
          case 'Audio': return item?.type === 'audio';
          default: return true;
        }
      });
    }

    // Apply advanced filters using pre-computed data
    if (hasActiveFilters) {
      // Filter by collaborators (using pre-computed mentions)
      if (advancedFilters.collaborators.length > 0) {
        const collaboratorSet = new Set(advancedFilters.collaborators);
        filtered = filtered.filter(item => {
          const mentions = (item as any).mentions || [];
          return mentions.some((mentionId: string) => collaboratorSet.has(mentionId));
        });
      }

      // Filter by tags
      if (advancedFilters.tags.length > 0) {
        const tagSet = new Set(advancedFilters.tags);
        filtered = filtered.filter(item => {
          const itemTags = item.tags || [];
          return itemTags.some(tag => tagSet.has(tag));
        });
      }

      // Filter by price range (using pre-computed price)
      if (advancedFilters.priceRange[0] > 0 || advancedFilters.priceRange[1] < 1000000) {
        filtered = filtered.filter(item => {
          const price = item.suggested_price_cents || 0;
          return price >= advancedFilters.priceRange[0] && price <= advancedFilters.priceRange[1];
        });
      }
    }
    
  // Apply sorting
  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime();
      case 'oldest':
        return new Date(a?.created_at || 0).getTime() - new Date(b?.created_at || 0).getTime();
      case 'name-asc':
        return (a?.title || '').localeCompare(b?.title || '', undefined, { numeric: true, sensitivity: 'base' });
      case 'name-desc':
        return (b?.title || '').localeCompare(a?.title || '', undefined, { numeric: true, sensitivity: 'base' });
      case 'size-desc':
        return (b?.size_bytes || 0) - (a?.size_bytes || 0);
      case 'size-asc':
        return (a?.size_bytes || 0) - (b?.size_bytes || 0);
      default:
        return 0;
    }
  });
    
    console.log(`Filtered ${convertedMedia.length} items down to ${sorted.length} items`);
    return sorted;
  }, [convertedMedia, searchQuery, selectedFilter, sortBy, selectedCategory, customFolders, folderContent, advancedFilters, hasActiveFilters]);

  // Default categories for sidebar - stable
  const defaultCategories = useMemo(() => [
    {
      id: 'all-files',
      label: 'All Files',
      icon: Database,
      description: 'All uploaded content',
      isDefault: true
    },
    {
      id: 'stories',
      label: 'Stories',
      icon: FileImage,
      description: 'Content uploaded to stories',
      isDefault: true
    },
    {
      id: 'livestreams',
      label: 'LiveStreams',
      icon: Zap,
      description: 'Past live stream videos',
      isDefault: true
    },
    {
      id: 'messages',
      label: 'Messages',
      icon: MessageSquare,
      description: 'Content sent in messages',
      isDefault: true
    }
  ], []);

  // Category counts - stable
  const categoryCounts = useMemo(() => {
    const counts = {
      'all-files': media.length,
      'stories': 0,
      'livestreams': 0,
      'messages': 0
    };
    
    // Add counts for custom folders from the folderCounts state
    customFolders.forEach(folder => {
      counts[folder.id] = folderCounts[folder.id] || 0;
    });
    
    return counts;
  }, [media.length, customFolders, folderCounts]);

  // Selection handlers - stable
  const handleToggleItem = useCallback((itemId: string) => {
    console.log('Toggle item:', itemId);
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    console.log('Clear selection');
    setSelectedItems(new Set());
    setSelecting(false);
    setLastSelectedIndex(null);
  }, []);

  const handleSelectAll = useCallback(() => {
    console.log('Select all');
    setSelectedItems(new Set(filteredMedia.map(item => item.id)));
  }, [filteredMedia]);

  // Stable item click handler
  const handleItemClick = useCallback((item: any, event: React.MouseEvent, index: number) => {
    console.log('Item clicked:', item.id, index, 'detail:', event.detail);
    event.preventDefault();
    event.stopPropagation();
    
    // Check if this is a double-click (force preview regardless of selection mode)
    if (event.detail === 2) {
      console.log('Double-click detected - forcing preview');
      const originalItem = media.find(m => m.id === item.id);
      if (originalItem) {
        const mediaIndex = media.findIndex(m => m.id === item.id);
        setSelectedIndex(mediaIndex >= 0 ? mediaIndex : 0);
        setSelectedItem(originalItem);
        setIsPreviewOpen(true);
      }
    } else if (selecting) {
      // Single click in selection mode - toggle selection
      handleToggleItem(item.id);
    } else {
      // Single click in normal mode - open preview
      const originalItem = media.find(m => m.id === item.id);
      if (originalItem) {
        const mediaIndex = media.findIndex(m => m.id === item.id);
        setSelectedIndex(mediaIndex >= 0 ? mediaIndex : 0);
        setSelectedItem(originalItem);
        setIsPreviewOpen(true);
      }
    }
  }, [selecting, handleToggleItem, media]);

  // Helper function to select items in a range
  const selectItemsInRange = useCallback((startIndex: number, endIndex: number) => {
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);
    
    const rangeIds = new Set<string>();
    for (let i = start; i <= end; i++) {
      if (filteredMedia[i]) {
        rangeIds.add(filteredMedia[i].id);
      }
    }
    
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      rangeIds.forEach(id => newSet.add(id));
      return newSet;
    });
  }, [filteredMedia]);

  const handleCheckboxClick = useCallback((itemId: string, index: number, event?: React.MouseEvent) => {
    console.log('Checkbox clicked:', itemId, index, 'Alt:', event?.altKey, 'Shift:', event?.shiftKey, 'LastIndex:', lastSelectedIndex);
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Check if Alt or Shift key is pressed for range selection
    if ((event?.altKey || event?.shiftKey) && lastSelectedIndex !== null && Math.abs(index - lastSelectedIndex) >= 0) {
      console.log('Range selection from', lastSelectedIndex, 'to', index);
      selectItemsInRange(lastSelectedIndex, index);
    } else {
      // Normal single item toggle
      handleToggleItem(itemId);
    }
    
    setLastSelectedIndex(index);
    setSelecting(true);
  }, [handleToggleItem, lastSelectedIndex, selectItemsInRange]);

  const handleCategorySelect = useCallback((categoryId: string) => {
    console.log('Category changed to:', categoryId);
    setSelectedCategory(categoryId);
    handleClearSelection();
    
    // Clear folder content first to avoid showing wrong content
    setFolderContent([]);
    
    // Load category-specific filters
    const saved = localStorage.getItem(`library-filters-${categoryId}`);
    if (saved) {
      setAdvancedFilters(JSON.parse(saved));
    } else {
      setAdvancedFilters({
        collaborators: [],
        tags: [],
        priceRange: [0, 1000000]
      });
    }
    
    // If selecting a custom folder, fetch its content
    const isCustomFolder = customFolders.some(folder => folder.id === categoryId);
    if (isCustomFolder) {
      fetchFolderContent(categoryId);
    }
  }, [handleClearSelection, customFolders, fetchFolderContent]);

  const handleCopy = useCallback(async (folderIds: string[]) => {
    if (selectedItems.size === 0 || folderIds.length === 0) {
      toast({
        title: "Error",
        description: "No items or folders selected",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const itemIds = Array.from(selectedItems);
      
      // Copy to each selected folder and wait for completion
      const copyResults = await Promise.all(
        folderIds.map(folderId => copyToCollection(folderId, itemIds))
      );
      
      // Small delay to ensure database transaction is fully committed
      await new Promise(resolve => setTimeout(resolve, 250));
      
      // Refresh folder counts after all copies are complete
      await refreshFolderCounts();
      
      // If currently viewing a folder that was copied to, refresh its content
      if (customFolders.some(folder => folder.id === selectedCategory) && folderIds.includes(selectedCategory)) {
        fetchFolderContent(selectedCategory);
      }
      
      handleClearSelection();
      
      toast({
        title: "Success",
        description: `Copied ${itemIds.length} item(s) to ${folderIds.length} folder(s)`,
        duration: 3000
      });
    } catch (error) {
      console.error('Copy error:', error);
      toast({
        title: "Error",
        description: "Failed to copy items. Please try again.",
        variant: "destructive",
        duration: 3000
      });
    }
  }, [selectedItems, copyToCollection, handleClearSelection, toast, refreshFolderCounts, customFolders, selectedCategory, fetchFolderContent]);

  const handleDelete = useCallback(async () => {
    if (!selectedItems.size) return;
    
    const itemIds = Array.from(selectedItems);
    const currentFolder = selectedCategory; // Track current folder when deletion starts
    const isCustomFolder = customFolders.some(folder => folder.id === selectedCategory);
    
    // Optimistic update - immediately clear selection and show success
    handleClearSelection();
    
    toast({
      title: "Success",
      description: `${isCustomFolder ? 'Removing' : 'Deleting'} ${itemIds.length} item(s)...`,
      duration: 3000
    });

    // Optimistic UI update - remove items from current view immediately
    if (isCustomFolder) {
      setFolderContent(prev => prev.filter(itemId => !itemIds.includes(itemId)));
      setFolderCounts(prev => ({
        ...prev,
        [selectedCategory]: Math.max(0, (prev[selectedCategory] || 0) - itemIds.length)
      }));
    } else {
      // For 'all' category, we'll just let the background refresh handle it
      // since useSimpleMedia doesn't expose setMedia
    }
    
    try {
      // Perform actual operation in background
      if (isCustomFolder) {
        // Just remove from folder - callbacks will handle refresh
        removeFromFolder(selectedCategory, itemIds);
      } else {
        // Permanently delete files - callbacks will handle refresh
        deleteMediaHard(itemIds);
      }
    } catch (error) {
      console.error('Delete error:', error);
      // Revert optimistic update on error
      if (isCustomFolder) {
        fetchFolderContent(selectedCategory);
        refreshFolderCounts();
      } else {
        fetchMedia();
      }
      
      toast({
        title: "Error",
        description: "Failed to delete items",
        variant: "destructive"
      });
    }
  }, [selectedItems, selectedCategory, removeFromFolder, deleteMediaHard, fetchFolderContent, refreshFolderCounts, fetchMedia, handleClearSelection, toast, customFolders, setFolderContent, setFolderCounts]);

  return (
    <>
      {/* Three-column layout: Navigation (fixed) | Library Directory | Main Content */}
      <div className="grid h-full grid-cols-[280px_1fr] gap-2 -ml-9 lg:grid-cols-[280px_1fr] md:grid-cols-1">
        {/* Library Directory Column */}
        <aside className="pr-2 border-r border-border overflow-y-auto md:border-r-0 md:border-b md:pb-4 md:pr-0">
          <LibrarySidebar
            defaultCategories={defaultCategories}
            customFolders={customFolders}
            selectedCategory={selectedCategory}
            categoryCounts={categoryCounts}
            onCategorySelect={handleCategorySelect}
            onFolderCreated={handleFolderCreated}
            onFolderUpdated={handleFolderUpdated}
          />
        </aside>
        
        {/* Main Content Column */}
        <main className="pl-2 md:pl-0 flex flex-col min-h-0">
          <div className="flex-shrink-0 p-4 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {selectedCategory === 'all-files' ? 'All Files' : 
                   selectedCategory === 'stories' ? 'Stories' :
                   selectedCategory === 'livestreams' ? 'LiveStreams' :
                   selectedCategory === 'messages' ? 'Messages' : 'Library'}
                </h1>
              </div>
            </div>

            {/* Filter Tabs and Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Media Type Filter Tabs */}
                <div className="flex bg-muted rounded-lg p-1">
                  {[
                    { filter: 'All', icon: Grid3X3, label: 'All files' },
                    { filter: 'Photo', icon: Image, label: 'Photos' },
                    { filter: 'Video', icon: Video, label: 'Videos' },
                    { filter: 'Audio', icon: Music, label: 'Audio' }
                  ].map(({ filter, icon: Icon, label }) => (
                    <Button
                      key={filter}
                      variant={selectedFilter === filter ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => handleFilterChange(filter)}
                      className="px-3 py-1 text-xs"
                      aria-label={label}
                      title={label}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  ))}
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search content..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-8 w-64"
                  />
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
              </div>

              {/* Sort */}
              <Select value={sortBy} onValueChange={handleSortChange}>
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
          </div>

          {/* Selection Toolbar - Sticky at top when selecting */}
          {selecting && selectedItems.size > 0 && (
            <LibrarySelectionToolbar
              selectedCount={selectedItems.size}
              totalCount={filteredMedia.length}
              currentView={selectedCategory}
              isCustomFolder={customFolders.some(folder => folder.id === selectedCategory)}
              onClearSelection={handleClearSelection}
              onSelectAll={handleSelectAll}
              onCopy={handleCopy}
              onDelete={handleDelete}
            />
          )}

          {/* Scrollable Grid Content */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-default">
            <div className="p-4 pt-0">
              {loading || folderContentLoading ? (
                <LibraryGrid
                  content={[]}
                  selectedItems={selectedItems}
                  selecting={selecting}
                  onItemClick={handleItemClick}
                  onCheckboxClick={handleCheckboxClick}
                  loading={true}
                />
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Database className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">Failed to load content</h3>
                  <p className="text-muted-foreground mb-4">There was an error loading your media library.</p>
                  <Button onClick={fetchMedia} variant="outline">
                    Try Again
                  </Button>
                </div>
              ) : filteredMedia.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <FileImage className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {media.length === 0 ? 'No content yet' : 
                     customFolders.some(folder => folder.id === selectedCategory) ? 'Folder is empty' : 
                     'No matches found'}
                  </h3>
                  <p className="text-muted-foreground">
                    {media.length === 0 
                      ? 'Upload some content to get started with your library.'
                      : customFolders.some(folder => folder.id === selectedCategory)
                      ? 'Copy some files to this folder to see them here.'
                      : 'Try adjusting your search or filter criteria.'
                    }
                  </p>
                </div>
              ) : (
                <SmartPreloadController
                  items={media.map(item => ({
                    id: item.id,
                    storage_path: item.processed_path || item.original_path,
                    type: item.media_type,
                    size: item.optimized_size_bytes || item.original_size_bytes,
                    priority: 'medium' as const
                  }))}
                  currentItemId={selectedItem?.id || ''}
                  maxCacheSize={100 * 1024 * 1024} // 100MB
                  enabled={true}
                  onPreloadProgress={(progress) => console.log('Preload progress:', progress)}
                  onCacheOptimized={() => console.log('Cache optimized')}
                >
                  <LibraryGrid
                    content={filteredMedia}
                    selectedItems={selectedItems}
                    selecting={selecting}
                    onItemClick={handleItemClick}
                    onCheckboxClick={handleCheckboxClick}
                  />
                </SmartPreloadController>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Preview Dialog - Rendered outside Layout to avoid stacking context issues */}
      {selectedItem && (
        <SimpleMediaPreviewAsync
          item={selectedItem}
          isOpen={isPreviewOpen}
          onClose={handlePreviewClose}
          getFullUrlAsync={getFullUrlAsync}
          mediaItems={media}
          selectedIndex={selectedIndex}
          onPrevious={handlePrevious}
          onNext={handleNext}
          updateMediaMetadata={updateMediaMetadata}
          addToFolders={addToFolders}
          selecting={selecting}
          selectedItems={selectedItems}
          onToggleSelection={handleToggleItem}
        />
      )}

      {/* Advanced Filters Dialog */}
      <LibraryFiltersDialog
        open={filtersDialogOpen}
        onOpenChange={setFiltersDialogOpen}
        filters={advancedFilters}
        onFiltersChange={handleFiltersChange}
      />
    </>
  );
}
