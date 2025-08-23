import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navigation, useSidebar } from '@/components/Navigation';
import { User, Session } from '@supabase/supabase-js';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Grid, Image, Video, FileAudio, FileText, Calendar, ArrowUpDown, BookOpen, Zap, MessageSquare, GripVertical, Edit, Check } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NewFolderDialog } from '@/components/NewFolderDialog';
import { EditFolderDialog } from '@/components/EditFolderDialog';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LibrarySelectionToolbar } from '@/components/LibrarySelectionToolbar';
import { useMediaOperations } from '@/hooks/useMediaOperations';

interface MediaItem {
  id: string;
  title: string | null;
  origin: 'upload' | 'story' | 'livestream' | 'message';
  storage_path: string;
  mime: string;
  type: 'image' | 'video' | 'audio' | 'document';
  size_bytes: number;
  sha256: string | null;
  tags: string[];
  suggested_price_cents: number;
  notes: string | null;
  creator_id: string;
  created_at: string;
  updated_at: string;
}

interface Collection {
  id: string;
  name: string;
  system: boolean;
  system_key: string | null;
  creator_id: string;
}

const ContentLibrary = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<MediaItem[]>([]);
  const [loadingContent, setLoadingContent] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedCategory, setSelectedCategory] = useState('all-files');
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [originalFolderOrder, setOriginalFolderOrder] = useState<typeof customFolders>([]);
  
  // Selection state
  const [selecting, setSelecting] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  const { copyToCollection, removeFromCollection, deleteMediaHard, createCollection, loading: operationLoading } = useMediaOperations();
  
  const [defaultCategories] = useState([
    { id: 'all-files', label: 'All Files', icon: Grid, description: 'All uploaded content', isDefault: true },
    { id: 'stories', label: 'Stories', icon: BookOpen, description: 'Content uploaded to stories', isDefault: true },
    { id: 'livestreams', label: 'LiveStreams', icon: Zap, description: 'Past live stream videos', isDefault: true },
    { id: 'messages', label: 'Messages', icon: MessageSquare, description: 'Content sent in messages', isDefault: true },
  ]);
  
  const [customFolders, setCustomFolders] = useState<Array<{
    id: string;
    label: string;
    icon: any;
    description: string;
    isDefault: false;
    count?: number;
  }>>([]);
  
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const { isCollapsed, isNarrowScreen } = useSidebar();

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

  // Auto-collapse sidebar on narrow screens
  useEffect(() => {
    const handleResize = () => {
      const screenWidth = window.innerWidth;
      // Auto-collapse when screen width is less than 1200px to preserve responsiveness
      if (screenWidth < 1200 && !isCollapsed) {
        // Only auto-collapse, don't auto-expand to avoid interference with user preference
        const navigation = document.querySelector('[data-auto-collapse]');
        if (navigation) {
          // Trigger collapse through Navigation component
          const collapseButton = navigation.querySelector('[data-collapse-trigger]');
          if (collapseButton) {
            (collapseButton as HTMLElement).click();
          }
        }
      }
    };

    // Set up resize listener
    window.addEventListener('resize', handleResize);
    // Check on initial load
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, [isCollapsed]);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        let query = supabase.from('media').select('*');

        // Apply origin filter based on selected category
        if (selectedCategory === 'stories') {
          query = query.eq('origin', 'story');
        } else if (selectedCategory === 'livestreams') {
          query = query.eq('origin', 'livestream'); 
        } else if (selectedCategory === 'messages') {
          query = query.eq('origin', 'message');
        } else if (selectedCategory !== 'all-files' && !selectedCategory.startsWith('custom-')) {
          // For custom collections, we need to fetch via collection_items
          const { data: collectionItems, error: collectionError } = await supabase
            .from('collection_items')
            .select(`
              media_id,
              media:media_id (*)
            `)
            .eq('collection_id', selectedCategory);

          if (collectionError) {
            console.error('Error fetching collection items:', collectionError);
            setContent([]);
            return;
          }

          const mediaItems = collectionItems?.map(item => item.media).filter(Boolean).filter(media => 
            ['upload', 'story', 'livestream', 'message'].includes(media.origin) &&
            ['image', 'video', 'audio', 'document'].includes(media.type)
          ) as MediaItem[] || [];
          setContent(mediaItems);
          return;
        }

        // Apply type filter
        if (selectedFilter !== 'all') {
          query = query.eq('type', selectedFilter);
        }

        // Apply search filter
        if (searchQuery) {
          const searchTerms = searchQuery.trim().split(/\s+/).map(term => term.toLowerCase());
          const searchConditions = searchTerms.map(term => 
            `title.ilike.%${term}%,notes.ilike.%${term}%,tags.cs.{${term}}`
          ).join(',');
          query = query.or(searchConditions);
        }

        // Apply sorting
        if (sortBy === 'newest') {
          query = query.order('created_at', { ascending: false });
        } else if (sortBy === 'oldest') {
          query = query.order('created_at', { ascending: true });
        } else if (sortBy === 'price_high') {
          query = query.order('suggested_price_cents', { ascending: false });
        } else if (sortBy === 'price_low') {
          query = query.order('suggested_price_cents', { ascending: true });
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching media:', error);
        } else {
          const mediaData = data as any[];
          setContent(mediaData.filter(item => 
            ['upload', 'story', 'livestream', 'message'].includes(item.origin) &&
            ['image', 'video', 'audio', 'document'].includes(item.type)
          ));
        }
      } catch (error) {
        console.error('Error fetching media:', error);
      } finally {
        setLoadingContent(false);
      }
    };

    if (user) {
      fetchContent();
    }
  }, [user, selectedFilter, searchQuery, sortBy, selectedCategory]);

  // Fetch custom collections from database and set up real-time subscription
  useEffect(() => {
    const fetchCustomCollections = async () => {
      if (!user) return;
      
      console.log('Fetching custom collections...');
      try {
        const { data, error } = await supabase
          .from('collections')
          .select('*')
          .eq('system', false)
          .order('name', { ascending: true });

        console.log('Collections query result:', { data, error });

        if (error) {
          console.error('Error fetching collections:', error);
        } else {
          const folders = data?.map(collection => ({
            id: collection.id,
            label: collection.name,
            icon: Grid,
            description: 'Custom folder',
            isDefault: false as const,
            count: 0
          })) || [];
          console.log('Mapped folders:', folders);
          setCustomFolders(folders);
        }
      } catch (error) {
        console.error('Error fetching collections:', error);
      }
    };

    if (user) {
      fetchCustomCollections();

      // Set up real-time subscription for collections
      console.log('Setting up real-time subscription for collections');
      const channel = supabase
        .channel('collections-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'collections',
            filter: 'system=eq.false'
          },
          (payload) => {
            console.log('Real-time collection change:', payload);
            // Refetch collections when any change occurs
            fetchCustomCollections();
          }
        )
        .subscribe((status) => {
          console.log('Subscription status:', status);
        });

      return () => {
        console.log('Cleaning up collection subscription');
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  // Sort custom folders based on sortOrder
  const sortedCustomFolders = sortOrder 
    ? [...customFolders].sort((a, b) => {
        if (sortOrder === 'asc') {
          return a.label.localeCompare(b.label);
        } else {
          return b.label.localeCompare(a.label);
        }
      })
    : customFolders;

  const handleCustomFolderDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
    setDragOverIndex(null);
  };

  const handleCustomFolderDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleSeparatorDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleSeparatorDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
    
    if (isNaN(dragIndex)) return;
    
    const newFolders = [...sortedCustomFolders];
    const draggedItem = newFolders[dragIndex];
    
    // Remove the dragged item
    newFolders.splice(dragIndex, 1);
    // Insert it at the new position (adjust for removal if necessary)
    const adjustedDropIndex = dragIndex < dropIndex ? dropIndex - 1 : dropIndex;
    newFolders.splice(adjustedDropIndex, 0, draggedItem);
    
    setCustomFolders(newFolders);
    setDragOverIndex(null);
    // Reset sort order when manually reordering
    setSortOrder(null);
  };

  const handleCustomFolderDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
    
    if (dragIndex === dropIndex || isNaN(dragIndex)) return;
    
    const newFolders = [...sortedCustomFolders];
    const draggedItem = newFolders[dragIndex];
    
    // Remove the dragged item
    newFolders.splice(dragIndex, 1);
    // Insert it at the new position
    newFolders.splice(dropIndex, 0, draggedItem);
    
    setCustomFolders(newFolders);
    setDragOverIndex(null);
    // Reset sort order when manually reordering
    setSortOrder(null);
  };

  const handleDragEnd = () => {
    setDragOverIndex(null);
  };

  const handleSortFolders = () => {
    if (sortOrder === null) {
      setSortOrder('asc');
    } else if (sortOrder === 'asc') {
      setSortOrder('desc');
    } else {
      setSortOrder(null);
    }
  };

  const handleStartReorder = () => {
    // Save current order before starting reorder mode
    setOriginalFolderOrder([...customFolders]);
    setIsReorderMode(true);
  };

  const handleCancelReorder = () => {
    // Restore original order and exit reorder mode
    setCustomFolders(originalFolderOrder);
    setIsReorderMode(false);
    setOriginalFolderOrder([]);
  };

  const handleConfirmReorder = async () => {
    // Save the new order to database (if needed) and exit reorder mode
    // For now, we'll just keep the current order in state
    // You could add database persistence here if needed
    setIsReorderMode(false);
    setOriginalFolderOrder([]);
  };

  // Selection handlers
  const handleToggleSelect = () => {
    if (selecting) {
      setSelecting(false);
      setSelectedItems(new Set());
    } else {
      setSelecting(true);
    }
  };

  const handleClearSelection = () => {
    setSelecting(false);
    setSelectedItems(new Set());
  };

  const handleToggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleCopy = async (collectionId: string) => {
    try {
      await copyToCollection(collectionId, Array.from(selectedItems));
      handleClearSelection();
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const handleDelete = async () => {
    try {
      const isCustomFolder = selectedCategory.startsWith('custom-') || !['all-files', 'stories', 'livestreams', 'messages'].includes(selectedCategory);
      
      if (isCustomFolder) {
        // Remove from collection only
        await removeFromCollection(selectedCategory, Array.from(selectedItems));
      } else {
        // Delete permanently
        await deleteMediaHard(Array.from(selectedItems));
      }
      
      handleClearSelection();
      // Refetch content
      const fetchContent = async () => {
        // ... same fetch logic as in useEffect
      };
      fetchContent();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const refreshCustomFolders = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('system', false)
        .order('name', { ascending: true });
      if (!error && data) {
        const folders = data.map(collection => ({
          id: collection.id,
          label: collection.name,
          icon: Grid,
          description: 'Custom folder',
          isDefault: false as const,
          count: 0
        }));
        setCustomFolders(folders);
      }
    } catch (error) {
      console.error('Error fetching collections:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="animate-pulse">
          {/* Skeleton Navigation */}
          <div className="fixed left-0 top-0 h-full w-64 bg-muted/20 border-r"></div>
          
          {/* Skeleton Layout */}
          <div className={`transition-all duration-300 ${isCollapsed ? 'ml-16' : 'ml-52'} flex h-screen`}>
            {/* Categories Sidebar Skeleton */}
            <div className="w-96 bg-muted/10 border-r p-6">
              <div className="h-6 w-32 bg-muted/30 rounded mb-4"></div>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 bg-muted/20 rounded"></div>
                ))}
              </div>
            </div>
            
            {/* Main Content Skeleton */}
            <div className="flex-1 flex flex-col">
              {/* Header Skeleton */}
              <div className="bg-muted/10 border-b p-6">
                <div className="h-8 w-48 bg-muted/30 rounded mb-4"></div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-8 w-20 bg-muted/20 rounded"></div>
                  ))}
                </div>
              </div>
              
              {/* Content Grid Skeleton */}
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

  const truncateText = (text: string, maxLength: number) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      case 'audio': return <FileAudio className="h-4 w-4" />;
      case 'document': return <FileText className="h-4 w-4" />;
      default: return <Grid className="h-4 w-4" />;
    }
  };

  const handleCardClick = (item: MediaItem) => {
    if (selecting) {
      handleToggleItem(item.id);
    } else {
      // Open preview/edit modal
      console.log('Open preview for:', item);
    }
  };

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  const isCustomFolder = selectedCategory !== 'all-files' && 
    !['stories', 'livestreams', 'messages'].includes(selectedCategory);

  return (
    <div className="h-full flex overflow-hidden -m-6 -mt-4">
      {/* Categories Sidebar */}
      <div className="w-80 bg-card border-r border-border overflow-y-auto flex-shrink-0 p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground mb-3">Library</h2>
        </div>
          
        {/* Default Categories */}
        <div className="space-y-1 mb-4">
          {defaultCategories.map((category) => {
            const IconComponent = category.icon;
            return (
              <div key={category.id} className="relative">
                <Button
                  variant={selectedCategory === category.id ? "default" : "ghost"}
                  className="w-full justify-start text-left p-2 h-auto pr-10"
                  onClick={() => {
                    setSelectedCategory(category.id);
                    setSelectedFilter('all');
                    handleClearSelection();
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <IconComponent className="h-4 w-4 flex-shrink-0" />
                     <div className="flex flex-col items-start min-w-0 flex-1">
                       <span className="font-medium text-left w-full">{truncateText(category.label, 24)}</span>
                       <span className={`text-xs text-left w-full ${selectedCategory === category.id ? 'text-foreground' : 'text-muted-foreground/80'}`}>{truncateText(category.description, 30)}</span>
                     </div>
                  </div>
                </Button>
                <Badge variant="secondary" className="absolute top-1 right-2 text-xs pointer-events-none">
                  {category.id === 'all-files' ? content.length : 0}
                </Badge>
              </div>
            );
          })}
        </div>

        {/* Horizontal Divider */}
        <div className="border-t border-border my-4"></div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mb-4">
          <NewFolderDialog onFolderCreated={refreshCustomFolders} />
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartReorder}
            disabled={customFolders.length === 0}
          >
            <ArrowUpDown className="h-4 w-4 mr-2" />
            Reorder Folders
          </Button>

          {/* Temporary role assignment button */}
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              try {
                const { error } = await supabase
                  .from('user_roles')
                  .insert({ user_id: user?.id, role: 'owner' });
                if (!error) {
                  console.log('Owner role assigned');
                  window.location.reload();
                }
              } catch (e) {
                console.error('Role assignment failed:', e);
              }
            }}
          >
            Fix Permissions (Owner Role)
          </Button>
        </div>

            {/* Custom Folders */}
            {sortedCustomFolders.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-muted-foreground">My Folders</div>
                  {isReorderMode && (
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelReorder}
                        className="text-xs h-7 px-2"
                      >
                        ✕
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleConfirmReorder}
                        className="text-xs h-7 px-2"
                      >
                        ✓
                      </Button>
                    </div>
                  )}
                </div>
                {/* Separator at the top for dropping before first item */}
                {isReorderMode && (
                  <div
                    className={`h-1 transition-all duration-200 ${
                      dragOverIndex === 0 ? 'bg-primary scale-y-150' : 'bg-transparent'
                    }`}
                    onDragOver={(e) => handleSeparatorDragOver(e, 0)}
                    onDrop={(e) => handleSeparatorDrop(e, 0)}
                  />
                )}
                
                {sortedCustomFolders.map((folder, index) => {
                  const IconComponent = folder.icon;
                  return (
                    <div key={folder.id}>
                      <div
                        className={`relative ${isReorderMode ? 'cursor-move' : ''}`}
                        draggable={isReorderMode}
                        onDragStart={(e) => handleCustomFolderDragStart(e, index)}
                        onDragOver={handleCustomFolderDragOver}
                        onDrop={(e) => handleCustomFolderDrop(e, index)}
                        onDragEnd={handleDragEnd}
                      >
                        {!isReorderMode && (
                          <div className="absolute top-1 left-1 z-10">
                            <EditFolderDialog 
                              folder={{
                                id: folder.id,
                                label: folder.label,
                                description: folder.description
                              }}
                              onFolderUpdated={refreshCustomFolders}
                            />
                          </div>
                        )}
                        <Button
                          variant={selectedCategory === folder.id ? "default" : "ghost"}
                          className={`w-full justify-start text-left p-2 h-auto pr-10 ${!isReorderMode ? 'pl-10' : 'pl-2'}`}
                          onClick={() => {
                            if (!isReorderMode) {
                              setSelectedCategory(folder.id);
                              setSelectedFilter('all');
                              handleClearSelection();
                            }
                          }}
                          disabled={isReorderMode}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {isReorderMode && <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                            <div className="flex flex-col items-start min-w-0 flex-1">
                              <span className="font-medium text-left w-full">{truncateText(folder.label, 30)}</span>
                              <span className={`text-xs text-left w-full ${selectedCategory === folder.id ? 'text-foreground' : 'text-muted-foreground/80'}`}>{folder.description}</span>
                            </div>
                          </div>
                        </Button>
                        <Badge variant="secondary" className="absolute top-1 right-2 text-xs pointer-events-none">
                          {folder.count || 0}
                        </Badge>
                      </div>
                      
                      {/* Separator line with drop zone */}
                      <div className="relative">
                        {/* Normal separator line */}
                        <div className={`h-px mx-2 transition-all duration-200 ${
                          !isReorderMode ? 'bg-border/30' : 'bg-border/50'
                        }`} />
                        
                        {/* Drag drop zone over separator */}
                        {isReorderMode && (
                          <div
                            className={`absolute inset-0 h-3 -mt-1 transition-all duration-200 ${
                              dragOverIndex === index + 1 
                                ? 'bg-primary/20 border-t-2 border-primary' 
                                : 'bg-transparent hover:bg-muted/10'
                            }`}
                            onDragOver={(e) => handleSeparatorDragOver(e, index + 1)}
                            onDrop={(e) => handleSeparatorDrop(e, index + 1)}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-card border-b border-border p-6 pb-4">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-lg font-semibold text-foreground">
                  {defaultCategories.find(c => c.id === selectedCategory)?.label || 
                   customFolders.find(c => c.id === selectedCategory)?.label || 'Library'}
                </h1>
                
              </div>

              {/* Controls and Filters */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                {/* Filter Tabs */}
                <div className="flex items-center gap-2 flex-wrap order-2 lg:order-1">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'image', label: 'Photo' },
                    { id: 'video', label: 'Video' },
                    { id: 'audio', label: 'Audio' },
                    { id: 'document', label: 'Documents' }
                  ].map((filter) => (
                    <Button
                      key={filter.id}
                      variant={selectedFilter === filter.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedFilter(filter.id)}
                      className="whitespace-nowrap"
                    >
                      {filter.label}
                    </Button>
                  ))}
                </div>

                {/* Search and Sort Controls */}
                <div className="flex items-center gap-3 order-1 lg:order-2">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search content..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-40 focus:w-64 transition-all duration-200"
                    />
                  </div>

                  {/* Sort By */}
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                      <SelectItem value="price_high">Price: High to Low</SelectItem>
                      <SelectItem value="price_low">Price: Low to High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Selection Toolbar */}
            <LibrarySelectionToolbar
              selecting={selecting}
              selectedCount={selectedItems.size}
              currentView={defaultCategories.find(c => c.id === selectedCategory)?.label || 
                customFolders.find(c => c.id === selectedCategory)?.label || 'Library'}
              isCustomFolder={isCustomFolder}
              onToggleSelect={handleToggleSelect}
              onClearSelection={handleClearSelection}
              onCopy={handleCopy}
              onDelete={handleDelete}
              disabled={operationLoading || loadingContent}
            />

            {/* Content Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingContent ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-pulse">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="aspect-square bg-muted/20 rounded-lg"></div>
                  ))}
                </div>
              ) : content.length === 0 ? (
                <div className="text-center py-12">
                  <Grid className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No content found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {content.map((item) => (
                    <Card 
                      key={item.id} 
                      className={`bg-gradient-card border-border shadow-card hover:shadow-lg transition-all cursor-pointer relative ${
                        selecting && selectedItems.has(item.id) ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => handleCardClick(item)}
                    >
                      {selecting && (
                        <div className="absolute top-2 left-2 z-10">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            selectedItems.has(item.id) 
                              ? 'bg-primary border-primary text-primary-foreground' 
                              : 'bg-background border-muted-foreground'
                          }`}>
                            {selectedItems.has(item.id) && <Check className="h-3 w-3" />}
                          </div>
                        </div>
                      )}

                      <CardContent className="p-0">
                        {/* Thumbnail */}
                        <div className="aspect-square bg-muted rounded-t-lg flex items-center justify-center relative">
                          <div className="flex flex-col items-center gap-2">
                            {getContentTypeIcon(item.type)}
                            <span className="text-xs text-muted-foreground capitalize">
                              {item.type}
                            </span>
                          </div>
                          
                          {/* Content Type Badge */}
                          <Badge 
                            variant="secondary" 
                            className="absolute top-2 right-2 text-xs"
                          >
                            {item.type}
                          </Badge>
                        </div>
                        
                        {/* Content Info */}
                        <div className="p-3">
                          <h3 className="font-medium text-foreground text-sm truncate mb-1">
                            {item.title || 'Untitled'}
                          </h3>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                              {item.notes}
                            </p>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-primary">
                              ${formatPrice(item.suggested_price_cents)}
                            </span>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {new Date(item.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <span className="capitalize">{item.origin}</span>
                            {item.tags.length > 0 && (
                              <>
                                <span>•</span>
                                <span>{item.tags.slice(0, 2).join(', ')}</span>
                                {item.tags.length > 2 && <span>+{item.tags.length - 2}</span>}
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
    </div>
  );
};

export default ContentLibrary;