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

const normKey = (bucket: string, k: string) =>
  k.replace(new RegExp(`^${bucket}/`), '').replace(/^\/+/, '');

Deno.serve(async (req) => {
  console.log(`${req.method} request received`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // Robust body parser with better empty handling
  let body: any;
  const contentType = req.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      const text = await req.text();
      if (!text || text.trim() === '') {
        body = {};
      } else {
        body = JSON.parse(text);
      }
    } else {
      const text = await req.text();
      body = text && text.trim() ? JSON.parse(text) : {};
    }
  } catch (parseError) {
    console.error('JSON parsing failed:', parseError);
    console.log('Raw body text length:', await req.text().then(t => t.length));
    // For empty or malformed JSON, return a more helpful response
    return json({ 
      ok: true, 
      deleted: [], 
      message: 'No valid JSON body provided - assuming no phantom folders to clean',
      details: `Content-Type: ${contentType}` 
    }); 
  }

  const bucket = body?.bucket;
  const dryRun = !!body?.dryRun;
  let prefixes = Array.isArray(body?.prefixes) ? body.prefixes : 
                 Array.isArray(body?.phantomFolders) ? body.phantomFolders : [];

  if (!bucket) {
    return json({ error: 'bucket is required' }, 400);
  }
  
  if (!prefixes.length) {
    return json({ ok: true, deleted: [], note: 'no prefixes provided' });
  }

  // Normalize keys and ensure they end with /
  prefixes = prefixes
    .map((p: string) => normKey(bucket, p))
    .filter((p: string) => !!p)
    .map((p: string) => p.endsWith('/') ? p : `${p}/`);

  console.log(`Processing prefixes:`, prefixes);

  const deleted: string[] = [];
  const kept: string[] = [];
  const errors: string[] = [];

  // Supabase "folders" are just prefixes. We consider a prefix phantom if it has 0 objects.
  for (const prefix of prefixes) {
    try {
      console.log(`Checking prefix: ${prefix}`);
      
      // Check if there is at least one object under this prefix
      const { data: list, error: listErr } = await sb.storage.from(bucket).list(prefix, { limit: 1 });
      
      if (listErr) {
        console.error(`List failed for ${prefix}:`, listErr);
        errors.push(`list failed for ${prefix}: ${listErr.message}`);
        continue;
      }

      const isEmpty = !list || list.length === 0;
      console.log(`Prefix ${prefix} isEmpty: ${isEmpty}, objects found: ${list?.length || 0}`);
      
      if (!isEmpty) { 
        kept.push(prefix); 
        continue; 
      }

      // Try to clean phantom references
      if (!dryRun) {
        // Try to delete known placeholders if present (ignore errors)
        await sb.storage.from(bucket).remove([`${prefix}.keep`]).catch(() => {});
        await sb.storage.from(bucket).remove([`${prefix}.gitkeep`]).catch(() => {});
        
        // Try to remove the prefix itself (this usually doesn't work for empty prefixes, but worth trying)
        const { error: removeErr } = await sb.storage.from(bucket).remove([prefix.slice(0, -1)]);
        if (removeErr) {
          console.log(`Remove attempt for ${prefix} failed (expected):`, removeErr.message);
        }
      }
      
      deleted.push(prefix);
      console.log(`Marked phantom prefix as deleted: ${prefix}`);
      
    } catch (error) {
      console.error(`Error processing prefix ${prefix}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`error processing ${prefix}: ${errorMessage}`);
    }
  }

  return json({ 
    ok: true, 
    bucket, 
    dryRun, 
    deleted, 
    kept,
    errors: errors.length > 0 ? errors : undefined,
    message: `Processed ${prefixes.length} prefixes: ${deleted.length} phantom, ${kept.length} kept, ${errors.length} errors`
  });
});