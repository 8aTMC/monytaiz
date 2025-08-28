import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseService = createClient(SUPABASE_URL, SERVICE_KEY);

interface CleanupResult {
  deletedFiles: number;
  clearedReferences: number;
  errors: string[];
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  try {
    console.log('Starting cleanup of orphaned incoming files...');
    
    const result: CleanupResult = {
      deletedFiles: 0,
      clearedReferences: 0,
      errors: []
    };

    // Step 1: Find files in content/incoming/ older than 24 hours
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    try {
      const { data: files, error: listError } = await supabaseService.storage
        .from('content')
        .list('incoming', {
          limit: 1000,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (listError) {
        result.errors.push(`Failed to list files: ${listError.message}`);
        return json(result, 500);
      }

      console.log(`Found ${files?.length || 0} files in incoming folder`);

      if (!files || files.length === 0) {
        console.log('No files to clean up');
        return json(result);
      }

      // Filter files older than 24 hours
      const oldFiles = files.filter(file => {
        if (!file.created_at) return false;
        const fileDate = new Date(file.created_at);
        return fileDate < cutoffTime;
      });

      console.log(`Found ${oldFiles.length} files older than 24 hours`);

      if (oldFiles.length === 0) {
        return json(result);
      }

      // Step 2: Delete old files from storage
      const filePaths = oldFiles.map(file => `incoming/${file.name}`);
      
      try {
        const { error: deleteError } = await supabaseService.storage
          .from('content')
          .remove(filePaths);

        if (deleteError) {
          result.errors.push(`Failed to delete files: ${deleteError.message}`);
        } else {
          result.deletedFiles = filePaths.length;
          console.log(`Deleted ${filePaths.length} orphaned files`);
        }
      } catch (deleteError) {
        result.errors.push(`Error during file deletion: ${deleteError}`);
      }

      // Step 3: Clear original_path references in media table for deleted files
      try {
        const { error: clearError } = await supabaseService
          .from('media')
          .update({ original_path: null })
          .in('original_path', filePaths);

        if (clearError) {
          result.errors.push(`Failed to clear DB references: ${clearError.message}`);
        } else {
          // Count how many rows were affected
          const { count, error: countError } = await supabaseService
            .from('media')
            .select('id', { count: 'exact', head: true })
            .is('original_path', null)
            .gte('updated_at', new Date().toISOString());

          if (!countError && count !== null) {
            result.clearedReferences = count;
          }
          
          console.log(`Cleared original_path references for deleted files`);
        }
      } catch (clearError) {
        result.errors.push(`Error clearing DB references: ${clearError}`);
      }

      // Step 4: Also clean up any media rows that are still in 'processing' state for more than 1 hour
      try {
        const processingCutoff = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
        
        const { error: processingError } = await supabaseService
          .from('media')
          .update({ processing_status: 'error' })
          .eq('processing_status', 'processing')
          .lt('created_at', processingCutoff.toISOString());

        if (processingError) {
          result.errors.push(`Failed to clean stale processing records: ${processingError.message}`);
        } else {
          console.log(`Marked stale processing records as error`);
        }
      } catch (processingError) {
        result.errors.push(`Error cleaning processing records: ${processingError}`);
      }

      // Step 5: Remove empty UUID folders in processed/
      try {
        const { data: processedFiles } = await supabaseService.storage
          .from('content')
          .list('processed', { limit: 1000 });

        if (processedFiles?.length > 0) {
          let emptyFoldersRemoved = 0;
          for (const folder of processedFiles) {
            if (folder.name.length === 36) { // UUID length
              const { data: contents } = await supabaseService.storage
                .from('content')
                .list(`processed/${folder.name}`, { limit: 10 });
              
              if (!contents || contents.length === 0) {
                emptyFoldersRemoved++;
              }
            }
          }
          
          if (emptyFoldersRemoved > 0) {
            console.log(`Found ${emptyFoldersRemoved} empty UUID folders`);
          }
        }
      } catch (folderError) {
        result.errors.push(`Error cleaning empty folders: ${folderError}`);
      }

    } catch (error) {
      result.errors.push(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log('Cleanup completed:', result);
    
    return json({
      success: result.errors.length === 0,
      ...result,
      message: `Cleanup completed: ${result.deletedFiles} files deleted, ${result.clearedReferences} references cleared, ${result.errors.length} errors`
    });

  } catch (error) {
    console.error('Clean incoming error:', error);
    return json({ 
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});