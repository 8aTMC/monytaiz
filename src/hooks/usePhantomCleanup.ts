import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const usePhantomCleanup = () => {
  const [isCleaningPhantoms, setIsCleaningPhantoms] = useState(false);
  const { toast } = useToast();

  const cleanPhantomFolders = async (bucket: string, phantomFolders: string[]) => {
    setIsCleaningPhantoms(true);
    try {
      // Build JSON-safe payload - keys must be strings relative to bucket, no undefined values
      const payload = {
        bucket: 'content',
        prefixes: phantomFolders
          .filter(folder => folder && typeof folder === 'string' && folder.length > 0)
          .map(folder => {
            // Normalize to relative paths (remove bucket prefix if present)
            const normalized = folder.replace(/^content\//, '').replace(/^\/+/, '');
            // Ensure ends with / for folder prefixes
            return normalized.endsWith('/') ? normalized : `${normalized}/`;
          }),
        dryRun: false
      };

      // Strip anything non-JSON (throws if not serializable)
      const safeBody = JSON.parse(JSON.stringify(payload));
      console.log('Sending phantom cleanup payload:', safeBody);

      const { data, error } = await supabase.functions.invoke('admin-phantom-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: safeBody, // pass the PLAIN object; invoke will JSON-encode it
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