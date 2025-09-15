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

  // OPTIMIZED: Batch database duplicate detection using IN queries (10x+ faster)
  const checkDatabaseDuplicates = async (
    uploadQueue: FileUploadItem[], 
    onProgress?: (current: number, total: number) => void
  ): Promise<DatabaseDuplicate[]> => {
    try {
      const duplicates: DatabaseDuplicate[] = [];
      // Only consider files that could be uploaded
      const processFiles = uploadQueue.filter(f => ['pending', 'error', 'cancelled'].includes(f.status));
      const total = processFiles.length;
      if (total === 0) return duplicates;

      logger.debug('🧭 BATCH Database duplicate check - Processing files', processFiles.map(f => ({ name: f.file.name, size: f.file.size, status: f.status })));

      // Extract all unique filenames for batch querying
      const filenames = [...new Set(processFiles.map(f => f.file.name))];
      const fileMap = new Map<string, FileUploadItem[]>();
      
      // Group files by filename for efficient matching
      processFiles.forEach(file => {
        const existing = fileMap.get(file.file.name) || [];
        existing.push(file);
        fileMap.set(file.file.name, existing);
      });

      onProgress?.(0, 3);

      // BATCH QUERY 1: content_files table (only active files for current user)
      let allMatches: any[] = [];
      onProgress?.(0, 3);
      
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;
      
      try {
        const { data: cfRows, error: cfErr } = await supabase
          .from('content_files')
          .select('id, title, original_filename, file_size, mime_type, created_at, thumbnail_url, file_path, is_active, creator_id')
          .in('original_filename', filenames)
          .eq('is_active', true)
          .eq('creator_id', currentUserId)
          .limit(1000);

        if (cfErr) {
          logger.warn('🌐⚠️ content_files batch lookup failed', { filenames, error: cfErr });
        } else if (cfRows && cfRows.length > 0) {
          const mappedCf = cfRows.map((r: any) => ({
            id: r.id,
            title: r.title,
            original_filename: r.original_filename,
            original_size_bytes: r.file_size,
            optimized_size_bytes: undefined,
            mime_type: r.mime_type,
            created_at: r.created_at,
            thumbnail_path: r.thumbnail_url,
            processed_path: r.file_path,
            processing_status: r.is_active ? 'processed' : 'inactive',
            source_table: 'content_files'
          }));
          allMatches.push(...mappedCf);
          logger.debug('✅ content_files batch found', mappedCf.length, 'matches');
        }
      } catch (err) {
        logger.warn('🌐⚠️ content_files batch query failed', err);
      }

      onProgress?.(1, 3);

      // BATCH QUERY 2: simple_media table (only for current user, not processing failures)
      try {
        const { data: smRows, error: smErr } = await supabase
          .from('simple_media')
          .select('id, title, original_filename, original_size_bytes, optimized_size_bytes, mime_type, created_at, thumbnail_path, processed_path, processing_status, creator_id')
          .in('original_filename', filenames)
          .eq('creator_id', currentUserId)
          .neq('processing_status', 'error')
          .limit(1000);

        if (smErr) {
          logger.warn('🌐⚠️ simple_media batch lookup failed', { filenames, error: smErr });
        } else if (smRows && smRows.length > 0) {
          const mappedSm = smRows.map((r: any) => ({
            ...r,
            source_table: 'simple_media'
          }));
          allMatches.push(...mappedSm);
          logger.debug('✅ simple_media batch found', mappedSm.length, 'matches');
        }
      } catch (err) {
        logger.warn('🌐⚠️ simple_media batch query failed', err);
      }

      onProgress?.(2, 3);

      // BATCH QUERY 3: files table (fallback, only active files for current user)
      try {
        const { data: filesRows, error: filesErr } = await supabase
          .from('files')
          .select('id, title, original_filename, file_size, mime_type, created_at, processing_status, creator_id, is_active')
          .in('original_filename', filenames)
          .eq('creator_id', currentUserId)
          .eq('is_active', true)
          .limit(1000);

        if (filesErr) {
          logger.warn('🌐⚠️ files batch lookup failed', { filenames, error: filesErr });
        } else if (filesRows && filesRows.length > 0) {
          const mappedFiles = filesRows.map((r: any) => ({
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
            source_table: 'files'
          }));
          allMatches.push(...mappedFiles);
          logger.debug('✅ files batch found', mappedFiles.length, 'matches');
        }
      } catch (err) {
        logger.warn('🌐⚠️ files batch query failed', err);
      }

      onProgress?.(3, 3);

      // Now match each queue file with database results in memory (fast)
      for (const [filename, queueFiles] of fileMap.entries()) {
        // Find all database matches for this filename
        const dbMatches = allMatches.filter(match => match.original_filename === filename);
        
        if (dbMatches.length > 0) {
          // For each queue file with this filename, find the best match
          for (const queueFile of queueFiles) {
            // Prefer exact size match, otherwise take the first match
            const bestMatch = dbMatches.find(match => 
              typeof match.original_size_bytes === 'number' && 
              match.original_size_bytes === queueFile.file.size
            ) || dbMatches[0];

            if (bestMatch) {
              duplicates.push({
                queueFile,
                existingFile: bestMatch,
                sourceType: 'database'
              });
              logger.debug('✅ BATCH DB duplicate matched', { 
                name: queueFile.file.name, 
                size: queueFile.file.size, 
                matchId: bestMatch.id,
                source: bestMatch.source_table 
              });
            }
          }
        } else {
          queueFiles.forEach(queueFile => {
            logger.debug('❎ No BATCH DB duplicate for', { name: queueFile.file.name, size: queueFile.file.size });
          });
        }
      }

      logger.debug('🚀 BATCH duplicate detection complete:', {
        totalFiles: total,
        totalDbMatches: allMatches.length,
        duplicatesFound: duplicates.length,
        queriesUsed: 3 // Instead of total * 3!
      });

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