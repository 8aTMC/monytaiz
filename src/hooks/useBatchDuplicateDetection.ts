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
    mime_type: string;
    created_at: string;
    thumbnail_path?: string;
    processing_status: string;
  };
  sourceType: 'database';
  similarity?: number;
  matchType: 'exact' | 'similar';
}

export type DuplicateMatch = QueueDuplicate | DatabaseDuplicate;

// Levenshtein distance calculation for filename similarity
const calculateSimilarity = (str1: string, str2: string): number => {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  
  const distance = matrix[str2.length][str1.length];
  const maxLength = Math.max(str1.length, str2.length);
  return Math.round(((maxLength - distance) / maxLength) * 100);
};

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
    const processFiles = uploadQueue.filter(f => f.status === 'pending');
    
    if (processFiles.length < 2) return duplicates;
    
    // Compare each file with all other files for exact filename + size match
    for (let i = 0; i < processFiles.length; i++) {
      const fileA = processFiles[i];
      
      for (let j = i + 1; j < processFiles.length; j++) {
        const fileB = processFiles[j];
        
        if (fileA.file.name === fileB.file.name && fileB.file.size === fileB.file.size) {
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
      const processFiles = uploadQueue.filter(f => f.status === 'pending');
      
      if (processFiles.length === 0) return duplicates;

      onProgress?.(0, 3); // 3 steps: exact matches, size matches, similarity check

      // BATCH QUERY 1: Get all exact matches in one query
      const filenames = processFiles.map(f => f.file.name);
      const fileSizes = processFiles.map(f => f.file.size);
      
      const { data: exactMatches } = await supabase
        .from('simple_media')
        .select('id, title, original_filename, original_size_bytes, mime_type, created_at, thumbnail_path, processing_status')
        .eq('creator_id', userData.user.id)
        .in('original_filename', filenames)
        .in('original_size_bytes', fileSizes);

      onProgress?.(1, 3);

      // Process exact matches
      if (exactMatches) {
        for (const queueFile of processFiles) {
          const exactMatch = exactMatches.find(
            match => match.original_filename === queueFile.file.name && 
                    match.original_size_bytes === queueFile.file.size
          );

          if (exactMatch) {
            duplicates.push({
              queueFile,
              existingFile: exactMatch,
              sourceType: 'database',
              matchType: 'exact'
            });
          }
        }
      }

      onProgress?.(2, 3);

      // BATCH QUERY 2: Get all files with matching sizes for fuzzy matching
      // Only check files that didn't have exact matches
      const filesNeedingFuzzyCheck = processFiles.filter(queueFile => 
        !duplicates.some(dup => dup.queueFile.id === queueFile.id)
      );

      if (filesNeedingFuzzyCheck.length > 0) {
        const uniqueSizes = [...new Set(filesNeedingFuzzyCheck.map(f => f.file.size))];
        
        const { data: sizeMatches } = await supabase
          .from('simple_media')
          .select('id, title, original_filename, original_size_bytes, mime_type, created_at, thumbnail_path, processing_status')
          .eq('creator_id', userData.user.id)
          .in('original_size_bytes', uniqueSizes);

        // Process similarity matches in batches to avoid blocking UI
        if (sizeMatches) {
          for (const queueFile of filesNeedingFuzzyCheck) {
            const candidateMatches = sizeMatches.filter(
              match => match.original_size_bytes === queueFile.file.size
            );

            for (const match of candidateMatches) {
              const similarity = calculateSimilarity(queueFile.file.name, match.original_filename);
              
              if (similarity >= 85) {
                duplicates.push({
                  queueFile,
                  existingFile: match,
                  sourceType: 'database',
                  similarity,
                  matchType: 'similar'
                });
                break; // Only take the first high-similarity match per file
              }
            }
          }
        }
      }

      onProgress?.(3, 3);

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
      onProgress?.(1 + dbProgress * 0.9, 2, `Checking database (${current}/${total})`);
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