
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSimpleMedia, SimpleMediaItem } from '@/hooks/useSimpleMedia';
import { SimpleMediaPreviewAsync } from '@/components/SimpleMediaPreviewAsync';
import { LibrarySidebar } from '@/components/LibrarySidebar';
import { LibraryGrid } from '@/components/LibraryGrid';
import { LibrarySelectionToolbar } from '@/components/LibrarySelectionToolbar';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Database, MessageSquare, Zap, FileImage, Search, Folder } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function SimpleLibrary() {
  const { media, loading, error, fetchMedia, getFullUrlAsync } = useSimpleMedia();
  const [selectedItem, setSelectedItem] = useState<SimpleMediaItem | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  // Selection state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  
  // Filter and search state
  const [selectedCategory, setSelectedCategory] = useState('all-files');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  
  // Folders state
  const [customFolders, setCustomFolders] = useState<any[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
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

  // Filter media based on current filters - optimized dependencies
  const filteredMedia = useMemo(() => {
    if (selectedCategory !== 'all-files') {
      return [];
    }
    
    if (!convertedMedia?.length) {
      return [];
    }
    
    let filtered = convertedMedia.filter(Boolean);
    
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
  }, [convertedMedia, searchQuery, selectedFilter, sortBy, selectedCategory]);

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
  const categoryCounts = useMemo(() => ({
    'all-files': media.length,
    'stories': 0,
    'livestreams': 0,
    'messages': 0
  }), [media.length]);

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
  }, []);

  const handleSelectAll = useCallback(() => {
    console.log('Select all');
    setSelectedItems(new Set(filteredMedia.map(item => item.id)));
  }, [filteredMedia]);

  // Stable item click handler
  const handleItemClick = useCallback((item: any, event: React.MouseEvent, index: number) => {
    console.log('Item clicked:', item.id, index);
    event.preventDefault();
    event.stopPropagation();
    
    if (selecting) {
      handleToggleItem(item.id);
    } else {
      // Find original item for preview
      const originalItem = media.find(m => m.id === item.id);
      if (originalItem) {
        setSelectedItem(originalItem);
        setIsPreviewOpen(true);
      }
    }
  }, [selecting, handleToggleItem, media]);

  const handleCheckboxClick = useCallback((itemId: string, index: number, event?: React.MouseEvent) => {
    console.log('Checkbox clicked:', itemId, index);
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    handleToggleItem(itemId);
    setSelecting(true);
  }, [handleToggleItem]);

  const handleCategorySelect = useCallback((categoryId: string) => {
    console.log('Category changed to:', categoryId);
    setSelectedCategory(categoryId);
    handleClearSelection();
  }, [handleClearSelection]);

  const handleCopy = useCallback((collectionIds: string[]) => {
    // TODO: Implement copy functionality
    console.log('Copy items to collections:', collectionIds);
  }, []);

  const handleDelete = useCallback(() => {
    // TODO: Implement delete functionality
    console.log('Delete selected items');
  }, []);

  return (
    <>
      <Layout>
        <div className="flex h-full overflow-hidden">
          {/* Sidebar - moved closer to navigation */}
          <LibrarySidebar
            defaultCategories={defaultCategories}
            customFolders={customFolders}
            selectedCategory={selectedCategory}
            categoryCounts={categoryCounts}
            onCategorySelect={handleCategorySelect}
            onFolderCreated={handleFolderCreated}
            onFolderUpdated={handleFolderUpdated}
          />

          {/* Main Content */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Selection Toolbar */}
            {selecting && selectedItems.size > 0 && (
              <div className="flex-shrink-0">
                <LibrarySelectionToolbar
                  selectedCount={selectedItems.size}
                  totalCount={filteredMedia.length}
                  currentView={selectedCategory}
                  isCustomFolder={false}
                  onClearSelection={handleClearSelection}
                  onSelectAll={handleSelectAll}
                  onCopy={handleCopy}
                  onDelete={handleDelete}
                />
              </div>
            )}

            {/* Header */}
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
                {loading ? (
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
                      {media.length === 0 ? 'No content yet' : 'No matches found'}
                    </h3>
                    <p className="text-muted-foreground">
                      {media.length === 0 
                        ? 'Upload some content to get started with your library.'
                        : 'Try adjusting your search or filter criteria.'
                      }
                    </p>
                  </div>
                ) : (
                  <LibraryGrid
                    content={convertedMedia}
                    selectedItems={selectedItems}
                    selecting={selecting}
                    onItemClick={handleItemClick}
                    onCheckboxClick={handleCheckboxClick}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </Layout>

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
