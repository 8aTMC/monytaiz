import React, { useEffect, useState, useMemo } from 'react';
import { useSimpleMedia, SimpleMediaItem } from '@/hooks/useSimpleMedia';
import { SimpleMediaPreview } from '@/components/SimpleMediaPreview';
import { LibrarySidebar } from '@/components/LibrarySidebar';
import { LibraryGrid } from '@/components/LibraryGrid';
import { LibrarySelectionToolbar } from '@/components/LibrarySelectionToolbar';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Upload, Database, MessageSquare, Zap, FileImage, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SimpleLibrary() {
  const navigate = useNavigate();
  const { media, loading, error, fetchMedia, getThumbnailUrl, getFullUrl } = useSimpleMedia();
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

  const handlePreviewClose = () => {
    setIsPreviewOpen(false);
    setSelectedItem(null);
  };

  const handleRefresh = () => {
    fetchMedia();
  };

  const handleUpload = () => {
    navigate('/simple-upload');
  };

  // Convert SimpleMediaItem to the format expected by LibraryGrid
  const convertToLibraryFormat = (items: SimpleMediaItem[]) => {
    return items.map(item => ({
      id: item.id,
      title: item.title,
      origin: 'upload' as const,
      storage_path: item.processed_path || '', // Use processed_path, fallback to empty string
      mime: item.mime_type,
      type: item.media_type as 'image' | 'video' | 'audio',
      size_bytes: item.optimized_size_bytes || item.original_size_bytes,
      tags: item.tags || [],
      suggested_price_cents: 0,
      notes: item.description || null,
      creator_id: '', // Not available in SimpleMediaItem, use empty string
      created_at: item.created_at,
      updated_at: item.created_at, // Use created_at since updated_at not available
      width: item.width,
      height: item.height
    }));
  };

  // Filter media based on current filters
  const filteredMedia = useMemo(() => {
    let filtered = [...media];
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(item => 
        item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    // Apply media type filter
    if (selectedFilter !== 'All') {
      filtered = filtered.filter(item => {
        switch (selectedFilter) {
          case 'Photo': return item.media_type === 'image';
          case 'Video': return item.media_type === 'video';
          case 'Audio': return item.media_type === 'audio';
          default: return true;
        }
      });
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name':
          return (a.title || '').localeCompare(b.title || '');
        default:
          return 0;
      }
    });
    
    return convertToLibraryFormat(filtered);
  }, [media, searchQuery, selectedFilter, sortBy]);

  // Default categories for sidebar
  const defaultCategories = [
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
  ];

  const categoryCounts = {
    'all-files': media.length,
    'stories': 0,
    'livestreams': 0,
    'messages': 0
  };

  // Selection handlers
  const handleToggleItem = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleClearSelection = () => {
    setSelectedItems(new Set());
    setSelecting(false);
  };

  const handleSelectAll = () => {
    setSelectedItems(new Set(filteredMedia.map(item => item.id)));
  };

  const handleItemClick = (item: any, event: React.MouseEvent, index: number) => {
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      handleToggleItem(item.id);
      setSelecting(true);
    } else if (selecting) {
      handleToggleItem(item.id);
    } else {
      // Find original item for preview
      const originalItem = media.find(m => m.id === item.id);
      if (originalItem) {
        setSelectedItem(originalItem);
        setIsPreviewOpen(true);
      }
    }
  };

  const handleCheckboxClick = (itemId: string, index: number, event?: React.MouseEvent) => {
    event?.stopPropagation();
    handleToggleItem(itemId);
    setSelecting(true);
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    handleClearSelection();
  };

  const handleCopy = (collectionIds: string[]) => {
    // TODO: Implement copy functionality
    console.log('Copy items to collections:', collectionIds);
  };

  const handleDelete = () => {
    // TODO: Implement delete functionality
    console.log('Delete selected items');
  };

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
          onFolderCreated={() => {}}
          onFolderUpdated={() => {}}
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
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                
                <Button onClick={handleUpload}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </Button>
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
                      onClick={() => setSelectedFilter(filter)}
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
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-48"
                  />
                </div>

                {/* Sort */}
                <Select value={sortBy} onValueChange={setSortBy}>
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
        <SimpleMediaPreview
          item={selectedItem}
          isOpen={isPreviewOpen}
          onClose={handlePreviewClose}
          getFullUrl={getFullUrl}
        />
      </div>
    </Layout>
  );
}