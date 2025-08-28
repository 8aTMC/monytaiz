
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

interface UseLibraryDataProps {
  selectedCategory: string;
  searchQuery: string;
  selectedFilter: string;
  sortBy: string;
}

export const useLibraryData = ({
  selectedCategory,
  searchQuery,
  selectedFilter,
  sortBy
}: UseLibraryDataProps) => {
  const [content, setContent] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  
  // Add abort controller to prevent memory leaks
  const abortControllerRef = useRef<AbortController | null>(null);
  const [lastCategoryChange, setLastCategoryChange] = useState<string>('');

  const fetchContent = useCallback(async () => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    
    try {
      let combinedData: any[] = [];

      // Fetch based on category
      if (selectedCategory === 'all-files') {
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

        if (mediaResults.data) {
          combinedData = [...mediaResults.data];
        }

        if (contentResults.data) {
          const mediaStoragePaths = new Set(mediaResults.data?.map(item => item.path || item.storage_path) || []);
          const legacyItems = contentResults.data.filter(item => !mediaStoragePaths.has(item.file_path));
          
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
      } else if (selectedCategory === 'messages') {
        const { data: mediaResults } = await supabase
          .from('media')
          .select('id, bucket, path, storage_path, mime, type, size_bytes, title, notes, tags, suggested_price_cents, creator_id, created_at, updated_at, tiny_placeholder, width, height, origin')
          .in('origin', ['message', 'chat'])
          .order('created_at', { ascending: false });

        if (mediaResults) {
          combinedData = [...mediaResults];
        }
      } else if (!['stories', 'livestreams'].includes(selectedCategory)) {
        // Custom folder
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

      // Apply filters
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

      // Check if request was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      setContent(validMediaItems);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Fetch aborted:', error.message);
        return;
      }
      console.error('Error fetching content:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery, selectedFilter, sortBy]);

  const fetchCategoryCounts = useCallback(async () => {
    try {
      const counts: Record<string, number> = {};
      
      // All Files count
      const [allMediaResults, allContentResults] = await Promise.all([
        supabase.from('media').select('id', { count: 'exact' }),
        supabase
          .from('content_files')
          .select('id', { count: 'exact' })
          .eq('is_active', true)
          .not('content_type', 'is', null)
          .not('file_path', 'is', null)
          .not('file_path', 'eq', '')
          .gt('file_size', 0)
      ]);
      
      const { data: mediaIds } = await supabase.from('media').select('id');
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
      
      // Messages count
      const { count: messagesCount } = await supabase
        .from('media')
        .select('id', { count: 'exact' })
        .in('origin', ['message', 'chat']);
      
      counts['messages'] = messagesCount || 0;
      counts['stories'] = 0;
      counts['livestreams'] = 0;
      
      setCategoryCounts(counts);
    } catch (error) {
      console.error('Error calculating category counts:', error);
    }
  }, []);

  const updateFolderCount = useCallback(async (folderId: string) => {
    try {
      const { count: folderCount } = await supabase
        .from('collection_items')
        .select('media_id', { count: 'exact' })
        .eq('collection_id', folderId);
      
      setCategoryCounts(prev => ({
        ...prev,
        [folderId]: folderCount || 0
      }));
    } catch (error) {
      console.error('Error updating folder count:', error);
    }
  }, []);

  // Debounced category change effect
  useEffect(() => {
    if (selectedCategory !== lastCategoryChange) {
      setLastCategoryChange(selectedCategory);
      
      const timeoutId = setTimeout(() => {
        fetchContent();
      }, 100); // Small debounce to prevent rapid category switching issues
      
      return () => clearTimeout(timeoutId);
    } else {
      fetchContent();
    }
  }, [selectedCategory, searchQuery, selectedFilter, sortBy, fetchContent, lastCategoryChange]);

  useEffect(() => {
    fetchCategoryCounts();
  }, [fetchCategoryCounts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    content,
    loading,
    categoryCounts,
    fetchContent,
    fetchCategoryCounts,
    updateFolderCount
  };
};
