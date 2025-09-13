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

  // OPTIMIZED: Sequential per-file database duplicate detection (reliable)
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

      logger.debug('🧭 Database duplicate check - Processing files', processFiles.map(f => ({ name: f.file.name, size: f.file.size, status: f.status })));

      let current = 0;
      for (const queueFile of processFiles) {
        try {
          // First try content_files (primary library table)
          const { data: cfRows, error: cfErr } = await supabase
            .from('content_files')
            .select('id, title, original_filename, file_size, mime_type, created_at, thumbnail_url, file_path, is_active')
            .eq('original_filename', queueFile.file.name)
            .limit(20);

          let match: any | null = null;

          if (cfErr) {
            logger.warn('🌐⚠️ content_files lookup failed, will try fallbacks', { name: queueFile.file.name, error: cfErr });
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
            }));
            match = mappedCf.find((m: any) => typeof m.original_size_bytes === 'number' && m.original_size_bytes === queueFile.file.size) || mappedCf[0] || null;
          }

          // Fallback 1: simple_media by filename
          if (!match) {
            const { data: smRows, error: smErr } = await supabase
              .from('simple_media')
              .select('id, title, original_filename, original_size_bytes, optimized_size_bytes, mime_type, created_at, thumbnail_path, processed_path, processing_status')
              .eq('original_filename', queueFile.file.name)
              .limit(20);

            if (smErr) {
              logger.warn('🌐⚠️ simple_media lookup failed, will try files fallback', { name: queueFile.file.name, error: smErr });
            } else if (smRows && smRows.length > 0) {
              match = smRows.find(r => typeof r.original_size_bytes === 'number' && r.original_size_bytes === queueFile.file.size) || smRows[0] || null;
            }
          }

          // Fallback 2: legacy files table if needed
          if (!match) {
            const { data: filesRows, error: filesErr } = await supabase
              .from('files')
              .select('id, title, original_filename, file_size, mime_type, created_at, processing_status')
              .eq('original_filename', queueFile.file.name)
              .limit(20);

            if (filesErr) {
              logger.warn('🌐⚠️ files lookup failed', { name: queueFile.file.name, error: filesErr });
            } else if (filesRows && filesRows.length > 0) {
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
              match = mapped.find((m: any) => typeof m.original_size_bytes === 'number' && m.original_size_bytes === queueFile.file.size) || mapped[0] || null;
            }
          }

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
        } catch (innerErr) {
          logger.warn('⚠️ DB duplicate check failed for file', { name: queueFile.file.name, error: innerErr });
        } finally {
          current += 1;
          onProgress?.(current, total);
        }
      }

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