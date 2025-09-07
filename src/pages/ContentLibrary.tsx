import React from 'react';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSidebar } from '@/components/Navigation';
import { User, Session } from '@supabase/supabase-js';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Grid, BookOpen, Zap, MessageSquare, Filter, AlertTriangle } from 'lucide-react';
import { DeletionProgressDialog } from '@/components/DeletionProgressDialog';
import { LibrarySelectionToolbar } from '@/components/LibrarySelectionToolbar';
import { useMediaOperations } from '@/hooks/useMediaOperations';
import { MediaPreviewDialog } from '@/components/MediaPreviewDialog';
import { useToast } from '@/hooks/use-toast';
import { LibraryGrid } from '@/components/LibraryGrid';
import { useLibraryData } from '@/hooks/useLibraryData';
import { LibraryErrorBoundary } from '@/components/LibraryErrorBoundary';
import { LibraryFiltersDialog } from '@/components/LibraryFiltersDialog';
import { LibraryFilterState } from '@/types/library-filters';
import { OrphanedDataManager } from '@/components/OrphanedDataManager';
import { RecreateStorageFolders } from '@/components/RecreateStorageFolders';

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

const ContentLibrary = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  
  // UI state - use primitive values to prevent object recreation
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const selectedCategory = searchParams.get('category') || 'all-files';
  
  // Advanced filters state with localStorage persistence
  const [advancedFilters, setAdvancedFilters] = useState<LibraryFilterState>(() => {
    try {
      const saved = localStorage.getItem(`library-filters-${selectedCategory}`);
      return saved ? JSON.parse(saved) : {
        collaborators: [],
        tags: [],
        priceRange: [0, 1000000] as [number, number]
      };
    } catch {
      return {
        collaborators: [],
        tags: [],
        priceRange: [0, 1000000] as [number, number]
      };
    }
  });
  
  // Filter dialog state
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  
  // Cleanup dialog state
  const [showCleanup, setShowCleanup] = useState(false);
  
  // Selection state
  const [selecting, setSelecting] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  // Preview state
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  
  // Deletion progress state
  const [deletionProgress, setDeletionProgress] = useState({
    open: false,
    totalFiles: 0,
    deletedFiles: 0,
    isComplete: false,
    isError: false,
    errorMessage: ''
  });
  
  // Stable default categories
  const defaultCategories = useMemo(() => [
    { id: 'all-files', label: 'All Files', icon: Grid, description: 'All uploaded content', isDefault: true },
    { id: 'stories', label: 'Stories', icon: BookOpen, description: 'Content uploaded to stories', isDefault: true },
    { id: 'livestreams', label: 'LiveStreams', icon: Zap, description: 'Past live stream videos', isDefault: true },
    { id: 'messages', label: 'Messages', icon: MessageSquare, description: 'Content sent in messages', isDefault: true },
  ], []);

  // Stable custom folders (empty for now)
  const customFolders = useMemo(() => [], []);

  // Create stable library parameters object
  const libraryParams = useMemo(() => ({
    selectedCategory,
    searchQuery,
    selectedFilter,
    sortBy,
    advancedFilters
  }), [selectedCategory, searchQuery, selectedFilter, sortBy, advancedFilters]);

  // Use the library data hook with stable parameters
  const { 
    content, 
    loading: loadingContent, 
    categoryCounts, 
    fetchContent, 
    fetchCategoryCounts 
  } = useLibraryData(libraryParams);

  // Stable operation handlers
  const onRefreshNeeded = useCallback(() => {
    fetchContent();
  }, [fetchContent]);

  const onCountsRefreshNeeded = useCallback(() => {
    fetchCategoryCounts();
  }, [fetchCategoryCounts]);

  const { copyToCollection, removeFromCollection, deleteMediaHard, loading: operationLoading } = useMediaOperations({
    onRefreshNeeded,
    onCountsRefreshNeeded
  });
  
  const { toast } = useToast();
  const { isCollapsed } = useSidebar();

  // Stable primitive event handlers - no dependencies on changing objects
  const handleFilterChange = useCallback((filter: string) => {
    setSelectedFilter(filter);
    setSelecting(false);
    setSelectedItems(new Set());
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const handleSortChange = useCallback((sort: string) => {
    setSortBy(sort);
  }, []);

  const handleCategorySelect = useCallback((categoryId: string) => {
    setSearchParams({ category: categoryId });
    setSelectedFilter('all');
    setSelecting(false);
    setSelectedItems(new Set());
    
    // Clear filters when changing categories and load category-specific filters
    try {
      const saved = localStorage.getItem(`library-filters-${categoryId}`);
      const categoryFilters = saved ? JSON.parse(saved) : {
        collaborators: [],
        tags: [],
        priceRange: [0, 1000000] as [number, number]
      };
      setAdvancedFilters(categoryFilters);
    } catch {
      setAdvancedFilters({
        collaborators: [],
        tags: [],
        priceRange: [0, 1000000] as [number, number]
      });
    }
  }, [setSearchParams]);

  // Stable selection handlers using functional updates
  const handleToggleItem = useCallback((itemId: string) => {
    setSelectedItems(prevItems => {
      const newSet = new Set(prevItems);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      
      // Update selecting state based on selection count
      const hasSelection = newSet.size > 0;
      setSelecting(hasSelection);
      
      return newSet;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelecting(false);
    setSelectedItems(new Set());
  }, []);

  const handleSelectAll = useCallback(() => {
    const allItemIds = new Set(content.map(item => item.id));
    setSelectedItems(allItemIds);
    setSelecting(true);
  }, [content]);

  // Stable click handlers with no content dependencies
  const handleCardClick = useCallback((item: MediaItem, event: React.MouseEvent, itemIndex: number) => {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('🔍 ContentLibrary handleCardClick - selecting state:', selecting);
    
    if (selecting) {
      handleToggleItem(item.id);
    } else {
      console.log('🔍 ContentLibrary opening preview for item:', item.id);
      setPreviewItem(item);
    }
  }, [selecting, handleToggleItem]);

  const handleCheckboxClick = useCallback((itemId: string, itemIndex: number, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    handleToggleItem(itemId);
  }, [handleToggleItem]);

  // Operation handlers using functional state updates
  const handleCopy = useCallback(async (collectionIds: string[]) => {
    try {
      const selectedItemsArray = Array.from(selectedItems);
      
      for (const collectionId of collectionIds) {
        await copyToCollection(collectionId, selectedItemsArray);
      }
      
      handleClearSelection();
      
      toast({
        title: "Success",
        description: `Content copied to ${collectionIds.length} folder${collectionIds.length !== 1 ? 's' : ''}`
      });
    } catch (error) {
      console.error('Copy failed:', error);
      toast({
        title: "Error",
        description: "Failed to copy content",
        variant: "destructive"
      });
    }
  }, [selectedItems, copyToCollection, handleClearSelection, toast]);

  const handleDelete = useCallback(async () => {
    try {
      const selectedItemsArray = Array.from(selectedItems);
      const isCustomFolder = !['all-files', 'stories', 'livestreams', 'messages'].includes(selectedCategory);
      
      if (isCustomFolder) {
        await removeFromCollection(selectedCategory, selectedItemsArray);
      } else {
        setDeletionProgress({
          open: true,
          totalFiles: selectedItemsArray.length,
          deletedFiles: 0,
          isComplete: false,
          isError: false,
          errorMessage: ''
        });
        
        await deleteMediaHard(selectedItemsArray, (deletedCount, totalCount) => {
          setDeletionProgress(prev => ({
            ...prev,
            deletedFiles: deletedCount,
            isComplete: deletedCount === totalCount
          }));
        });
      }
      
      handleClearSelection();
    } catch (error) {
      console.error('Delete failed:', error);
      setDeletionProgress(prev => ({
        ...prev,
        isError: true,
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred'
      }));
    }
  }, [selectedItems, selectedCategory, removeFromCollection, deleteMediaHard, handleClearSelection]);

  // Advanced filters handlers
  const handleFiltersChange = useCallback((newFilters: LibraryFilterState) => {
    setAdvancedFilters(newFilters);
    
    // Persist to localStorage for this category
    try {
      localStorage.setItem(`library-filters-${selectedCategory}`, JSON.stringify(newFilters));
    } catch (error) {
      console.error('Failed to save filters to localStorage:', error);
    }
  }, [selectedCategory]);

  const hasActiveFilters = useMemo(() => {
    return advancedFilters.collaborators.length > 0 ||
           advancedFilters.tags.length > 0 ||
           advancedFilters.priceRange[0] > 0 ||
           advancedFilters.priceRange[1] < 1000000;
  }, [advancedFilters]);

  // Auth setup
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session?.user) {
          navigate('/');
        } else {
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session?.user) {
        navigate('/');
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Memoized computed values
  const isCustomFolder = useMemo(() => 
    selectedCategory !== 'all-files' && 
    !['stories', 'livestreams', 'messages'].includes(selectedCategory),
    [selectedCategory]
  );

  const categoryLabel = useMemo(() => 
    defaultCategories.find(c => c.id === selectedCategory)?.label || 
    customFolders.find(c => c.id === selectedCategory)?.label || 
    'Library',
    [defaultCategories, customFolders, selectedCategory]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="animate-pulse">
          <div className="fixed left-0 top-0 h-full w-64 bg-muted/20 border-r"></div>
          <div className={`transition-all duration-300 ${isCollapsed ? 'ml-16' : 'ml-52'} flex h-screen`}>
            <div className="w-96 bg-muted/10 border-r p-6">
              <div className="h-6 w-32 bg-muted/30 rounded mb-4"></div>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 bg-muted/20 rounded"></div>
                ))}
              </div>
            </div>
            <div className="flex-1 flex flex-col">
              <div className="bg-muted/10 border-b p-6">
                <div className="h-8 w-48 bg-muted/30 rounded mb-4"></div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-8 w-20 bg-muted/20 rounded"></div>
                  ))}
                </div>
              </div>
              <div className="flex-1 p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="aspect-square bg-muted/20 rounded-lg"></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <LibraryErrorBoundary>
      <div className="h-full flex flex-col overflow-hidden -mb-6">
        {/* Selection Toolbar - At very top level when selecting */}
        {selecting && (
          <LibrarySelectionToolbar
            selectedCount={selectedItems.size}
            totalCount={content.length}
            currentView={categoryLabel}
            isCustomFolder={isCustomFolder}
            onClearSelection={handleClearSelection}
            onSelectAll={handleSelectAll}
            onCopy={handleCopy}
            onDelete={handleDelete}
            disabled={operationLoading || loadingContent}
          />
        )}
        
        {/* Main Content Area - Full Width */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Enhanced Header */}
          <div className="bg-gradient-header border-b border-border/50 p-6 pb-5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">
                  {categoryLabel}
                </h1>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  {content.length} items
                </Badge>
              </div>
            </div>

            {/* Enhanced Controls and Filters - Fixed Layout */}
            <div className="space-y-4">
              {/* Top Row: Advanced Filters Button + Search + Sort + Select */}
              <div className="flex items-center gap-3 justify-between">
                {/* Left Side: Advanced Filters + Cleanup (Always Visible) */}
                <div className="flex items-center gap-2">
                  <Button
                    variant={hasActiveFilters ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFiltersDialogOpen(true)}
                    className={`shrink-0 font-medium ${
                      hasActiveFilters
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                    }`}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Advanced Filters
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="ml-2 bg-primary-foreground/20 text-primary text-xs px-1.5 py-0.5">
                        {[
                          ...advancedFilters.collaborators,
                          ...advancedFilters.tags,
                          ...(advancedFilters.priceRange[0] > 0 || advancedFilters.priceRange[1] < 1000000 ? ['price'] : [])
                        ].length}
                      </Badge>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCleanup(!showCleanup)}
                    className="shrink-0 font-medium border-2 border-warning/20 hover:border-warning/40 hover:bg-warning/5"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    {showCleanup ? 'Hide Cleanup' : 'DB Cleanup'}
                  </Button>
                </div>

                {/* Right Side: Search + Sort + Select */}
                <div className="flex items-center gap-3">
                  {/* Enhanced Search */}
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search your content..."
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="pl-10 pr-4 w-full bg-background border border-border focus:border-primary transition-colors"
                    />
                  </div>

                  {/* Enhanced Sort By */}
                  <Select value={sortBy} onValueChange={handleSortChange}>
                    <SelectTrigger className="w-40 bg-gradient-glass border-border/50 hover:border-primary/30 transition-all duration-300">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent className="bg-card/95 backdrop-blur-md border-border/50">
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                      <SelectItem value="price_high">Price: High to Low</SelectItem>
                      <SelectItem value="price_low">Price: Low to High</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Enhanced Select Toggle Button */}
                  <Button
                    variant={selecting ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelecting(!selecting);
                      if (selecting) {
                        setSelectedItems(new Set());
                      }
                    }}
                    className={`shrink-0 transition-all duration-300 ${
                      selecting 
                        ? "bg-gradient-primary shadow-shadow-glow" 
                        : "hover:bg-gradient-glass hover:shadow-shadow-soft/50"
                    }`}
                  >
                    {selecting ? "Cancel" : "Select"}
                  </Button>
                </div>
              </div>

              {/* Bottom Row: Content Type Filter Tabs */}
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { id: 'all', label: 'All Content', icon: Grid },
                  { id: 'image', label: 'Photos', icon: Grid },
                  { id: 'video', label: 'Videos', icon: Grid },
                  { id: 'audio', label: 'Audio', icon: Grid }
                ].map((filter) => {
                  const isSelected = selectedFilter === filter.id;
                  return (
                    <Button
                      key={filter.id}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleFilterChange(filter.id)}
                      className={`whitespace-nowrap transition-all duration-300 ${
                        isSelected 
                          ? "bg-gradient-primary shadow-shadow-soft" 
                          : "hover:bg-gradient-glass hover:shadow-shadow-soft/50"
                      }`}
                    >
                      {filter.label}
                    </Button>
                  );
                })}
              </div>

              {/* Cleanup Section (when enabled) */}
              {showCleanup && (
                <div className="mt-4 space-y-4">
                  <OrphanedDataManager />
                  <RecreateStorageFolders />
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Content Area */}
          <div className="flex-1 overflow-y-auto p-6 pt-4 custom-scrollbar">
            {/* Content Grid */}
            <LibraryGrid
              content={content}
              selectedItems={selectedItems}
              selecting={selecting}
              onItemClick={handleCardClick}
              onCheckboxClick={handleCheckboxClick}
              loading={loadingContent}
            />
          </div>
        </div>
        
        <DeletionProgressDialog
          open={deletionProgress.open}
          totalFiles={deletionProgress.totalFiles}
          deletedFiles={deletionProgress.deletedFiles}
          isComplete={deletionProgress.isComplete}
          isError={deletionProgress.isError}
          errorMessage={deletionProgress.errorMessage}
          onClose={() => setDeletionProgress({
            open: false,
            totalFiles: 0,
            deletedFiles: 0,
            isComplete: false,
            isError: false,
            errorMessage: ''
          })}
        />
        
        <MediaPreviewDialog
          open={!!previewItem}
          onOpenChange={(open) => !open && setPreviewItem(null)}
          item={previewItem}
          allItems={content}
          selectedItems={selectedItems}
          onToggleSelection={handleToggleItem}
          onItemChange={setPreviewItem}
          selecting={selecting}
        />

        {/* Advanced Filters Dialog */}
        <LibraryFiltersDialog
          open={filtersDialogOpen}
          onOpenChange={setFiltersDialogOpen}
          filters={advancedFilters}
          onFiltersChange={handleFiltersChange}
        />
      </div>
    </LibraryErrorBoundary>
  );
};

export default ContentLibrary;