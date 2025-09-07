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
      console.log('Starting direct folder creation...');

      const folders = ['processed/', 'thumbnails/'];
      const results = [];

      for (const folder of folders) {
        console.log(`Creating folder: ${folder}`);
        
        // Create a placeholder file to establish the folder structure
        const placeholderContent = new TextEncoder().encode('# This file maintains the folder structure\n# Do not delete');
        
        const { data, error } = await supabase.storage
          .from('content')
          .upload(`${folder}.gitkeep`, placeholderContent, {
            upsert: true,
            contentType: 'text/plain'
          });

        if (error) {
          console.error(`Error creating folder ${folder}:`, error);
          results.push({ folder, success: false, error: error.message });
        } else {
          console.log(`Successfully created folder: ${folder}`, data);
          results.push({ folder, success: true, path: data.path });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;

      if (successCount === folders.length) {
        toast({
          title: "Folders Created Successfully",
          description: `Successfully created ${successCount} folders (processed/, thumbnails/)`,
          variant: "default"
        });
      } else if (successCount > 0) {
        toast({
          title: "Partial Success",
          description: `Created ${successCount} folders, ${failedCount} failed. Check console for details.`,
          variant: "default"
        });
      } else {
        toast({
          title: "Creation Failed",
          description: "Failed to create storage folders. Check console for details.",
          variant: "destructive"
        });
      }

      console.log('Folder creation results:', results);
    } catch (error) {
      console.error('Folder creation failed:', error);
      toast({
        title: "Creation Error",
        description: "Failed to create folders due to unexpected error",
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