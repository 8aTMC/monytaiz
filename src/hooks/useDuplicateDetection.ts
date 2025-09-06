import { supabase } from '@/integrations/supabase/client';
import { FileUploadItem } from './useFileUpload';

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
    content_hash?: string;
  };
  confidenceLevel: 'exact' | 'high' | 'medium' | 'low';
  detectionMethod: 'content_hash' | 'filename_size' | 'filename_fuzzy' | 'size_type';
}

export const useDuplicateDetection = () => {
  // Generate SHA-256 hash for file content
  const generateFileHash = async (file: File): Promise<string | null> => {
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (error) {
      console.error('Failed to generate file hash:', error);
      return null;
    }
  };

  // Check for fuzzy filename matches
  const calculateNameSimilarity = (name1: string, name2: string): number => {
    const clean = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanName1 = clean(name1);
    const cleanName2 = clean(name2);
    
    if (cleanName1 === cleanName2) return 1;
    
    // Check for common duplicate patterns
    const patterns = [
      /\s*\(\d+\)$/,  // " (1)", " (2)", etc.
      /\s*-\s*copy$/i, // " - Copy"
      /\s*copy$/i,     // " Copy"
      /_\d+$/,         // "_1", "_2", etc.
    ];
    
    for (const pattern of patterns) {
      const base1 = cleanName1.replace(pattern, '');
      const base2 = cleanName2.replace(pattern, '');
      if (base1 === base2 && base1.length > 0) return 0.9;
    }
    
    return 0;
  };

  const checkDatabaseDuplicates = async (uploadQueue: FileUploadItem[]): Promise<DatabaseDuplicate[]> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error('User not authenticated');
      }

      const duplicates: DatabaseDuplicate[] = [];
      const processFiles = uploadQueue.filter(f => f.status === 'pending');

      // Generate hashes for all files in parallel
      const filesWithHashes = await Promise.all(
        processFiles.map(async (queueFile) => ({
          queueFile,
          hash: await generateFileHash(queueFile.file)
        }))
      );

      for (const { queueFile, hash } of filesWithHashes) {
        const detectedDuplicates: DatabaseDuplicate[] = [];

        // 1. Check for exact content match using hash
        if (hash) {
          const { data: hashMatches } = await supabase
            .from('simple_media')
            .select('id, title, original_filename, original_size_bytes, mime_type, created_at, thumbnail_path, processing_status, content_hash')
            .eq('creator_id', userData.user.id)
            .eq('content_hash', hash);

          if (hashMatches && hashMatches.length > 0) {
            const mostRecent = hashMatches.sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];

            detectedDuplicates.push({
              queueFile,
              existingFile: mostRecent,
              confidenceLevel: 'exact',
              detectionMethod: 'content_hash'
            });
          }
        }

        // 2. If no exact match, check filename + size
        if (detectedDuplicates.length === 0) {
          const { data: nameMatches } = await supabase
            .from('simple_media')
            .select('id, title, original_filename, original_size_bytes, mime_type, created_at, thumbnail_path, processing_status, content_hash')
            .eq('creator_id', userData.user.id)
            .eq('original_filename', queueFile.file.name)
            .eq('original_size_bytes', queueFile.file.size);

          if (nameMatches && nameMatches.length > 0) {
            const mostRecent = nameMatches.sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];

            detectedDuplicates.push({
              queueFile,
              existingFile: mostRecent,
              confidenceLevel: 'high',
              detectionMethod: 'filename_size'
            });
          }
        }

        // 3. If still no match, check for fuzzy filename matches with same size
        if (detectedDuplicates.length === 0) {
          const { data: sizeMatches } = await supabase
            .from('simple_media')
            .select('id, title, original_filename, original_size_bytes, mime_type, created_at, thumbnail_path, processing_status, content_hash')
            .eq('creator_id', userData.user.id)
            .eq('original_size_bytes', queueFile.file.size);

          if (sizeMatches && sizeMatches.length > 0) {
            const fuzzyMatches = sizeMatches.filter(file => 
              calculateNameSimilarity(queueFile.file.name, file.original_filename) > 0.8
            );

            if (fuzzyMatches.length > 0) {
              const mostRecent = fuzzyMatches.sort((a, b) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )[0];

              detectedDuplicates.push({
                queueFile,
                existingFile: mostRecent,
                confidenceLevel: 'medium',
                detectionMethod: 'filename_fuzzy'
              });
            }
          }
        }

        duplicates.push(...detectedDuplicates);
      }

      return duplicates;
    } catch (error) {
      console.error('Duplicate detection failed:', error);
      return [];
    }
  };

  const addDuplicateTag = (tags: string[], duplicateIndex: number): string[] => {
    const duplicateTag = `duplicate-${duplicateIndex}`;
    return tags.includes(duplicateTag) ? tags : [...tags, duplicateTag];
  };

  const getConfidenceBadge = (duplicate: DatabaseDuplicate) => {
    switch (duplicate.confidenceLevel) {
      case 'exact':
        return { text: 'Identical Content', color: 'bg-red-500' };
      case 'high':
        return { text: 'Exact Match', color: 'bg-orange-500' };
      case 'medium':
        return { text: 'Likely Duplicate', color: 'bg-yellow-500' };
      case 'low':
        return { text: 'Possible Duplicate', color: 'bg-blue-500' };
      default:
        return { text: 'Duplicate', color: 'bg-gray-500' };
    }
  };

  return {
    checkDatabaseDuplicates,
    addDuplicateTag,
    getConfidenceBadge,
    generateFileHash
  };
};