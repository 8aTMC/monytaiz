import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePhantomCleanup } from './usePhantomCleanup';

export const useStorageCleanup = () => {
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const { toast } = useToast();
  const { cleanPhantomFolders, isCleaningPhantoms } = usePhantomCleanup();

  const optimizeStorage = async () => {
    setIsCleaningUp(true);
    
    try {
      console.log('Starting storage optimization...');
      
      const { data, error } = await supabase.functions.invoke('media-operations', {
        body: {
          action: 'optimize_storage'
        }
      });

      if (error) {
        console.error('Storage optimization error:', error);
        throw error;
      }

      console.log('Storage optimization result:', data);

      toast({
        title: "Storage optimization completed",
        description: data.message || `${data.orphaned_files_deleted} files cleaned, ${Math.round(data.storage_saved_bytes / 1024 / 1024)}MB saved`,
        variant: "success"
      });

      if (data.errors && data.errors.length > 0) {
        console.warn('Storage optimization errors:', data.errors);
        toast({
          title: "Some optimization errors occurred",
          description: `${data.errors.length} issues found. Check console for details.`,
          variant: "destructive"
        });
      }

      return data;
    } catch (error) {
      console.error('Storage optimization failed:', error);
      toast({
        title: "Optimization failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsCleaningUp(false);
    }
  };

  const cleanOrphanedRecords = async () => {
    setIsCleaningUp(true);
    
    try {
      console.log('Starting orphaned records cleanup...');
      
      const { data, error } = await supabase.functions.invoke('media-operations', {
        body: {
          action: 'clean_orphaned_records'
        }
      });

      if (error) {
        console.error('Orphaned records cleanup error:', error);
        throw error;
      }

      console.log('Orphaned records cleanup result:', data);

      toast({
        title: "Database cleanup completed",
        description: data.message || `${data.deleted_media_records + data.deleted_content_records} orphaned records removed`,
        variant: "success"
      });

      if (data.errors && data.errors.length > 0) {
        console.warn('Cleanup errors:', data.errors);
        toast({
          title: "Some cleanup errors occurred",
          description: `${data.errors.length} issues found. Check console for details.`,
          variant: "destructive"
        });
      }

      return data;
    } catch (error) {
      console.error('Orphaned records cleanup failed:', error);
      toast({
        title: "Database cleanup failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsCleaningUp(false);
    }
  };

  const forceDeleteGhostFiles = async (specificMediaIds?: string[]) => {
    setIsCleaningUp(true);
    
    try {
      console.log('Starting force delete of ghost files...');
      
      const { data, error } = await supabase.functions.invoke('media-operations', {
        body: {
          action: 'force_delete_ghost_files',
          media_ids: specificMediaIds
        }
      });

      if (error) {
        console.error('Force delete ghost files error:', error);
        throw error;
      }

      console.log('Force delete ghost files result:', data);

      toast({
        title: "Ghost files force deleted",
        description: data.message || `${data.deleted_media_records + data.deleted_content_records} ghost records removed`,
        variant: "success"
      });

      if (data.errors && data.errors.length > 0) {
        console.warn('Force delete errors:', data.errors);
        toast({
          title: "Some deletion errors occurred",
          description: `${data.errors.length} issues found. Check console for details.`,
          variant: "destructive"
        });
      }

      return data;
    } catch (error) {
      console.error('Force delete ghost files failed:', error);
      toast({
        title: "Force deletion failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsCleaningUp(false);
    }
  };

  return {
    optimizeStorage,
    cleanOrphanedRecords,
    forceDeleteGhostFiles,
    cleanPhantomFolders,
    isCleaningUp: isCleaningUp || isCleaningPhantoms
  };
};
