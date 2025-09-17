import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LibraryFilterState } from '@/types/library-filters';

interface MediaItem {
  id: string;
  title: string | null;
  origin: 'upload' | 'story' | 'livestream' | 'message';
  storage_path: string;
  mime: string;
  type: 'image' | 'video' | 'audio' | 'gif';
  size_bytes: number;
  tags: string[];
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

interface UseInfiniteLibraryDataProps {
  selectedCategory: string;
  searchQuery: string;
  selectedFilter: string;
  sortBy: string;
  advancedFilters?: LibraryFilterState;
  pageSize?: number;
}

export const useInfiniteLibraryData = ({
  selectedCategory,
  searchQuery,
  selectedFilter,
  sortBy,
  advancedFilters,
  pageSize = 30
}: UseInfiniteLibraryDataProps) => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  
  const currentPage = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastParamsRef = useRef<string>('');

  // Reset pagination when params change
  const resetPagination = useCallback(() => {
    currentPage.current = 0;
    setItems([]);
    setHasNextPage(true);
  }, []);

  const fetchPage = useCallback(async (
    category: string,
    search: string,
    filter: string,
    sort: string,
    filters: LibraryFilterState | undefined,
    page: number,
    isAppending: boolean = false
  ) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    if (!isAppending) setLoading(true);
    else setIsLoadingMore(true);
    
    try {
      let combinedData: any[] = [];
      const offset = page * pageSize;

      // Fetch based on category with pagination
      if (category === 'all-files') {
        const [mediaResults, contentResults, simpleMediaResults] = await Promise.all([
          supabase
            .from('media')
            .select('id, bucket, path, storage_path, mime, type, size_bytes, title, notes, tags, suggested_price_cents, creator_id, created_at, updated_at, tiny_placeholder, width, height, origin')
            .order('created_at', { ascending: sort === 'oldest' })
            .range(offset, offset + pageSize - 1)
            .abortSignal(abortControllerRef.current.signal),
          supabase
            .from('content_files')
            .select('id, title, content_type, file_path, file_size, mime_type, base_price, tags, description, creator_id, created_at, updated_at, is_active')
            .eq('is_active', true)
            .not('content_type', 'is', null)
            .not('file_path', 'is', null)
            .not('file_path', 'eq', '')
            .gt('file_size', 0)
            .order('created_at', { ascending: sort === 'oldest' })
            .range(Math.floor(offset / 2), Math.floor(offset / 2) + Math.floor(pageSize / 2) - 1)
            .abortSignal(abortControllerRef.current.signal),
          supabase
            .from('simple_media')
            .select('id, original_path, processed_path, thumbnail_path, mime_type, media_type, original_size_bytes, title, description, tags, mentions, suggested_price_cents, revenue_generated_cents, creator_id, created_at, updated_at, width, height, processing_status')
            .eq('processing_status', 'processed')
            .order('created_at', { ascending: sort === 'oldest' })
            .range(Math.floor(offset / 2), Math.floor(offset / 2) + Math.floor(pageSize / 2) - 1)
            .abortSignal(abortControllerRef.current.signal)
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

        if (simpleMediaResults.data) {
          console.log('🔍 SIMPLE_MEDIA DEBUG - Raw data from database:', {
            dataLength: simpleMediaResults.data.length,
            sampleItem: simpleMediaResults.data[0] ? {
              id: simpleMediaResults.data[0].id,
              title: simpleMediaResults.data[0].title,
              description: simpleMediaResults.data[0].description,
              tags: simpleMediaResults.data[0].tags,
              mentions: simpleMediaResults.data[0].mentions,
              suggested_price_cents: simpleMediaResults.data[0].suggested_price_cents
            } : 'no data'
          });

          const convertedSimpleMedia = simpleMediaResults.data.map(item => {
            const isGif = item.mime_type === 'image/gif' || item.original_path?.toLowerCase().includes('.gif');
            const storagePath = isGif ? (item.original_path || item.processed_path) : (item.processed_path || item.original_path);
            const mediaType = isGif ? 'gif' : item.media_type;
            
            const convertedItem = {
              id: item.id,
              title: item.title || 'Untitled',
              type: mediaType,
              bucket: 'content',
              path: storagePath,
              storage_path: storagePath,
              mime: item.mime_type || '',
              size_bytes: item.original_size_bytes || 0,
              suggested_price_cents: item.suggested_price_cents || 0,
              revenue_generated_cents: item.revenue_generated_cents || 0,
              tags: item.tags || [],
              mentions: item.mentions || [],
              notes: item.description || null,
              creator_id: item.creator_id,
              created_at: item.created_at,
              updated_at: item.updated_at,
              origin: 'upload',
              tiny_placeholder: undefined,
              thumbnail_path: item.thumbnail_path,
              width: item.width,
              height: item.height
            };
            
            console.log('🔍 CONVERTED ITEM DEBUG:', {
              originalId: item.id,
              originalTitle: item.title,
              originalTags: item.tags,
              originalDescription: item.description,
              converted: convertedItem
            });
            
            return convertedItem;
          });

          combinedData = [...combinedData, ...convertedSimpleMedia];
        }
      } else if (category === 'messages') {
        const { data: mediaResults } = await supabase
          .from('media')
          .select('id, bucket, path, storage_path, mime, type, size_bytes, title, notes, tags, suggested_price_cents, creator_id, created_at, updated_at, tiny_placeholder, width, height, origin')
          .in('origin', ['message', 'chat'])
          .order('created_at', { ascending: sort === 'oldest' })
          .range(offset, offset + pageSize - 1)
          .abortSignal(abortControllerRef.current.signal);

        if (mediaResults) {
          combinedData = [...mediaResults];
        }
      } else if (!['stories', 'livestreams'].includes(category)) {
        // Custom folder
        const { data: collectionItems } = await supabase
          .from('collection_items')
          .select(`
            media_id,
            media:media_id (id, bucket, path, storage_path, mime, type, size_bytes, title, notes, tags, suggested_price_cents, creator_id, created_at, updated_at, tiny_placeholder, width, height, origin)
          `)
          .eq('collection_id', category)
          .range(offset, offset + pageSize - 1)
          .abortSignal(abortControllerRef.current.signal);

        if (collectionItems) {
          combinedData = collectionItems
            .filter(item => item.media)
            .map(item => item.media);
        }
      }

      // Apply filters (search, type, advanced filters)
      if (search && combinedData.length > 0) {
        const searchTerms = search.trim().split(/\\s+/).map(term => term.toLowerCase());
        combinedData = combinedData.filter(item => {
          const searchableText = [
            item.title || '',
            ...(item.tags || [])
          ].join(' ').toLowerCase();
          return searchTerms.some(term => searchableText.includes(term));
        });
      }

      if (filter !== 'all' && combinedData.length > 0) {
        combinedData = combinedData.filter(item => item.type === filter);
      }

      // Apply advanced filters (same logic as original)
      if (filters && combinedData.length > 0) {
        if (filters.collaborators.length > 0) {
          try {
            const { data: collaboratorData, error: collaboratorError } = await supabase
              .from('collaborators')
              .select('id, name')
              .in('id', filters.collaborators);
            
            if (!collaboratorError && collaboratorData && collaboratorData.length > 0) {
              const collaboratorNames = collaboratorData.map(c => c.name.toLowerCase());
              
              combinedData = combinedData.filter(item => {
                if (item.mentions && Array.isArray(item.mentions)) {
                  const mentionMatch = item.mentions.some((mention: string) => 
                    collaboratorNames.some(name => mention.toLowerCase().includes(name))
                  );
                  if (mentionMatch) return true;
                }
                
                if (item.tags && Array.isArray(item.tags)) {
                  const tagMatch = item.tags.some((tag: string) => 
                    collaboratorNames.some(name => 
                      tag.toLowerCase().includes(name) || 
                      (tag.startsWith('@') && tag.substring(1).toLowerCase().includes(name))
                    )
                  );
                  if (tagMatch) return true;
                }
                
                const searchText = `${item.title || ''} ${item.description || ''} ${item.notes || ''}`.toLowerCase();
                const textMatch = collaboratorNames.some(name => searchText.includes(name));
                if (textMatch) return true;
                
                return false;
              });
            }
          } catch (error) {
            // Continue without collaborator filtering if there's an error
          }
        }

        if (filters.tags.length > 0) {
          combinedData = combinedData.filter(item => {
            if (!item.tags || !Array.isArray(item.tags) || item.tags.length === 0) return false;
            
            return filters.tags.some(filterTag => 
              item.tags.some(itemTag => itemTag.toLowerCase().includes(filterTag.toLowerCase()))
            );
          });
        }

        if (filters.priceRange[0] > 0 || filters.priceRange[1] < 1000000) {
          combinedData = combinedData.filter(item => {
            const price = item.suggested_price_cents || 0;
            return price >= filters.priceRange[0] && price <= filters.priceRange[1];
          });
        }
      }

      // Apply sorting (client-side for this page)
      if (combinedData.length > 0) {
        if (sort === 'newest') {
          combinedData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        } else if (sort === 'oldest') {
          combinedData.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        } else if (sort === 'price_high') {
          combinedData.sort((a, b) => (b.suggested_price_cents || 0) - (a.suggested_price_cents || 0));
        } else if (sort === 'price_low') {
          combinedData.sort((a, b) => (a.suggested_price_cents || 0) - (b.suggested_price_cents || 0));
        }
      }

      // Convert to MediaItem format
      const validMediaItems = combinedData
        .filter(item => item && item.type && (item.path || item.storage_path) && item.size_bytes > 0)
        .map(item => ({
          id: item.id,
          title: item.title || 'Untitled',
          type: item.type as 'image' | 'video' | 'audio' | 'gif',
          origin: item.origin || 'upload' as const,
          storage_path: item.path || item.storage_path,
          created_at: item.created_at,
          updated_at: item.updated_at,
          size_bytes: item.size_bytes || 0,
          suggested_price_cents: item.suggested_price_cents || 0,
          revenue_generated_cents: item.revenue_generated_cents || 0,
          tags: item.tags || [],
          notes: item.notes || null,
          mime: item.mime || '',
          creator_id: item.creator_id,
          tiny_placeholder: item.tiny_placeholder || undefined,
          thumbnail_path: item.thumbnail_path || undefined,
          width: item.width || undefined,
          height: item.height || undefined
        }));

      // Check if we have more pages
      const hasMore = validMediaItems.length === pageSize;
      setHasNextPage(hasMore);

      if (isAppending) {
        setItems(prev => [...prev, ...validMediaItems]);
      } else {
        setItems(validMediaItems);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching content:', error);
        if (!isAppending) setItems([]);
      }
    } finally {
      if (!isAppending) setLoading(false);
      else setIsLoadingMore(false);
    }
  }, [pageSize]);

  const fetchCategoryCounts = useCallback(async () => {
    try {
      const counts: Record<string, number> = {};
      
      // All Files count (simplified for better performance)
      const [allMediaResults, allContentResults, allSimpleMediaResults] = await Promise.all([
        supabase.from('media').select('id', { count: 'exact' }),
        supabase
          .from('content_files')
          .select('id', { count: 'exact' })
          .eq('is_active', true)
          .not('content_type', 'is', null)
          .not('file_path', 'is', null)
          .not('file_path', 'eq', '')
          .gt('file_size', 0),
        supabase
          .from('simple_media')
          .select('id', { count: 'exact' })
          .eq('processing_status', 'processed')
      ]);
      
      counts['all-files'] = (allMediaResults.count || 0) + (allContentResults.count || 0) + (allSimpleMediaResults.count || 0);
      
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

  // Load more items
  const loadMore = useCallback(() => {
    if (!hasNextPage || isLoadingMore) return;
    
    currentPage.current += 1;
    fetchPage(selectedCategory, searchQuery, selectedFilter, sortBy, advancedFilters, currentPage.current, true);
  }, [fetchPage, selectedCategory, searchQuery, selectedFilter, sortBy, advancedFilters, hasNextPage, isLoadingMore]);

  // Refresh function
  const refresh = useCallback(() => {
    resetPagination();
    currentPage.current = 0;
    fetchPage(selectedCategory, searchQuery, selectedFilter, sortBy, advancedFilters, 0, false);
  }, [fetchPage, selectedCategory, searchQuery, selectedFilter, sortBy, advancedFilters, resetPagination]);

  // Reset and fetch when parameters change
  useEffect(() => {
    const filtersSignature = advancedFilters ? JSON.stringify(advancedFilters) : '';
    const paramsSignature = `${selectedCategory}|${searchQuery}|${selectedFilter}|${sortBy}|${filtersSignature}`;
    
    if (lastParamsRef.current !== paramsSignature) {
      lastParamsRef.current = paramsSignature;
      resetPagination();
      currentPage.current = 0;
      fetchPage(selectedCategory, searchQuery, selectedFilter, sortBy, advancedFilters, 0, false);
    }
  }, [selectedCategory, searchQuery, selectedFilter, sortBy, advancedFilters, resetPagination, fetchPage]);

  // Load counts only once on mount
  useEffect(() => {
    fetchCategoryCounts();
  }, [fetchCategoryCounts]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    items,
    loading,
    isLoadingMore,
    hasNextPage,
    categoryCounts,
    loadMore,
    refresh,
    fetchCategoryCounts
  };
};
