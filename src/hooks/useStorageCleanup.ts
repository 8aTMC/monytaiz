import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useStorageCleanup = () => {
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const { toast } = useToast();

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

  return {
    optimizeStorage,
    isCleaningUp
  };
};