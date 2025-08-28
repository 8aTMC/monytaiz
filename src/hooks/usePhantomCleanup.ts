import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const usePhantomCleanup = () => {
  const [isCleaningPhantoms, setIsCleaningPhantoms] = useState(false);
  const { toast } = useToast();

  const cleanPhantomFolders = async (bucket: string, phantomFolders: string[]) => {
    setIsCleaningPhantoms(true);
    try {
      // Ensure clean JSON-serializable payload
      const payload = {
        bucket: String(bucket),
        prefixes: phantomFolders.filter(folder => typeof folder === 'string' && folder.length > 0),
        dryRun: false
      };

      // Sanity check - ensure payload is JSON-serializable
      const cleanPayload = JSON.parse(JSON.stringify(payload));
      console.log('Sending phantom cleanup payload:', cleanPayload);

      const { data, error } = await supabase.functions.invoke('admin-phantom-cleanup', {
        body: cleanPayload,
        headers: { 'Content-Type': 'application/json' },
      });

      if (error) {
        console.error('Phantom cleanup error:', error);
        
        // Try to get more details if available
        if (error.context) {
          try {
            const errorBody = await error.context.clone().text();
            console.error('Server error details:', errorBody);
          } catch (e) {
            console.error('Could not read error context:', e);
          }
        }
        
        toast({
          title: "Cleanup Failed",
          description: `Failed to clean phantom folders: ${error.message}`,
          variant: "destructive"
        });
        return { success: false, error: error.message };
      }

      if (data?.ok) {
        console.log('Phantom cleanup completed:', data);
        toast({
          title: "Cleanup Completed",
          description: data.message || `Successfully processed ${phantomFolders.length} phantom folders`,
          variant: "default"
        });
        return { success: true, results: data };
      } else {
        console.warn('Phantom cleanup completed with issues:', data);
        toast({
          title: "Cleanup Completed with Issues",
          description: data?.message || "Some phantom folders may still exist. Check console for details.",
          variant: "default"
        });
        return { success: false, results: data };
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