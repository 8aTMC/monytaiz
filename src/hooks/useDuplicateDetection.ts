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
    original_path?: string;
    processed_path?: string;
    processing_status: string;
  };
  sourceType: 'database';
}

export type DuplicateMatch = QueueDuplicate | DatabaseDuplicate;


export const useDuplicateDetection = () => {
  // Check for duplicates within the upload queue (simple filename + size)
  const checkQueueDuplicates = async (uploadQueue: FileUploadItem[]): Promise<QueueDuplicate[]> => {
    console.log('🔍 Checking queue duplicates for', uploadQueue.length, 'files');
    
    const duplicates: QueueDuplicate[] = [];
    const processFiles = uploadQueue.filter(f => f.status === 'pending');
    
    if (processFiles.length < 2) return duplicates;
    
    // Compare each file with all other files for exact filename + size match
    for (let i = 0; i < processFiles.length; i++) {
      const fileA = processFiles[i];
      
      for (let j = i + 1; j < processFiles.length; j++) {
        const fileB = processFiles[j];
        
        // Check filename + size match
        if (fileA.file.name === fileB.file.name && fileA.file.size === fileB.file.size) {
          console.log('🎯 Found queue duplicate:', fileA.file.name, 'vs', fileB.file.name);
          
          duplicates.push({
            queueFile: fileA,
            duplicateFile: fileB,
            sourceType: 'queue'
          });
        }
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

      for (const queueFile of processFiles) {
        // Check for exact filename match only
        const { data: exactMatches } = await supabase
          .from('simple_media')
          .select('id, title, original_filename, original_size_bytes, optimized_size_bytes, mime_type, created_at, thumbnail_path, processing_status, original_path, processed_path')
          .eq('creator_id', userData.user.id)
          .eq('original_filename', queueFile.file.name);

        if (exactMatches && exactMatches.length > 0) {
          console.log('🎯 Found exact filename match for:', queueFile.file.name);
          
          const mostRecent = exactMatches.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0];

          duplicates.push({
            queueFile,
            existingFile: mostRecent,
            sourceType: 'database'
          });
        }
      }

      console.log('🔍 Database duplicate check complete. Found:', duplicates.length, 'duplicates');
      return duplicates;
    } catch (error) {
      console.error('Database duplicate detection failed:', error);
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

  return {
    checkDatabaseDuplicates,
    checkQueueDuplicates,
    checkAllDuplicates,
    addDuplicateTag
  };
};