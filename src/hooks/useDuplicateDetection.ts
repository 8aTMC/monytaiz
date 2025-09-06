import { supabase } from '@/integrations/supabase/client';
import { FileUploadItem } from './useFileUpload';

export interface QueueDuplicate {
  queueFile: FileUploadItem;
  duplicateFile: FileUploadItem;
  confidenceLevel: 'exact' | 'high' | 'medium' | 'low';
  detectionMethod: 'content_hash' | 'filename_size' | 'filename_fuzzy' | 'size_type';
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
    content_hash?: string;
  };
  confidenceLevel: 'exact' | 'high' | 'medium' | 'low';
  detectionMethod: 'content_hash' | 'filename_size' | 'filename_fuzzy' | 'size_type';
  sourceType: 'database';
}

export type DuplicateMatch = QueueDuplicate | DatabaseDuplicate;

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
    
    // Check for common duplicate patterns (enhanced with more variations)
    const patterns = [
      /\s*\(\d+\)$/,        // " (1)", " (2)", etc.
      /\s*-\s*copy$/i,      // " - Copy"
      /\s*-\s*copia$/i,     // " - copia" (Spanish/Portuguese)
      /\s*copy$/i,          // " Copy"
      /\s*copia$/i,         // " copia"
      /_\d+$/,              // "_1", "_2", etc.
      /\s*-\s*\d+$/,        // " - 1", " - 2", etc.
      /\s*\d+$/,            // " 1", " 2", etc.
    ];
    
    for (const pattern of patterns) {
      const base1 = cleanName1.replace(pattern, '');
      const base2 = cleanName2.replace(pattern, '');
      if (base1 === base2 && base1.length > 0) return 0.9;
    }
    
    return 0;
  };

  // Check for duplicates within the upload queue
  const checkQueueDuplicates = async (uploadQueue: FileUploadItem[]): Promise<QueueDuplicate[]> => {
    console.log('🔍 Checking queue duplicates for', uploadQueue.length, 'files');
    
    const duplicates: QueueDuplicate[] = [];
    const processFiles = uploadQueue.filter(f => f.status === 'pending');
    
    if (processFiles.length < 2) return duplicates;
    
    // Generate hashes for all files in parallel
    const filesWithHashes = await Promise.all(
      processFiles.map(async (queueFile) => ({
        queueFile,
        hash: await generateFileHash(queueFile.file)
      }))
    );
    
    console.log('🔍 Generated hashes for queue files:', filesWithHashes.map(f => ({ name: f.queueFile.file.name, hash: f.hash?.slice(0, 8) + '...' })));
    
    // Compare each file with all other files
    for (let i = 0; i < filesWithHashes.length; i++) {
      const fileA = filesWithHashes[i];
      
      for (let j = i + 1; j < filesWithHashes.length; j++) {
        const fileB = filesWithHashes[j];
        const detectedDuplicates: QueueDuplicate[] = [];
        
        // 1. Check for exact content match using hash
        if (fileA.hash && fileB.hash && fileA.hash === fileB.hash) {
          console.log('🎯 Found exact content match:', fileA.queueFile.file.name, 'vs', fileB.queueFile.file.name);
          
          detectedDuplicates.push({
            queueFile: fileA.queueFile,
            duplicateFile: fileB.queueFile,
            confidenceLevel: 'exact',
            detectionMethod: 'content_hash',
            sourceType: 'queue'
          });
        }
        // 2. Check filename + size match
        else if (fileA.queueFile.file.name === fileB.queueFile.file.name && 
                 fileA.queueFile.file.size === fileB.queueFile.file.size) {
          console.log('🎯 Found filename+size match:', fileA.queueFile.file.name, 'vs', fileB.queueFile.file.name);
          
          detectedDuplicates.push({
            queueFile: fileA.queueFile,
            duplicateFile: fileB.queueFile,
            confidenceLevel: 'high',
            detectionMethod: 'filename_size',
            sourceType: 'queue'
          });
        }
        // 3. Check fuzzy filename match with same size
        else if (fileA.queueFile.file.size === fileB.queueFile.file.size) {
          const similarity = calculateNameSimilarity(fileA.queueFile.file.name, fileB.queueFile.file.name);
          if (similarity > 0.8) {
            console.log('🎯 Found fuzzy match:', fileA.queueFile.file.name, 'vs', fileB.queueFile.file.name, 'similarity:', similarity);
            
            detectedDuplicates.push({
              queueFile: fileA.queueFile,
              duplicateFile: fileB.queueFile,
              confidenceLevel: 'medium',
              detectionMethod: 'filename_fuzzy',
              sourceType: 'queue'
            });
          }
        }
        
        duplicates.push(...detectedDuplicates);
      }
    }
    
    console.log('🔍 Queue duplicate check complete. Found:', duplicates.length, 'duplicates');
    return duplicates;
  };

  const checkDatabaseDuplicates = async (uploadQueue: FileUploadItem[]): Promise<DatabaseDuplicate[]> => {
    console.log('🔍 Checking database duplicates for', uploadQueue.length, 'files');
    
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

            console.log('🎯 Found database content match for:', queueFile.file.name, 'vs', mostRecent.original_filename);

            detectedDuplicates.push({
              queueFile,
              existingFile: mostRecent,
              confidenceLevel: 'exact',
              detectionMethod: 'content_hash',
              sourceType: 'database'
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

            console.log('🎯 Found database filename+size match for:', queueFile.file.name);

            detectedDuplicates.push({
              queueFile,
              existingFile: mostRecent,
              confidenceLevel: 'high',
              detectionMethod: 'filename_size',
              sourceType: 'database'
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

              console.log('🎯 Found database fuzzy match for:', queueFile.file.name, 'vs', mostRecent.original_filename);

              detectedDuplicates.push({
                queueFile,
                existingFile: mostRecent,
                confidenceLevel: 'medium',
                detectionMethod: 'filename_fuzzy',
                sourceType: 'database'
              });
            }
          }
        }

        duplicates.push(...detectedDuplicates);
      }

      console.log('🔍 Database duplicate check complete. Found:', duplicates.length, 'duplicates');
      return duplicates;
    } catch (error) {
      console.error('Duplicate detection failed:', error);
      return [];
    }
  };

  // Combined duplicate detection that checks both queue and database
  const checkAllDuplicates = async (uploadQueue: FileUploadItem[]): Promise<DuplicateMatch[]> => {
    console.log('🔍 Starting comprehensive duplicate detection...');
    
    // First check queue duplicates (faster)
    const queueDuplicates = await checkQueueDuplicates(uploadQueue);
    
    // Then check database duplicates
    const databaseDuplicates = await checkDatabaseDuplicates(uploadQueue);
    
    // Combine both types of duplicates
    const allDuplicates: DuplicateMatch[] = [
      ...queueDuplicates,
      ...databaseDuplicates
    ];
    
    console.log('🔍 Total duplicates found:', allDuplicates.length, '| Queue:', queueDuplicates.length, '| Database:', databaseDuplicates.length);
    
    return allDuplicates;
  };

  const addDuplicateTag = (tags: string[], duplicateIndex: number): string[] => {
    const duplicateTag = `duplicate-${duplicateIndex}`;
    return tags.includes(duplicateTag) ? tags : [...tags, duplicateTag];
  };

  const getConfidenceBadge = (duplicate: DuplicateMatch) => {
    const badges = {
      exact: { text: 'Identical Content', color: 'bg-red-500' },
      high: { text: 'Exact Match', color: 'bg-orange-500' },
      medium: { text: 'Likely Duplicate', color: 'bg-yellow-500' },
      low: { text: 'Possible Duplicate', color: 'bg-blue-500' },
    };
    
    return badges[duplicate.confidenceLevel] || { text: 'Duplicate', color: 'bg-gray-500' };
  };

  return {
    checkDatabaseDuplicates,
    checkQueueDuplicates,
    checkAllDuplicates,
    addDuplicateTag,
    getConfidenceBadge,
    generateFileHash
  };
};