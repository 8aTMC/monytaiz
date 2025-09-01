
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSimpleMedia, SimpleMediaItem } from '@/hooks/useSimpleMedia';
import { SimpleMediaPreviewAsync } from '@/components/SimpleMediaPreviewAsync';
import { LibrarySidebar } from '@/components/LibrarySidebar';
import { LibraryGrid } from '@/components/LibraryGrid';
import { LibrarySelectionToolbar } from '@/components/LibrarySelectionToolbar';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Database, MessageSquare, Zap, FileImage, Search, Folder } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMediaOperations } from '@/hooks/useMediaOperations';

export default function SimpleLibrary() {
  const { media, loading, error, fetchMedia, getFullUrlAsync } = useSimpleMedia();
  const [selectedItem, setSelectedItem] = useState<SimpleMediaItem | null>(null);
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
    const foldersToCount = folders || customFolders;
    if (!foldersToCount.length) return;

    try {
      const counts: Record<string, number> = {};
      
      // Fetch count for each folder
      await Promise.all(
        foldersToCount.map(async (folder) => {
          const { count, error } = await supabase
            .from('file_folder_contents')
            .select('*', { count: 'exact' })
            .eq('folder_id', folder.id);
          
          if (!error) {
            counts[folder.id] = count || 0;
          } else {
            console.error(`Error counting folder ${folder.id}:`, error);
            counts[folder.id] = 0;
          }
        })
      );
      
      setFolderCounts(counts);
    } catch (error: any) {
      console.error('Error refreshing folder counts:', error);
    }
  }, [customFolders]);
  
  // Media operations
  const { copyToCollection, loading: mediaOperationsLoading } = useMediaOperations({
    onRefreshNeeded: fetchMedia,
    onCountsRefreshNeeded: () => {
      fetchFolders();
      refreshFolderCounts();
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
  }, []);

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

  // Convert SimpleMediaItem to the format expected by LibraryGrid - stable conversion
  const convertedMedia = useMemo(() => {
    if (!media?.length) return [];
    
    return media.map(item => ({
      id: item.id,
      title: item.title,
      origin: 'upload' as const,
      storage_path: item.processed_path || '',
      mime: item.mime_type,
      type: item.media_type as 'image' | 'video' | 'audio',
      size_bytes: item.optimized_size_bytes || item.original_size_bytes,
      tags: item.tags || [],
      suggested_price_cents: 0,
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

  // Filter media based on current filters - optimized dependencies
  const filteredMedia = useMemo(() => {
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
          filtered = filtered.filter(item => folderContent.includes(item.id));
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
    
    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime();
        case 'oldest':
          return new Date(a?.created_at || 0).getTime() - new Date(b?.created_at || 0).getTime();
        case 'name':
          return (a?.title || '').localeCompare(b?.title || '');
        default:
          return 0;
      }
    });
    
    return sorted;
  }, [convertedMedia, searchQuery, selectedFilter, sortBy, selectedCategory, customFolders, folderContent]);

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
      
      // Copy to each selected folder
      for (const folderId of folderIds) {
        await copyToCollection(folderId, itemIds);
      }
      
      // Refresh folder counts and content after successful copy
      await refreshFolderCounts();
      
      // If currently viewing a folder that was copied to, refresh its content
      if (customFolders.some(folder => folder.id === selectedCategory) && folderIds.includes(selectedCategory)) {
        fetchFolderContent(selectedCategory);
      }
      
      handleClearSelection();
      
      toast({
        title: "Success",
        description: `Copied ${itemIds.length} item(s) to ${folderIds.length} folder(s)`,
      });
    } catch (error) {
      console.error('Copy error:', error);
    }
  }, [selectedItems, copyToCollection, handleClearSelection, toast, refreshFolderCounts, customFolders, selectedCategory, fetchFolderContent]);

  const handleDelete = useCallback(() => {
    // TODO: Implement delete functionality
    console.log('Delete selected items');
  }, []);

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
        <main className="pl-2 overflow-hidden md:pl-0">
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
                  {['All', 'Photo', 'Video', 'Audio'].map((filter) => (
                    <Button
                      key={filter}
                      variant={selectedFilter === filter ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => handleFilterChange(filter)}
                      className="px-3 py-1 text-xs"
                    >
                      {filter}
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

          {/* Scrollable Grid Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
            <div className="p-4">
              {/* Selection Toolbar - Conditional Rendering */}
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
                <LibraryGrid
                  content={filteredMedia}
                  selectedItems={selectedItems}
                  selecting={selecting}
                  onItemClick={handleItemClick}
                  onCheckboxClick={handleCheckboxClick}
                />
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
        />
      )}
    </>
  );
}
