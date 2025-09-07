import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export const RecreateStorageFolders = () => {
  const [isRecreating, setIsRecreating] = useState(false);
  const { toast } = useToast();

  const executeRecreateFolder = async () => {
    setIsRecreating(true);
    try {
      console.log('Starting folder recreation...');

      const { data, error } = await supabase.functions.invoke('recreate-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {},
      });

      if (error) {
        console.error('Folder recreation error:', error);
        toast({
          title: "Recreation Failed",
          description: `Failed to recreate folders: ${error.message}`,
          variant: "destructive"
        });
        return;
      }

      if (data?.success) {
        console.log('Folder recreation completed:', data);
        toast({
          title: "Folders Created Successfully",
          description: data.message || "Successfully recreated storage folders",
          variant: "default"
        });
      } else {
        console.warn('Folder recreation completed with issues:', data);
        toast({
          title: "Recreation Completed with Issues",
          description: data?.message || "Some folders may not have been created. Check console for details.",
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Folder recreation failed:', error);
      toast({
        title: "Recreation Error",
        description: "Failed to recreate folders due to network error",
        variant: "destructive"
      });
    } finally {
      setIsRecreating(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Storage Folder Management</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Create the required folders (processed/, thumbnails/) in the content bucket.
      </p>
      <Button 
        onClick={executeRecreateFolder} 
        disabled={isRecreating}
        variant="outline"
      >
        {isRecreating ? 'Creating Folders...' : 'Recreate Storage Folders'}
      </Button>
    </div>
  );
};