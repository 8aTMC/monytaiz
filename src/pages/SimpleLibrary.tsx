
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
import { Database, MessageSquare, Zap, FileImage, Search } from 'lucide-react';

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

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

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

  // Folder management handlers - stable empty functions
  const handleFolderCreated = useCallback(() => {
    // TODO: Implement folder creation refresh
  }, []);

  const handleFolderUpdated = useCallback(() => {
    // TODO: Implement folder update refresh  
  }, []);

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
    <Layout>
      <div className="flex h-full min-h-screen">
        {/* Sidebar */}
        <LibrarySidebar
          defaultCategories={defaultCategories}
          customFolders={[]}
          selectedCategory={selectedCategory}
          categoryCounts={categoryCounts}
          onCategorySelect={handleCategorySelect}
          onFolderCreated={handleFolderCreated}
          onFolderUpdated={handleFolderUpdated}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Selection Toolbar */}
          {selecting && selectedItems.size > 0 && (
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
          )}

          {/* Header */}
          <div className="p-6 border-b border-border">
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
                      className="h-8"
                    >
                      {filter}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search content..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10 w-48"
                  />
                </div>

                {/* Sort */}
                <Select value={sortBy} onValueChange={handleSortChange}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto p-6">
            {error && (
              <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="text-sm text-destructive">
                  Error: {error}
                </div>
              </div>
            )}

            {/* Empty State */}
            {filteredMedia.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Database className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">No media found</h3>
                <p className="text-muted-foreground">
                  {searchQuery ? 'Try adjusting your search terms' : 'Upload some files to get started'}
                </p>
              </div>
            )}

            {/* Media Grid */}
            <LibraryGrid
              content={filteredMedia}
              selectedItems={selectedItems}
              selecting={selecting}
              onItemClick={handleItemClick}
              onCheckboxClick={handleCheckboxClick}
              loading={loading}
            />
          </div>
        </div>

        {/* Preview Modal */}
        <SimpleMediaPreviewAsync
          item={selectedItem}
          isOpen={isPreviewOpen}
          onClose={handlePreviewClose}
          getFullUrlAsync={getFullUrlAsync}
        />
      </div>
    </Layout>
  );
}
