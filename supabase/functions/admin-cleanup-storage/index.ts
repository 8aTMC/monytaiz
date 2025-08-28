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

// Recursively list all files in a folder
async function listAllFiles(bucket: string, folderPath?: string): Promise<string[]> {
  const allFiles: string[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data: files, error } = await supabaseAdmin.storage
      .from(bucket)
      .list(folderPath, {
        limit,
        offset,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (error) {
      console.error(`Error listing files in ${folderPath}:`, error);
      break;
    }

    if (!files || files.length === 0) break;

    for (const file of files) {
      const fullPath = folderPath ? `${folderPath}/${file.name}` : file.name;
      
      if (file.id === null) {
        // This is a folder, recursively list its contents
        const subFiles = await listAllFiles(bucket, fullPath);
        allFiles.push(...subFiles);
      } else {
        // This is a file
        allFiles.push(fullPath);
      }
    }

    offset += limit;
    if (files.length < limit) break;
  }

  return allFiles;
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
    const { bucket, folders } = await req.json();
    
    if (!bucket) {
      return json({ error: 'bucket is required' }, 400);
    }

    if (!folders || !Array.isArray(folders)) {
      return json({ error: 'folders array is required' }, 400);
    }

    console.log(`Cleaning up folders [${folders.join(', ')}] from bucket "${bucket}"`);

    const results = [];
    let totalDeleted = 0;

    for (const folder of folders) {
      console.log(`Processing folder: ${folder}`);
      
      try {
        // List all files in this folder recursively
        const filesToDelete = await listAllFiles(bucket, folder);
        console.log(`Found ${filesToDelete.length} files in folder ${folder}`);

        if (filesToDelete.length === 0) {
          results.push({
            folder,
            deleted: 0,
            message: 'Folder is empty or does not exist'
          });
          continue;
        }

        // Delete files in batches to avoid timeout
        const batchSize = 100;
        let deletedInFolder = 0;

        for (let i = 0; i < filesToDelete.length; i += batchSize) {
          const batch = filesToDelete.slice(i, i + batchSize);
          console.log(`Deleting batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(filesToDelete.length/batchSize)} for folder ${folder}`);
          
          const { error: deleteError } = await supabaseAdmin.storage
            .from(bucket)
            .remove(batch);

          if (deleteError) {
            console.error(`Error deleting batch from ${folder}:`, deleteError);
            results.push({
              folder,
              deleted: deletedInFolder,
              error: `Failed to delete some files: ${deleteError.message}`,
              partialSuccess: true
            });
            break;
          } else {
            deletedInFolder += batch.length;
          }
        }

        if (deletedInFolder === filesToDelete.length) {
          results.push({
            folder,
            deleted: deletedInFolder,
            message: 'Successfully deleted all files'
          });
        }

        totalDeleted += deletedInFolder;

      } catch (error) {
        console.error(`Error processing folder ${folder}:`, error);
        results.push({
          folder,
          deleted: 0,
          error: `Failed to process folder: ${error.message}`
        });
      }
    }

    return json({
      success: true,
      bucket,
      totalDeleted,
      results,
      message: `Cleanup completed. Deleted ${totalDeleted} files total.`
    });

  } catch (error) {
    console.error('Request processing error:', error);
    return json({ 
      error: `Failed to process request: ${error.message}` 
    }, 500);
  }
});