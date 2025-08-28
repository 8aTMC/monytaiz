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
      // Try to list the folder to see if it has any metadata
      const { data: listData, error: listError } = await supabaseAdmin.storage
        .from(bucket)
        .list(folderPath, { limit: 1 });

      console.log(`List result for ${folderPath}:`, { listData, listError });

      // Try multiple cleanup approaches
      const cleanupResults = [];

      // Approach 1: Try to remove the folder path directly
      const { error: removeError1 } = await supabaseAdmin.storage
        .from(bucket)
        .remove([folderPath]);
      
      cleanupResults.push({
        method: 'direct_remove',
        error: removeError1?.message || null
      });

      // Approach 2: Try to remove with trailing slash
      const { error: removeError2 } = await supabaseAdmin.storage
        .from(bucket)
        .remove([`${folderPath}/`]);
      
      cleanupResults.push({
        method: 'trailing_slash_remove',
        error: removeError2?.message || null
      });

      // Approach 3: Try to create and immediately delete a temp file in the folder
      const tempFileName = `${folderPath}/.temp_cleanup_${Date.now()}`;
      
      const { error: uploadError } = await supabaseAdmin.storage
        .from(bucket)
        .upload(tempFileName, new Blob(['temp']), { upsert: true });

      if (!uploadError) {
        const { error: deleteError } = await supabaseAdmin.storage
          .from(bucket)
          .remove([tempFileName, folderPath]);
        
        cleanupResults.push({
          method: 'temp_file_cleanup',
          error: deleteError?.message || null
        });
      } else {
        cleanupResults.push({
          method: 'temp_file_cleanup',
          error: `Upload failed: ${uploadError.message}`
        });
      }

      results.push({
        folder: folderPath,
        cleanupResults,
        success: cleanupResults.some(r => !r.error)
      });

    } catch (error) {
      console.error(`Error cleaning folder ${folderPath}:`, error);
      results.push({
        folder: folderPath,
        error: error.message,
        success: false
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