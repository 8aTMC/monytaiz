import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LibraryFilterState, UseLibraryDataProps } from '@/types/library-filters';

interface MediaItem {
  id: string;
  title: string | null;
  origin: 'upload' | 'story' | 'livestream' | 'message';
  storage_path: string;
  mime: string;
  type: 'image' | 'video' | 'audio' | 'gif';
  size_bytes: number;
  tags: string[];
  mentions: string[];
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

export const useLibraryData = ({
  selectedCategory,
  searchQuery,
  selectedFilter,
  sortBy,
  advancedFilters
}: UseLibraryDataProps) => {
  const [content, setContent] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  
  // Use refs to prevent infinite loops
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastParamsRef = useRef<string>('');

  const fetchContent = useCallback(async (
    category: string,
    search: string,
    filter: string,
    sort: string,
    filters?: LibraryFilterState
  ) => {
    // Create stable parameter signature to prevent duplicate calls
    const filtersSignature = filters ? JSON.stringify(filters) : '';
    const paramsSignature = `${category}|${search}|${filter}|${sort}|${filtersSignature}`;
    if (lastParamsRef.current === paramsSignature) return;
    
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    lastParamsRef.current = paramsSignature;
    
    setLoading(true);
    try {
      let combinedData: any[] = [];

      // Fetch based on category
      if (category === 'all-files') {
        const [mediaResults, contentResults, simpleMediaResults] = await Promise.all([
          supabase
            .from('media')
            .select('id, bucket, path, storage_path, mime, type, size_bytes, title, notes, tags, suggested_price_cents, creator_id, created_at, updated_at, tiny_placeholder, width, height, origin')
            .order('created_at', { ascending: false })
            .abortSignal(abortControllerRef.current.signal),
          supabase
            .from('content_files')
            .select('id, title, content_type, file_path, file_size, mime_type, base_price, tags, description, creator_id, created_at, updated_at, is_active')
            .eq('is_active', true)
            .not('content_type', 'is', null)
            .not('file_path', 'is', null)
            .not('file_path', 'eq', '')
            .gt('file_size', 0)
            .order('created_at', { ascending: false })
            .abortSignal(abortControllerRef.current.signal),
        supabase
          .from('simple_media')
          .select('id, original_path, processed_path, thumbnail_path, mime_type, media_type, original_size_bytes, title, description, tags, mentions, suggested_price_cents, revenue_generated_cents, creator_id, created_at, updated_at, width, height, processing_status')
          .eq('processing_status', 'processed')
          .order('created_at', { ascending: false })
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
          const convertedSimpleMedia = simpleMediaResults.data.map(item => {
            // For GIFs, prioritize original path to preserve animation
            const isGif = item.mime_type === 'image/gif' || item.original_path?.toLowerCase().includes('.gif');
            const storagePath = isGif ? (item.original_path || item.processed_path) : (item.processed_path || item.original_path);
            const mediaType = isGif ? 'gif' : item.media_type;
            
            console.log('📊 SimpleMedia conversion:', item.id, 'mime:', item.mime_type, 'isGif:', isGif, 'type:', mediaType, 'path:', storagePath);
            
            return {
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
          });

          combinedData = [...combinedData, ...convertedSimpleMedia];
        }
      } else if (category === 'messages') {
        const { data: mediaResults } = await supabase
          .from('media')
          .select('id, bucket, path, storage_path, mime, type, size_bytes, title, notes, tags, suggested_price_cents, creator_id, created_at, updated_at, tiny_placeholder, width, height, origin')
          .in('origin', ['message', 'chat'])
          .order('created_at', { ascending: false })
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
          .abortSignal(abortControllerRef.current.signal);

        if (collectionItems) {
          combinedData = collectionItems
            .filter(item => item.media)
            .map(item => item.media);
        }
      }

      // Apply search filter
      if (search && combinedData.length > 0) {
        const searchTerms = search.trim().split(/\s+/).map(term => term.toLowerCase());
        combinedData = combinedData.filter(item => {
          const searchableText = [
            item.title || '',
            ...(item.tags || [])
          ].join(' ').toLowerCase();
          return searchTerms.some(term => searchableText.includes(term));
        });
      }

      // Apply type filter
      if (filter !== 'all' && combinedData.length > 0) {
        combinedData = combinedData.filter(item => item.type === filter);
      }

       // Apply advanced filters
       if (filters && combinedData.length > 0) {
         console.log('🎛️ Filtering media with advanced filters:', filters);
         console.log('🎛️ Combined data before filtering:', combinedData.length, 'items');
         
          // Filter by collaborators
          if (filters.collaborators.length > 0) {
            const beforeCollaboratorFilter = combinedData.length;
            console.log('👥 Filtering by collaborators:', filters.collaborators);
            
            try {
              // Primary method: Use media_collaborators join table for canonical mapping
              const { data: mappedCollaborators, error: mappingError } = await supabase
                .from('media_collaborators')
                .select('media_id, media_table')
                .in('collaborator_id', filters.collaborators);

              console.log('👥 Media collaborators mapping result:', { mappedCollaborators, mappingError });

              if (!mappingError && mappedCollaborators && mappedCollaborators.length > 0) {
                // Use canonical mapping
                const mappedMediaIds = new Set(mappedCollaborators.map(mc => mc.media_id));
                console.log('👥 Found mapped media IDs:', Array.from(mappedMediaIds));
                
                combinedData = combinedData.filter(item => {
                  const hasMapping = mappedMediaIds.has(item.id);
                  console.log(`👥 ${hasMapping ? '✅' : '❌'} Item ${item.id} ${hasMapping ? 'has' : 'lacks'} collaborator mapping`);
                  return hasMapping;
                });
              } else {
                console.log('👥 No canonical mapping found, falling back to fuzzy matching');
                
                // Fallback: Fuzzy matching like before
                const { data: collaboratorData, error: collaboratorError } = await supabase
                  .from('collaborators')
                  .select('id, name, username')
                  .in('id', filters.collaborators);
                
                console.log('👥 Collaborator lookup result:', { collaboratorData, collaboratorError });
                
                if (collaboratorError) {
                  console.error('👥 Error fetching collaborators:', collaboratorError);
                } else if (!collaboratorData || collaboratorData.length === 0) {
                  console.warn('👥 No collaborators found for IDs:', filters.collaborators);
                } else {
                  const normalize = (s: string) => s
                    .toLowerCase()
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                  const buildKeys = (name?: string | null, username?: string | null) => {
                    const raw: string[] = [];
                    if (name) raw.push(name);
                    if (username) raw.push(username);
                    const keys = new Set<string>();
                    raw.forEach(r => {
                      const n = normalize(r);
                      if (!n) return;
                      keys.add(n);
                      keys.add(n.replace(/\s+/g, ''));
                      keys.add(n.replace(/[@#]/g, ''));
                    });
                    raw.forEach(r => {
                      const n = normalize(r).replace(/^@/, '');
                      if (n) keys.add(`@${n}`);
                    });
                    return Array.from(keys);
                  };

                  const collaboratorKeys = collaboratorData.flatMap(c => buildKeys(c.name, (c as any).username));
                  console.log('👥 Fallback: Using fuzzy matching with keys:', collaboratorKeys);
                  console.log('👥 Sample media data to check:', combinedData.slice(0, 3).map(item => ({ 
                    id: item.id, 
                    title: item.title,
                    mentions: item.mentions, 
                    tags: item.tags 
                  })));
                  
                  combinedData = combinedData.filter(item => {
                    let hasMatch = false;
                    let matchReason = '';

                    const normArray = (arr?: string[]) =>
                      Array.isArray(arr) ? arr.map(v => normalize(v).replace(/^@/, '')) : [];

                    const mentions = normArray(item.mentions);
                    const tags = normArray(item.tags);
                    const text = normalize(`${item.title || ''} ${item.description || ''} ${item.notes || ''}`);

                    const arrayMatch = (arr: string[], arrName: string) =>
                      arr.some(val =>
                        collaboratorKeys.some(k => {
                          const match = val.includes(k.replace(/^@/, '')) || (`@${val}`).includes(k);
                          if (match && !hasMatch) {
                            matchReason = `${arrName}: "${val}"`;
                            console.log(`👥 Found ${arrName} match for ${item.id}: "${val}" ~ ${k}`);
                          }
                          return match;
                        })
                      );

                    if (mentions.length && arrayMatch(mentions, 'mention')) hasMatch = true;
                    if (!hasMatch && tags.length && arrayMatch(tags, 'tag')) hasMatch = true;
                    if (!hasMatch && text && collaboratorKeys.some(k => text.includes(k.replace(/^@/, '')))) {
                      matchReason = `text`;
                      hasMatch = true;
                    }

                    if (hasMatch) {
                      console.log(`👥 ✅ Item ${item.id} matches via ${matchReason}`);
                    } else {
                      console.log(`👥 ❌ Item ${item.id} doesn't match - mentions:`, item.mentions, 'tags:', item.tags);
                    }
                    
                    return hasMatch;
                  });
                }
              }
            } catch (error) {
              console.error('👥 Error in collaborator filtering:', error);
            }
            
            console.log(`👥 Filtered ${beforeCollaboratorFilter} items down to ${combinedData.length} items`);
          }

         // Filter by tags
         if (filters.tags.length > 0) {
           const beforeTagFilter = combinedData.length;
           console.log('🏷️ Filtering by tags:', filters.tags);
           console.log('🏷️ Sample media tags:', combinedData.slice(0, 3).map(item => ({ id: item.id, tags: item.tags })));
           
           combinedData = combinedData.filter(item => {
             if (!item.tags || !Array.isArray(item.tags) || item.tags.length === 0) return false;
             
             const hasMatchingTag = filters.tags.some(filterTag => 
               item.tags.some(itemTag => itemTag.toLowerCase().includes(filterTag.toLowerCase()))
             );
             
             if (hasMatchingTag) {
               console.log('🏷️ Match found:', item.id, 'tags:', item.tags, 'matched filter:', filters.tags);
             }
             
             return hasMatchingTag;
           });
           
            console.log(`🏷️ Filtered ${beforeTagFilter} items down to ${combinedData.length} items`);
          }

          // Filter by mentions
          if (filters.mentions && filters.mentions.length > 0) {
            const beforeMentionFilter = combinedData.length;
            console.log('🗣️ Filtering by mentions:', filters.mentions);
            console.log('🗣️ Sample media mentions:', combinedData.slice(0, 3).map(item => ({ id: item.id, mentions: item.mentions })));
            
            combinedData = combinedData.filter(item => {
              if (!item.mentions || !Array.isArray(item.mentions) || item.mentions.length === 0) return false;
              
              const hasMatchingMention = filters.mentions.some(filterMention => 
                item.mentions.some(itemMention => {
                  // Handle both @mention and mention formats
                  const normalizedFilter = filterMention.replace(/^@/, '').toLowerCase();
                  const normalizedItem = itemMention.replace(/^@/, '').toLowerCase();
                  return normalizedItem.includes(normalizedFilter) || normalizedFilter.includes(normalizedItem);
                })
              );
              
              if (hasMatchingMention) {
                console.log('🗣️ Mention match found:', item.id, 'mentions:', item.mentions, 'matched filter:', filters.mentions);
              }
              
              return hasMatchingMention;
            });
            
            console.log(`🗣️ Filtered ${beforeMentionFilter} items down to ${combinedData.length} items`);
          }

          // Filter by price range
         if (filters.priceRange[0] > 0 || filters.priceRange[1] < 1000000) {
           combinedData = combinedData.filter(item => {
             const price = item.suggested_price_cents || 0;
             return price >= filters.priceRange[0] && price <= filters.priceRange[1];
           });
         }
       }

      // Apply sorting
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
          mentions: item.mentions || [],
          notes: item.notes || null,
          mime: item.mime || '',
          creator_id: item.creator_id,
          tiny_placeholder: item.tiny_placeholder || undefined,
          thumbnail_path: item.thumbnail_path || undefined,
          width: item.width || undefined,
          height: item.height || undefined
        }));

      setContent(validMediaItems);
    } catch (error: any) {
      // Ignore abort errors
      if (error.name !== 'AbortError') {
        console.error('Error fetching content:', error);
        setContent([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategoryCounts = useCallback(async () => {
    try {
      const counts: Record<string, number> = {};
      
      // All Files count
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
      
      counts['all-files'] = (allMediaResults.count || 0) + uniqueContentFiles.length + (allSimpleMediaResults.count || 0);
      
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

  // Stable trigger function
  const triggerFetch = useCallback(() => {
    fetchContent(selectedCategory, searchQuery, selectedFilter, sortBy, advancedFilters);
  }, [fetchContent, selectedCategory, searchQuery, selectedFilter, sortBy, advancedFilters]);

  // Only trigger when parameters actually change
  useEffect(() => {
    triggerFetch();
  }, [selectedCategory, searchQuery, selectedFilter, sortBy, advancedFilters]);

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
    content,
    loading,
    categoryCounts,
    fetchContent: triggerFetch,
    fetchCategoryCounts,
    updateFolderCount
  };
};