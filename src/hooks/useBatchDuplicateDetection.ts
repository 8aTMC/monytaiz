import { supabase } from '@/integrations/supabase/client';
import { FileUploadItem } from './useFileUpload';
import { logger } from '@/utils/logging';

export interface QueueDuplicate {
  queueFile: FileUploadItem;
  duplicateFile: FileUploadItem;
  sourceType: 'queue';
}

export interface DatabaseDuplicate {
  queueFile: FileUploadItem;
  existingFile: {
    id: string;
    title: string;
    original_filename: string;
    original_size_bytes: number;
    optimized_size_bytes?: number;
    mime_type: string;
    created_at: string;
    thumbnail_path?: string;
    processed_path?: string;
    processing_status: string;
  };
  sourceType: 'database';
}

export type DuplicateMatch = QueueDuplicate | DatabaseDuplicate;


// Simple cache for duplicate results (5 minute TTL)
interface CacheEntry {
  result: DuplicateMatch[];
  timestamp: number;
}

const duplicateCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCacheKey = (files: FileUploadItem[]): string => {
  return files
    .map(f => `${f.file.name}:${f.file.size}`)
    .sort()
    .join('|');
};

export const useBatchDuplicateDetection = () => {
  // Check for duplicates within the upload queue
  const checkQueueDuplicates = async (uploadQueue: FileUploadItem[]): Promise<QueueDuplicate[]> => {
    const duplicates: QueueDuplicate[] = [];
    // Include files that are pending or could potentially be uploaded
    const processFiles = uploadQueue.filter(f => ['pending', 'error', 'cancelled'].includes(f.status));
    
    if (processFiles.length < 2) return duplicates;
    
    // Compare each file with all other files for exact filename + size match
    for (let i = 0; i < processFiles.length; i++) {
      const fileA = processFiles[i];
      
      for (let j = i + 1; j < processFiles.length; j++) {
        const fileB = processFiles[j];
        
        if (fileA.file.name === fileB.file.name && fileA.file.size === fileB.file.size) {
          duplicates.push({
            queueFile: fileA,
            duplicateFile: fileB,
            sourceType: 'queue'
          });
        }
      }
    }
    
    return duplicates;
  };

  // OPTIMIZED: Batch database duplicate detection  
  const checkDatabaseDuplicates = async (
    uploadQueue: FileUploadItem[], 
    onProgress?: (current: number, total: number) => void
  ): Promise<DatabaseDuplicate[]> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error('User not authenticated');
      }

      const duplicates: DatabaseDuplicate[] = [];
      // Include files that are pending or could potentially be uploaded - same as queue duplicates
      const processFiles = uploadQueue.filter(f => ['pending', 'error', 'cancelled'].includes(f.status));
      
      if (processFiles.length === 0) return duplicates;

      logger.debug('🧭 Database duplicate check - Processing files', processFiles.map(f => ({ name: f.file.name, size: f.file.size, status: f.status })));

      onProgress?.(0, 1);

      // Get all exact filename matches only
      const filenames = processFiles.map(f => f.file.name);
      
      // Deduplicate filenames to keep query efficient
      const uniqueFilenames = Array.from(new Set(filenames));
      const { data: exactMatches, error: exactError } = await supabase
        .from('simple_media')
        .select('id, title, original_filename, original_size_bytes, optimized_size_bytes, mime_type, created_at, thumbnail_path, processed_path, processing_status')
        .in('original_filename', uniqueFilenames);

      if (exactError) {
        logger.warn('🌐⚠️ Batched filename lookup failed, falling back to per-file queries', exactError);
      }

      // Index matches by filename for fast lookup
      const matchesByName = new Map<string, any[]>();
      if (exactMatches && Array.isArray(exactMatches)) {
        for (const m of exactMatches) {
          const list = matchesByName.get(m.original_filename) || [];
          list.push(m);
          matchesByName.set(m.original_filename, list);
        }
      }

      // Fallback: for any filenames not found in the batch response, query individually
      const missingNames = uniqueFilenames.filter((n) => !matchesByName.has(n));
      if (missingNames.length > 0) {
        logger.debug('🔁 Fallback per-file lookups for missing names', missingNames);
        // Run sequentially to avoid rate limits; count towards progress subtly
        for (const name of missingNames) {
          const { data: single, error: singleErr } = await supabase
            .from('simple_media')
            .select('id, title, original_filename, original_size_bytes, optimized_size_bytes, mime_type, created_at, thumbnail_path, processed_path, processing_status')
            .eq('original_filename', name)
            .limit(10);

          if (singleErr) {
            logger.warn('🌐⚠️ Single filename lookup failed', { name, error: singleErr });
            // Try fallback to legacy files table
          } 

          if (single && single.length > 0) {
            matchesByName.set(name, single);
          } else {
            // Fallback to files table
            const { data: filesRows, error: filesErr } = await supabase
              .from('files')
              .select('id, title, original_filename, file_size, mime_type, created_at, processing_status')
              .eq('original_filename', name)
              .limit(10);

            if (filesErr) {
              logger.warn('🌐⚠️ Files table lookup failed', { name, error: filesErr });
              continue;
            }

            if (filesRows && filesRows.length > 0) {
              const mapped = filesRows.map((r: any) => ({
                id: r.id,
                title: r.title,
                original_filename: r.original_filename,
                original_size_bytes: r.file_size,
                optimized_size_bytes: undefined,
                mime_type: r.mime_type,
                created_at: r.created_at,
                thumbnail_path: undefined,
                processed_path: undefined,
                processing_status: r.processing_status,
              }));
              matchesByName.set(name, mapped);
            }
          }
        }
      }

      logger.debug('📚 Indexed DB candidates by name', {
        names: Array.from(matchesByName.keys()),
        counts: Array.from(matchesByName.entries()).map(([k, v]) => ({ name: k, count: v.length }))
      });

      // Process exact filename matches with size check per staged file
      if (processFiles.length > 0) {
        for (const queueFile of processFiles) {
          const candidates = matchesByName.get(queueFile.file.name) || [];
          const sizeMatch = candidates.find(c => typeof c.original_size_bytes === 'number' && c.original_size_bytes === queueFile.file.size);
          const match = sizeMatch || candidates[0];

          if (match) {
            duplicates.push({
              queueFile,
              existingFile: match,
              sourceType: 'database'
            });
            logger.debug('✅ DB duplicate matched', { name: queueFile.file.name, size: queueFile.file.size, matchId: match.id });
          } else {
            logger.debug('❎ No DB duplicate for', { name: queueFile.file.name, size: queueFile.file.size });
          }
        }
      }

      onProgress?.(1, 1);

      return duplicates;
    } catch (error) {
      console.error('Batch database duplicate detection failed:', error);
      return [];
    }
  };

  // Combined duplicate detection with caching and progress
  const checkAllDuplicates = async (
    uploadQueue: FileUploadItem[],
    onProgress?: (current: number, total: number, step: string) => void
  ): Promise<DuplicateMatch[]> => {
    // Check cache first
    const cacheKey = getCacheKey(uploadQueue);
    const cached = duplicateCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      onProgress?.(1, 1, 'Using cached results');
      return cached.result;
    }

    onProgress?.(0, 2, 'Checking queue duplicates');
    
    // Check queue duplicates (fast)
    const queueDuplicates = await checkQueueDuplicates(uploadQueue);
    
    onProgress?.(1, 2, 'Checking database duplicates');
    
    // Check database duplicates with progress
    const databaseDuplicates = await checkDatabaseDuplicates(uploadQueue, (current, total) => {
      // Map database progress to overall progress
      const dbProgress = current / total;
      onProgress?.(1 + dbProgress, 2, `Checking database`);
    });

    const allDuplicates: DuplicateMatch[] = [
      ...queueDuplicates,
      ...databaseDuplicates
    ];

    // Cache results
    duplicateCache.set(cacheKey, {
      result: allDuplicates,
      timestamp: Date.now()
    });

    // Clean up old cache entries
    for (const [key, entry] of duplicateCache.entries()) {
      if (Date.now() - entry.timestamp > CACHE_TTL) {
        duplicateCache.delete(key);
      }
    }

    onProgress?.(2, 2, 'Complete');
    
    return allDuplicates;
  };

  const addDuplicateTag = (tags: string[], duplicateIndex: number): string[] => {
    const duplicateTag = `duplicate-${duplicateIndex}`;
    return tags.includes(duplicateTag) ? tags : [...tags, duplicateTag];
  };

  return {
    checkDatabaseDuplicates,
    checkQueueDuplicates,
    checkAllDuplicates,
    addDuplicateTag
  };
};