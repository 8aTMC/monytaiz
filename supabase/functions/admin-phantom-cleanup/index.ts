import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" }
  });

async function cleanPhantomFolders(bucket: string, folderPaths: string[]) {
  const results = [];
  
  for (const folderPath of folderPaths) {
    console.log(`Attempting to clean phantom folder: ${folderPath}`);
    
    try {
      // Try to list all files in the folder first
      const { data: listData, error: listError } = await supabaseAdmin.storage
        .from(bucket)
        .list(folderPath, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });

      console.log(`List result for ${folderPath}:`, { listData, listError, count: listData?.length });

      const cleanupResults = [];

      // Approach 1: If folder has files, try to remove all files first
      if (listData && listData.length > 0) {
        const filesToDelete = listData.map(file => `${folderPath}/${file.name}`);
        console.log(`Found ${filesToDelete.length} files in folder ${folderPath}, deleting:`, filesToDelete);
        
        const { error: filesDeleteError } = await supabaseAdmin.storage
          .from(bucket)
          .remove(filesToDelete);
        
        cleanupResults.push({
          method: 'delete_files_first',
          error: filesDeleteError?.message || null,
          filesDeleted: filesToDelete.length
        });
      }

      // Approach 2: Try multiple path variations for removal
      const pathVariations = [
        folderPath,
        `${folderPath}/`,
        `./${folderPath}`,
        `./${folderPath}/`
      ];

      for (const variation of pathVariations) {
        try {
          const { error: variationError } = await supabaseAdmin.storage
            .from(bucket)
            .remove([variation]);
          
          cleanupResults.push({
            method: `remove_${variation.replace(/[./]/g, '_')}`,
            error: variationError?.message || null
          });
        } catch (err) {
          cleanupResults.push({
            method: `remove_${variation.replace(/[./]/g, '_')}`,
            error: err.message
          });
        }
      }

      // Approach 3: Force cleanup by uploading and deleting temp file
      try {
        const tempFileName = `${folderPath}/.temp_cleanup_${Date.now()}`;
        
        const { error: uploadError } = await supabaseAdmin.storage
          .from(bucket)
          .upload(tempFileName, new Blob(['temp']), { upsert: true });

        if (!uploadError) {
          // Now try to delete both the temp file and the folder
          const { error: deleteError } = await supabaseAdmin.storage
            .from(bucket)
            .remove([tempFileName, folderPath, `${folderPath}/`]);
          
          cleanupResults.push({
            method: 'temp_file_force_cleanup',
            error: deleteError?.message || null
          });
        } else {
          cleanupResults.push({
            method: 'temp_file_force_cleanup',
            error: `Upload failed: ${uploadError.message}`
          });
        }
      } catch (tempError) {
        cleanupResults.push({
          method: 'temp_file_force_cleanup',
          error: `Exception: ${tempError.message}`
        });
      }

      results.push({
        folder: folderPath,
        cleanupResults,
        success: cleanupResults.some(r => !r.error),
        totalAttempts: cleanupResults.length
      });

    } catch (error) {
      console.error(`Error cleaning folder ${folderPath}:`, error);
      results.push({
        folder: folderPath,
        error: error.message,
        success: false,
        totalAttempts: 0
      });
    }
  }

  return results;
}

Deno.serve(async (req) => {
  console.log(`${req.method} request received`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const { bucket, phantomFolders } = await req.json();
    
    if (!bucket) {
      return json({ error: 'bucket is required' }, 400);
    }

    if (!phantomFolders || !Array.isArray(phantomFolders)) {
      return json({ error: 'phantomFolders array is required' }, 400);
    }

    console.log(`Cleaning phantom folders [${phantomFolders.join(', ')}] from bucket "${bucket}"`);

    // First, verify the bucket exists and is accessible
    const { data: buckets, error: bucketError } = await supabaseAdmin.storage.listBuckets();
    
    if (bucketError) {
      return json({ error: `Failed to access buckets: ${bucketError.message}` }, 500);
    }

    const targetBucket = buckets?.find(b => b.id === bucket);
    if (!targetBucket) {
      return json({ error: `Bucket '${bucket}' not found` }, 404);
    }

    console.log(`Target bucket found:`, targetBucket);

    // Clean phantom folders
    const cleanupResults = await cleanPhantomFolders(bucket, phantomFolders);

    return json({
      success: true,
      bucket,
      phantomFolders,
      cleanupResults,
      message: `Phantom folder cleanup completed for ${phantomFolders.length} folders`
    });

  } catch (error) {
    console.error('Request processing error:', error);
    return json({ 
      error: `Failed to process phantom cleanup request: ${error.message}` 
    }, 500);
  }
});