import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useFolderRecreation = () => {
  const [isRecreatingFolders, setIsRecreatingFolders] = useState(false);
  const { toast } = useToast();

  const recreateFolders = async () => {
    setIsRecreatingFolders(true);
    try {
      console.log('Starting folder recreation...');

      const { data, error } = await supabase.functions.invoke('recreate-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {},
      });

      if (error) {
        console.error('Folder recreation error:', error);
        
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
          title: "Recreation Failed",
          description: `Failed to recreate folders: ${error.message}`,
          variant: "destructive"
        });
        return { success: false, error: error.message };
      }

      if (data?.success) {
        console.log('Folder recreation completed:', data);
        toast({
          title: "Folders Recreated",
          description: data.message || "Successfully recreated storage folders",
          variant: "default"
        });
        return { success: true, results: data };
      } else {
        console.warn('Folder recreation completed with issues:', data);
        toast({
          title: "Recreation Completed with Issues",
          description: data?.message || "Some folders may not have been created. Check console for details.",
          variant: "default"
        });
        return { success: false, results: data };
      }
    } catch (error) {
      console.error('Folder recreation failed:', error);
      toast({
        title: "Recreation Error",
        description: "Failed to recreate folders due to network error",
        variant: "destructive"
      });
      return { success: false, error: error.message };
    } finally {
      setIsRecreatingFolders(false);
    }
  };

  return {
    recreateFolders,
    isRecreatingFolders
  };
};