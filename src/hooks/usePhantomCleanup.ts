import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const usePhantomCleanup = () => {
  const [isCleaningPhantoms, setIsCleaningPhantoms] = useState(false);
  const { toast } = useToast();

  const cleanPhantomFolders = async (bucket: string, phantomFolders: string[]) => {
    setIsCleaningPhantoms(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-phantom-cleanup', {
        body: { bucket, phantomFolders },
        headers: { 'Content-Type': 'application/json' },
      });

      if (error) {
        console.error('Phantom cleanup error:', error);
        toast({
          title: "Cleanup Failed",
          description: `Failed to clean phantom folders: ${error.message}`,
          variant: "destructive"
        });
        return { success: false, error: error.message };
      }

      if (data?.success) {
        console.log('Phantom cleanup completed:', data);
        toast({
          title: "Cleanup Completed",
          description: `Successfully cleaned ${phantomFolders.length} phantom folders`,
          variant: "default"
        });
        return { success: true, results: data.cleanupResults };
      } else {
        console.warn('Phantom cleanup completed with issues:', data);
        toast({
          title: "Cleanup Completed with Issues",
          description: "Some phantom folders may still exist. Check console for details.",
          variant: "default"
        });
        return { success: false, results: data?.cleanupResults };
      }
    } catch (error) {
      console.error('Phantom cleanup failed:', error);
      toast({
        title: "Cleanup Error",
        description: "Failed to clean phantom folders due to network error",
        variant: "destructive"
      });
      return { success: false, error: error.message };
    } finally {
      setIsCleaningPhantoms(false);
    }
  };

  return {
    cleanPhantomFolders,
    isCleaningPhantoms
  };
};