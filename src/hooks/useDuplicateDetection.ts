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
  };
}

export const useDuplicateDetection = () => {
  const checkDatabaseDuplicates = async (uploadQueue: FileUploadItem[]): Promise<DatabaseDuplicate[]> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error('User not authenticated');
      }

      const duplicates: DatabaseDuplicate[] = [];

      // Check each file in the queue against the database
      for (const queueFile of uploadQueue.filter(f => f.status === 'pending')) {
        const { data: existingFiles, error } = await supabase
          .from('simple_media')
          .select('id, title, original_filename, original_size_bytes, mime_type, created_at, thumbnail_path, processing_status')
          .eq('creator_id', userData.user.id)
          .eq('original_filename', queueFile.file.name)
          .eq('original_size_bytes', queueFile.file.size);

        if (error) {
          console.error('Error checking for duplicates:', error);
          continue;
        }

        // If we found matching files, add them as duplicates
        if (existingFiles && existingFiles.length > 0) {
          // Take the most recent match
          const mostRecentFile = existingFiles.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0];

          duplicates.push({
            queueFile,
            existingFile: mostRecentFile
          });
        }
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

  return {
    checkDatabaseDuplicates,
    addDuplicateTag
  };
};