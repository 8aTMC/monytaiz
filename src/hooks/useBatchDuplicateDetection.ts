import { supabase } from '@/integrations/supabase/client';
import { FileUploadItem } from './useFileUpload';

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

      console.log('Database duplicate check - Processing files:', processFiles.map(f => ({ name: f.file.name, status: f.status })));

      onProgress?.(0, 1);

      // Get all exact filename matches only
      const filenames = processFiles.map(f => f.file.name);
      
      const { data: exactMatches } = await supabase
        .from('simple_media')
        .select('id, title, original_filename, original_size_bytes, optimized_size_bytes, mime_type, created_at, thumbnail_path, processed_path, processing_status')
        .in('original_filename', filenames);

      // Process exact filename matches
      if (exactMatches) {
        for (const queueFile of processFiles) {
          const exactMatch = exactMatches.find(
            match => match.original_filename === queueFile.file.name
          );

          if (exactMatch) {
            duplicates.push({
              queueFile,
              existingFile: exactMatch,
              sourceType: 'database'
            });
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