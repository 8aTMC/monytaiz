import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const sb = createClient(url, key);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { 
    status: s, 
    headers: { ...corsHeaders, 'content-type': 'application/json' } 
  });

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
    const foldersToCreate = ['processed/', 'thumbnails/'];
    const placeholderContent = new TextEncoder().encode('# Folder Placeholder\nThis file maintains the folder structure in Supabase Storage.\n');
    const results = [];

    for (const folder of foldersToCreate) {
      const placeholderPath = `${folder}.gitkeep`;
      
      console.log(`Creating folder: ${folder} with placeholder: ${placeholderPath}`);
      
      // Upload placeholder file to create folder structure
      const { data, error } = await sb.storage
        .from('content')
        .upload(placeholderPath, placeholderContent, {
          contentType: 'text/plain',
          upsert: true // Overwrite if exists
        });

      if (error) {
        console.error(`Failed to create folder ${folder}:`, error);
        results.push({
          folder: folder,
          success: false,
          error: error.message
        });
      } else {
        console.log(`Successfully created folder: ${folder}`);
        results.push({
          folder: folder,
          success: true,
          path: data.path
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return json({
      success: failureCount === 0,
      message: `Folder recreation completed: ${successCount} successful, ${failureCount} failed`,
      results: results,
      foldersCreated: results.filter(r => r.success).map(r => r.folder)
    });

  } catch (error) {
    console.error('Folder recreation failed:', error);
    return json({
      success: false,
      error: 'Failed to recreate folders',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});