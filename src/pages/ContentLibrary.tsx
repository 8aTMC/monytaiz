import { useEffect, useState, useRef, useCallback } from 'react';
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
import { Search, Filter, Grid, Image, Video, FileAudio, FileText, Calendar, ArrowUpDown, BookOpen, Zap, MessageSquare, GripVertical, Edit, Check, Recycle, HardDrive } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog';
import { NewFolderDialog } from '@/components/NewFolderDialog';
import { EditFolderDialog } from '@/components/EditFolderDialog';

import { DeletionProgressDialog } from '@/components/DeletionProgressDialog';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LibrarySelectionToolbar } from '@/components/LibrarySelectionToolbar';
import { useMediaOperations } from '@/hooks/useMediaOperations';
import { MediaPreviewDialog } from '@/components/MediaPreviewDialog';
import { MediaThumbnail } from '@/components/MediaThumbnail';
import { useToast } from '@/hooks/use-toast';

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

interface Collection {
  id: string;
  name: string;
  description: string | null;
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
  
  // Store counts for all categories
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});

  // Function to calculate counts for all categories without filters
  const calculateCategoryCounts = useCallback(async () => {
    try {
      const counts: Record<string, number> = {};
      
      // Calculate All Files count (avoiding double counting)
      const [allMediaResults, allContentResults] = await Promise.all([
        supabase
          .from('media')
          .select('id', { count: 'exact' }),
        supabase
          .from('content_files')
          .select('id', { count: 'exact' })
          .eq('is_active', true)
          .not('content_type', 'is', null)
          .not('file_path', 'is', null)
          .not('file_path', 'eq', '')
          .gt('file_size', 0)
      ]);
      
      // Get unique files - avoid counting files that exist in both tables
      const { data: mediaIds } = await supabase
        .from('media')
        .select('id');
      
      const { data: contentFileIds } = await supabase
        .from('content_files')
        .select('id')
        .eq('is_active', true)
        .not('content_type', 'is', null)
        .not('file_path', 'is', null)
        .not('file_path', 'eq', '')
        .gt('file_size', 0);
      
      const mediaIdSet = new Set((mediaIds || []).map(item => item.id));
      const uniqueContentFiles = (contentFileIds || []).filter(item => !mediaIdSet.has(item.id));
      
      counts['all-files'] = (allMediaResults.count || 0) + uniqueContentFiles.length;
      
      // Calculate Messages count (only media with message/chat origin)
      const { count: messagesCount } = await supabase
        .from('media')
        .select('id', { count: 'exact' })
        .in('origin', ['message', 'chat']);
      
      counts['messages'] = messagesCount || 0;
      
      // Stories and LiveStreams are not implemented, so they remain 0
      counts['stories'] = 0;
      counts['livestreams'] = 0;
      
      // Calculate custom folder counts using current state
      const currentFolders = customFolders;
      for (const folder of currentFolders) {
        const { count: folderCount } = await supabase
          .from('collection_items')
          .select('media_id', { count: 'exact' })
          .eq('collection_id', folder.id);
        
        counts[folder.id] = folderCount || 0;
      }
      
      setCategoryCounts(counts);
    } catch (error) {
      console.error('Error calculating category counts:', error);
    }
  }, [customFolders]); // Add customFolders back but manage carefully

  // Separate refetch function that can be called from anywhere
  const refetchContent = useCallback(async () => {
    try {
      let combinedData: any[] = [];

      // Apply category-based filtering at the database level
      if (selectedCategory === 'all-files') {
        // Fetch all content for "All Files"
        const [mediaResults, contentResults] = await Promise.all([
          supabase
            .from('media')
            .select('id, bucket, path, storage_path, mime, type, size_bytes, title, notes, tags, suggested_price_cents, creator_id, created_at, updated_at, tiny_placeholder, width, height, origin')
            .order('created_at', { ascending: false }),
          supabase
            .from('content_files')
            .select('id, title, content_type, file_path, file_size, mime_type, base_price, tags, description, creator_id, created_at, updated_at, is_active')
            .eq('is_active', true)
            .not('content_type', 'is', null)
            .not('file_path', 'is', null)
            .not('file_path', 'eq', '')
            .gt('file_size', 0)
            .order('created_at', { ascending: false })
        ]);

        // Add media table results (optimized)
        if (mediaResults.data) {
          combinedData = [...mediaResults.data];
        }

        // Add content_files results (legacy), but avoid duplicates
        if (contentResults.data) {
          const mediaStoragePaths = new Set(mediaResults.data?.map(item => item.path || item.storage_path) || []);
          const legacyItems = contentResults.data.filter(item => !mediaStoragePaths.has(item.file_path));
          
          // Convert legacy format to new format
          const convertedLegacyItems = legacyItems.map(item => ({
            id: item.id,
            title: item.title || 'Untitled',
            type: item.content_type,
            bucket: 'content',
            path: item.file_path,
            storage_path: item.file_path,
            mime: item.mime_type || '',
            size_bytes: item.file_size || 0,
            suggested_price_cents: (item.base_price || 0) * 100,
            tags: item.tags || [],
            notes: item.description || null,
            creator_id: item.creator_id,
            created_at: item.created_at,
            updated_at: item.updated_at,
            origin: 'upload',
            tiny_placeholder: undefined,
            width: undefined,
            height: undefined
          }));

          combinedData = [...combinedData, ...convertedLegacyItems];
        }

      } else if (selectedCategory === 'stories') {
        // Stories content (not implemented yet, so return empty)
        combinedData = [];

      } else if (selectedCategory === 'livestreams') {
        // Livestreams content (not implemented yet, so return empty)
        combinedData = [];

      } else if (selectedCategory === 'messages') {
        // Content uploaded via messages - filter by origin = 'message' or 'chat'
        const [mediaResults, contentResults] = await Promise.all([
          supabase
            .from('media')
            .select('id, bucket, path, storage_path, mime, type, size_bytes, title, notes, tags, suggested_price_cents, creator_id, created_at, updated_at, tiny_placeholder, width, height, origin')
            .in('origin', ['message', 'chat'])
            .order('created_at', { ascending: false }),
          supabase
            .from('content_files')
            .select('id, title, content_type, file_path, file_size, mime_type, base_price, tags, description, creator_id, created_at, updated_at, is_active')
            .eq('is_active', true)
            .not('content_type', 'is', null)
            .not('file_path', 'is', null)
            .not('file_path', 'eq', '')
            .gt('file_size', 0)
            .order('created_at', { ascending: false })
        ]);

        // For messages, combine results from both tables but only include message-origin content
        if (mediaResults.data) {
          combinedData = [...mediaResults.data];
        }

        // Legacy content files don't have origin tracking, so skip them for messages category
        // This ensures only explicitly message-uploaded content appears in Messages folder

      } else {
        // Custom folder - get content assigned to this collection
        const { data: collectionItems } = await supabase
          .from('collection_items')
          .select(`
            media_id,
            media:media_id (id, bucket, path, storage_path, mime, type, size_bytes, title, notes, tags, suggested_price_cents, creator_id, created_at, updated_at, tiny_placeholder, width, height, origin)
          `)
          .eq('collection_id', selectedCategory);

        if (collectionItems) {
          combinedData = collectionItems
            .filter(item => item.media)
            .map(item => item.media);
        }
      }

      // Apply search filter
      if (searchQuery && combinedData.length > 0) {
        const searchTerms = searchQuery.trim().split(/\s+/).map(term => term.toLowerCase());
        combinedData = combinedData.filter(item => {
          const searchableText = [
            item.title || '',
            ...(item.tags || [])
          ].join(' ').toLowerCase();
          return searchTerms.some(term => searchableText.includes(term));
        });
      }

      // Apply type filter
      if (selectedFilter !== 'all' && combinedData.length > 0) {
        combinedData = combinedData.filter(item => item.type === selectedFilter);
      }

      // Apply sorting
      if (combinedData.length > 0) {
        if (sortBy === 'newest') {
          combinedData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        } else if (sortBy === 'oldest') {
          combinedData.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        } else if (sortBy === 'price_high') {
          combinedData.sort((a, b) => (b.suggested_price_cents || 0) - (a.suggested_price_cents || 0));
        } else if (sortBy === 'price_low') {
          combinedData.sort((a, b) => (a.suggested_price_cents || 0) - (b.suggested_price_cents || 0));
        }
      }

      // Convert to MediaItem format
      const validMediaItems = combinedData
        .filter(item => item && item.type && (item.path || item.storage_path) && item.size_bytes > 0)
        .map(item => ({
          id: item.id,
          title: item.title || 'Untitled',
          type: item.type as 'image' | 'video' | 'audio',
          origin: item.origin || 'upload' as const,
          storage_path: item.path || item.storage_path,
          created_at: item.created_at,
          updated_at: item.updated_at,
          size_bytes: item.size_bytes || 0,
          suggested_price_cents: item.suggested_price_cents || 0,
          tags: item.tags || [],
          notes: item.notes || null,
          mime: item.mime || '',
          creator_id: item.creator_id,
          tiny_placeholder: item.tiny_placeholder || undefined,
          width: item.width || undefined,
          height: item.height || undefined
        }));

      setContent(validMediaItems);
    } catch (error) {
      console.error('Error fetching content:', error);
    }
  }, [selectedCategory, searchQuery, selectedFilter, sortBy]); // Remove calculateCategoryCounts dependency

  const { copyToCollection, removeFromCollection, deleteMediaHard, createCollection, loading: operationLoading } = useMediaOperations({
    onRefreshNeeded: refetchContent,
    onCountsRefreshNeeded: calculateCategoryCounts
  });
  const { toast } = useToast();

  // User roles state
  const [userRoles, setUserRoles] = useState<string[]>([]);

  // Removed old preloader - now using advanced preloader above

  // Intersection observer for scroll-based preloading
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const preloadObserverRef = useRef<IntersectionObserver | null>(null);
  
  
  // Click handling state for single/double click detection
  const [lastClickTime, setLastClickTime] = useState<number>(0);
  const [clickTimeout, setClickTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Range selection state for shift+click
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number>(-1);
  
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
          // Fetch user roles
          fetchUserRoles(session.user.id);
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
        // Fetch user roles
        fetchUserRoles(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Fetch user roles function
  const fetchUserRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error fetching user roles:', error);
      } else {
        const roles = data?.map(item => item.role) || [];
        setUserRoles(roles);
      }
    } catch (error) {
      console.error('Error fetching user roles:', error);
    }
  };

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
        await refetchContent();
      } catch (error) {
        console.error('Error fetching content:', error);
      } finally {
        setLoadingContent(false);
      }
    };

    if (user) {
      fetchContent();
    }
  }, [user, selectedFilter, searchQuery, sortBy, selectedCategory]);

  // Fetch custom collections from database
  useEffect(() => {
    const fetchCustomCollections = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('collections')
          .select('*')
          .eq('system', false)
          .order('name', { ascending: true });

        if (error) {
          console.error('Error fetching collections:', error);
        } else {
          const folders = data?.map(collection => ({
            id: collection.id,
            label: collection.name,
            icon: Grid,
            description: collection.description || 'Custom folder',
            isDefault: false as const,
            count: 0
          })) || [];
          setCustomFolders(folders);
          // Remove direct call - let the other useEffect handle count calculation
        }
      } catch (error) {
        console.error('Error fetching collections:', error);
      }
    };

    if (user) {
      fetchCustomCollections();
    }
  }, [user]);

  // Update counts only when folders are first loaded, not on every change
  useEffect(() => {
    if (user && customFolders.length >= 0) {
      // Only calculate counts when folders are actually loaded, not on every change
      const timeoutId = setTimeout(() => {
        calculateCategoryCounts();
      }, 100); // Small delay to batch updates
      
      return () => clearTimeout(timeoutId);
    }
  }, [user, customFolders.length]); // Remove calculateCategoryCounts from deps

  // Disabled intersection observer to fix connection issues
  // useEffect(() => {
  //   // Preloading disabled
  // }, [content]);
  
  const preloadMore = () => {}; // Dummy function

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
  const handleToggleItem = (itemId: string, itemIndex?: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
      // If no items are selected after removal, exit selection mode
      if (newSelected.size === 0) {
        setSelecting(false);
        setLastSelectedIndex(-1);
      }
    } else {
      newSelected.add(itemId);
      // Enter selection mode when first item is selected
      if (!selecting) {
        setSelecting(true);
      }
      // Update last selected index for range selection
      if (itemIndex !== undefined) {
        setLastSelectedIndex(itemIndex);
      }
    }
    setSelectedItems(newSelected);
  };

  // Range selection handler for shift+click
  const handleRangeSelection = (fromIndex: number, toIndex: number) => {
    const startIndex = Math.min(fromIndex, toIndex);
    const endIndex = Math.max(fromIndex, toIndex);
    const newSelected = new Set(selectedItems);
    
    // Add all items in the range to selection
    for (let i = startIndex; i <= endIndex; i++) {
      if (content[i]) {
        newSelected.add(content[i].id);
      }
    }
    
    setSelectedItems(newSelected);
    setSelecting(true);
    setLastSelectedIndex(toIndex);
  };

  const handleClearSelection = () => {
    setSelecting(false);
    setSelectedItems(new Set());
    setLastSelectedIndex(-1);
  };

  const handleSelectAll = () => {
    const allItemIds = new Set(content.map(item => item.id));
    setSelectedItems(allItemIds);
  };

  const handleCopy = async (collectionIds: string[]) => {
    try {
      const selectedItemsArray = Array.from(selectedItems);
      
      // Copy to each selected collection
      for (const collectionId of collectionIds) {
        await copyToCollection(collectionId, selectedItemsArray);
      }
      
      handleClearSelection();
      
      // Show success message
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
  };

  const handleDelete = async () => {
    try {
      const selectedItemsArray = Array.from(selectedItems);
      const isCustomFolder = selectedCategory.startsWith('custom-') || !['all-files', 'stories', 'livestreams', 'messages'].includes(selectedCategory);
      
      if (isCustomFolder) {
        // Remove from collection only
        await removeFromCollection(selectedCategory, selectedItemsArray);
      } else {
        // Delete permanently with progress tracking
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
      // Refetch content to update UI
      await refetchContent();
    } catch (error) {
      console.error('Delete failed:', error);
      setDeletionProgress(prev => ({
        ...prev,
        isError: true,
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred'
      }));
    }
  };

  const handleCloseProgressDialog = () => {
    setDeletionProgress({
      open: false,
      totalFiles: 0,
      deletedFiles: 0,
      isComplete: false,
      isError: false,
      errorMessage: ''
    });
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
          description: collection.description || 'Custom folder',
          isDefault: false as const,
          count: 0
        }));
        setCustomFolders(folders);
        // Remove direct call - let the other useEffect handle count calculation
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

  const getContentTypeIcon = (type: string | any) => {
    // Handle both string and object types from database
    const typeValue = typeof type === 'object' && type?.value ? type.value : type;
    
    switch (typeValue) {
      case 'image': return <Image className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      case 'audio': return <FileAudio className="h-4 w-4" />;
      case 'document': return <FileText className="h-4 w-4" />;
      default: return <Grid className="h-4 w-4" />;
    }
  };

  const getTypeValue = (type: string | any): string => {
    return typeof type === 'object' && type?.value ? type.value : type || 'unknown';
  };

  // Add cleanup function for admins
  const handleCleanupCorruptedMedia = async () => {
    try {
      const { data, error } = await supabase.rpc('cleanup_corrupted_media');
      
      if (error) {
        console.error('Error cleaning up corrupted media:', error);
        toast({
          title: "Error",
          description: "Failed to clean up corrupted media",
          variant: "destructive"
        });
      } else {
        console.log('Cleanup result:', data);
        const result = data as { deleted_media_records: number };
        toast({
          title: "Success",
          description: `Successfully cleaned up ${result.deleted_media_records} corrupted records`
        });
        // Refresh the content after cleanup
        await refetchContent();
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
      toast({
        title: "Error", 
        description: "Failed to clean up corrupted media",
        variant: "destructive"
      });
    }
  };

  const handleCardClick = (item: MediaItem, event: React.MouseEvent, itemIndex: number) => {
    const currentTime = Date.now();
    const timeDiff = currentTime - lastClickTime;

    // Handle shift+click or alt+click for range selection
    if ((event.shiftKey || event.altKey) && selecting && lastSelectedIndex >= 0) {
      event.preventDefault();
      handleRangeSelection(lastSelectedIndex, itemIndex);
      return;
    }

    // Clear any existing timeout
    if (clickTimeout) {
      clearTimeout(clickTimeout);
      setClickTimeout(null);
    }

    // Double click detection (within 300ms)
    if (timeDiff < 300) {
      // Double click behavior
      event.preventDefault();
      if (selecting) {
        // In selection mode, double click opens preview
        setPreviewItem(item);
      } else {
        // In default mode, double click also opens preview (same as single click)
        setPreviewItem(item);
      }
      return;
    }

    // Single click - set timeout to handle it
    setLastClickTime(currentTime);
    const timeout = setTimeout(() => {
      // Single click behavior
      if (selecting) {
        // In selection mode, single click toggles selection
        handleToggleItem(item.id, itemIndex);
      } else {
        // In default mode, single click opens preview
        setPreviewItem(item);
      }
    }, 300);

    setClickTimeout(timeout);
  };

  const handleCheckboxClick = (itemId: string, itemIndex: number, event?: React.MouseEvent) => {
    // Handle shift+click or alt+click for range selection on checkboxes
    if ((event?.shiftKey || event?.altKey) && selecting && lastSelectedIndex >= 0) {
      event.preventDefault();
      handleRangeSelection(lastSelectedIndex, itemIndex);
      return;
    }

    // Always toggle selection when checkbox is clicked
    // This will enter selection mode if not already active
    handleToggleItem(itemId, itemIndex);
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
                  {categoryCounts[category.id] || 0}
                </Badge>
              </div>
            );
          })}
        </div>

        {/* Horizontal Divider */}
        <div className="border-t border-border my-4"></div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-center gap-2">
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
          </div>
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
                                label: folder.label
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
                           {categoryCounts[folder.id] || 0}
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
                <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
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
                    { id: 'audio', label: 'Audio' }
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

            {/* Selection Toolbar - only show when selecting */}
            {selecting && (
              <LibrarySelectionToolbar
                selectedCount={selectedItems.size}
                totalCount={content.length}
                currentView={defaultCategories.find(c => c.id === selectedCategory)?.label || 
                  customFolders.find(c => c.id === selectedCategory)?.label || 'Library'}
                isCustomFolder={isCustomFolder}
                onClearSelection={handleClearSelection}
                onSelectAll={handleSelectAll}
                onCopy={handleCopy}
                onDelete={handleDelete}
                disabled={operationLoading || loadingContent}
              />
            )}

            {/* Content Grid */}
            <div className="flex-1 overflow-y-auto">
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
                 <div 
                   ref={gridContainerRef}
                   className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1 select-none"
                 >
                  {content.map((item, index) => (
                    <Card 
                      key={item.id}
                      data-index={index}
                      className={`bg-gradient-card shadow-card hover:shadow-lg transition-all cursor-pointer relative overflow-hidden ${
                        selectedItems.has(item.id) 
                          ? 'border-2 border-primary' 
                          : 'border border-border'
                      }`}
                      onClick={(event) => handleCardClick(item, event, index)}
                     >
                       {/* Selection checkbox in top right corner */}
                       <div className="absolute top-2 right-2 z-10">
                           <div 
                             className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                               selectedItems.has(item.id) 
                                 ? 'bg-primary border-primary text-primary-foreground' 
                                 : 'bg-background/80 border-muted-foreground backdrop-blur-sm'
                             }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCheckboxClick(item.id, index, e);
                              }}
                           >
                           {selectedItems.has(item.id) && <Check className="h-3 w-3" />}
                         </div>
                       </div>

                       <CardContent className="p-0 relative">
                        {/* Date in top left corner */}
                        <div className="absolute top-2 left-2 z-10 text-xs text-white bg-black/50 rounded px-1.5 py-0.5">
                          {new Date(item.created_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </div>

                        {/* Thumbnail */}
                        <MediaThumbnail 
                          item={{
                            type: item.type,
                            storage_path: item.storage_path,
                            title: item.title,
                            tiny_placeholder: item.tiny_placeholder,
                            width: item.width,
                            height: item.height
                          }}
                        />
                        
                         {/* Categories at bottom */}
                        <div className="absolute bottom-2 left-2 right-2 z-10">
                          <div className="text-xs text-white bg-black/50 rounded px-1.5 py-0.5 truncate">
                            {(() => {
                              const defaultTags = ['upload', 'story', 'livestream', 'message'];
                              const customTags = item.tags.filter(tag => !defaultTags.includes(tag.toLowerCase()));
                              return customTags.length > 0 ? customTags.join(', ') : item.origin;
                            })()}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <DeletionProgressDialog
            open={deletionProgress.open}
            totalFiles={deletionProgress.totalFiles}
            deletedFiles={deletionProgress.deletedFiles}
            isComplete={deletionProgress.isComplete}
            isError={deletionProgress.isError}
            errorMessage={deletionProgress.errorMessage}
            onClose={handleCloseProgressDialog}
          />
          
        <MediaPreviewDialog
          open={!!previewItem}
          onOpenChange={(open) => !open && setPreviewItem(null)}
          item={previewItem}
          allItems={content}
          selectedItems={selectedItems}
          onToggleSelection={(itemId: string) => handleToggleItem(itemId)}
          onItemChange={(item) => setPreviewItem(item)}
        />
    </div>
  );
};

export default ContentLibrary;
