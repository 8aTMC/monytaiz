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
      console.log('Starting storage cleanup and folder creation...');

      // Step 1: Clean up uploads folder
      console.log('Cleaning up uploads/ folder...');
      let uploadCleanupResults = { deleted: 0, errors: 0 };
      
      try {
        // List all files in uploads folder
        const { data: uploadFiles, error: listError } = await supabase.storage
          .from('content')
          .list('uploads', {
            limit: 1000,
            sortBy: { column: 'name', order: 'asc' }
          });

        if (listError) {
          console.error('Error listing uploads folder:', listError);
        } else if (uploadFiles && uploadFiles.length > 0) {
          // Delete all files in uploads folder
          const filePaths = uploadFiles.map(file => `uploads/${file.name}`);
          console.log(`Deleting ${filePaths.length} files from uploads folder...`);
          
          const { data: deleteData, error: deleteError } = await supabase.storage
            .from('content')
            .remove(filePaths);

          if (deleteError) {
            console.error('Error deleting upload files:', deleteError);
            uploadCleanupResults.errors = filePaths.length;
          } else {
            uploadCleanupResults.deleted = filePaths.length;
            console.log(`Successfully deleted ${filePaths.length} files from uploads folder`);
          }
        }
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }

      // Step 2: Create required folders
      const folders = ['processed/', 'thumbnails/'];
      const folderResults = [];

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
          folderResults.push({ folder, success: false, error: error.message });
        } else {
          console.log(`Successfully created folder: ${folder}`, data);
          folderResults.push({ folder, success: true, path: data.path });
        }
      }

      // Step 3: Provide comprehensive feedback
      const successCount = folderResults.filter(r => r.success).length;
      const failedCount = folderResults.filter(r => !r.success).length;

      let message = '';
      if (uploadCleanupResults.deleted > 0) {
        message += `Deleted ${uploadCleanupResults.deleted} files from uploads/. `;
      }
      if (successCount === folders.length) {
        message += `Created ${successCount} folders (processed/, thumbnails/)`;
        toast({
          title: "Storage Cleanup Complete",
          description: message,
          variant: "default"
        });
      } else if (successCount > 0) {
        message += `Created ${successCount} folders, ${failedCount} failed`;
        toast({
          title: "Partial Success",
          description: message + ". Check console for details.",
          variant: "default"
        });
      } else {
        toast({
          title: "Folder Creation Failed",
          description: "Failed to create storage folders. Check console for details.",
          variant: "destructive"
        });
      }

      console.log('Storage operation results:', {
        uploadCleanup: uploadCleanupResults,
        folders: folderResults
      });
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