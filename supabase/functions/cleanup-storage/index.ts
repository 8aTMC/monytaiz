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
    console.log('Starting cleanup of temporary and orphaned files...');
    
    const result: CleanupResult = {
      deletedFiles: 0,
      clearedReferences: 0,
      errors: []
    };

    // Clean up any simple_media rows that are still in 'processing' state for more than 1 hour
    try {
      const processingCutoff = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      
      const { error: processingError } = await supabaseService
        .from('simple_media')
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

    // Clean up orphaned thumbnail files (thumbnails without corresponding media)
    try {
      const { data: thumbnailFiles, error: listError } = await supabaseService.storage
        .from('content')
        .list('thumbnails', {
          limit: 1000,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (!listError && thumbnailFiles?.length > 0) {
        console.log(`Found ${thumbnailFiles.length} thumbnail files`);
        
        // Check which thumbnails have corresponding media records
        const thumbnailNames = thumbnailFiles.map(f => f.name.replace('.jpg', '').replace('.png', ''));
        
        const { data: mediaRecords } = await supabaseService
          .from('simple_media')
          .select('id')
          .in('id', thumbnailNames);
        
        const validMediaIds = (mediaRecords || []).map(m => m.id);
        const orphanedThumbnails = thumbnailFiles.filter(f => {
          const mediaId = f.name.replace('.jpg', '').replace('.png', '');
          return !validMediaIds.includes(mediaId);
        });

        if (orphanedThumbnails.length > 0) {
          const thumbnailPaths = orphanedThumbnails.map(f => `thumbnails/${f.name}`);
          
          const { error: deleteError } = await supabaseService.storage
            .from('content')
            .remove(thumbnailPaths);

          if (deleteError) {
            result.errors.push(`Failed to delete orphaned thumbnails: ${deleteError.message}`);
          } else {
            result.deletedFiles = thumbnailPaths.length;
            console.log(`Deleted ${thumbnailPaths.length} orphaned thumbnail files`);
          }
        }
      }
    } catch (error) {
      result.errors.push(`Error cleaning thumbnails: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Remove empty UUID folders in processed/
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