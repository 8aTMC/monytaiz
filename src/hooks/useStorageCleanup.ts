import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useStorageCleanup = () => {
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const { toast } = useToast();

  const cleanupOrphanedStorage = async () => {
    setIsCleaningUp(true);
    
    try {
      console.log('Starting orphaned storage cleanup...');
      
      const { data, error } = await supabase.functions.invoke('media-operations', {
        body: {
          action: 'cleanup_orphaned_storage'
        }
      });

      if (error) {
        console.error('Cleanup error:', error);
        throw error;
      }

      console.log('Cleanup result:', data);

      toast({
        title: "Storage cleanup completed",
        description: `${data.deleted_files} files and ${data.deleted_folders} folders removed`,
        variant: "success"
      });

      if (data.errors && data.errors.length > 0) {
        console.warn('Cleanup errors:', data.errors);
        toast({
          title: "Some cleanup errors occurred",
          description: `${data.errors.length} items couldn't be deleted. Check console for details.`,
          variant: "destructive"
        });
      }

      return data;
    } catch (error) {
      console.error('Storage cleanup failed:', error);
      toast({
        title: "Cleanup failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsCleaningUp(false);
    }
  };

  return {
    cleanupOrphanedStorage,
    isCleaningUp
  };
};