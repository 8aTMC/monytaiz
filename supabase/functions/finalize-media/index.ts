import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface FinalizeRequest {
  id: string;
  bucket: string;
  original_key?: string;
  original_path?: string; // legacy support
  processed: {
    image_key?: string;
    image?: string; // legacy support
    video_1080_key?: string;
    video_1080?: string; // legacy support
    video_720_key?: string;
    video_720?: string; // legacy support
  };
  meta: {
    width: number;
    height: number;
    duration?: number;
    tiny_placeholder?: string;
  };
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseService = createClient(SUPABASE_URL, SERVICE_KEY);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

// Normalize path by removing bucket prefix if present
const normalizeKey = (bucket: string, maybeKey?: string | null) => {
  if (!maybeKey) return null;
  // Strip leading bucket/ if present and remove leading slashes
  return maybeKey.replace(new RegExp(`^${bucket}/`), '').replace(/^\/+/, '');
};

Deno.serve(async (req) => {
  console.log(`${req.method} request received`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.log(`Invalid method: ${req.method}`);
    return json({ error: 'Method not allowed' }, 405);
  }

  let body: FinalizeRequest;
  try {
    // Use req.json() directly for supabase.functions.invoke calls
    body = await req.json();
    console.log('Parsed request body successfully:', JSON.stringify(body, null, 2));
  } catch (error) {
    console.error('Failed to parse JSON:', error);
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { id, bucket, processed, meta } = body;
  
  // Validate required fields
  if (!id || !bucket) {
    console.log('Missing required fields:', { id, bucket });
    return json({ error: 'id and bucket are required' }, 400);
  }

  // Normalize paths - support both new key format and legacy path format
  const originalKey = normalizeKey(bucket, body.original_key || body.original_path);
  const imageKey = normalizeKey(bucket, processed.image_key || processed.image);
  const video1080Key = normalizeKey(bucket, processed.video_1080_key || processed.video_1080);
  const video720Key = normalizeKey(bucket, processed.video_720_key || processed.video_720);

  if (!imageKey && !video1080Key && !video720Key) {
    console.log('No processed keys found');
    return json({ error: 'at least one processed key is required' }, 400);
  }

  console.log(`Finalizing media ${id}:`, {
    bucket,
    originalKey,
    imageKey,
    video1080Key,
    video720Key,
    meta
  });

  // Update database with processed keys (store KEYS, not full URLs)
  const updateData: any = {
    processing_status: 'done',
    width: meta.width || null,
    height: meta.height || null,
    tiny_placeholder: meta.tiny_placeholder || null,
    storage_path: null, // Clear original storage path reference
    original_path: null, // Clear original path reference
    bucket
  };

  // Set main path and renditions based on what was processed
  if (imageKey) {
    updateData.path = imageKey;
    updateData.storage_path = imageKey; // Set the storage_path to the processed image
  } else if (video1080Key) {
    updateData.path = video1080Key;
    updateData.storage_path = video1080Key; // Set the storage_path to the processed video
  }

  // Always store renditions if we have any video
  if (video1080Key || video720Key) {
    updateData.renditions = {
      ...(video1080Key && { video_1080: video1080Key }),
      ...(video720Key && { video_720: video720Key })
    };
  }

  if (meta.duration) {
    updateData.duration = meta.duration;
  }

  console.log('Updating media record with:', JSON.stringify(updateData, null, 2));

  const { error: updateError } = await supabaseService
    .from('media')
    .update(updateData)
    .eq('id', id);

  if (updateError) {
    console.error('DB update failed:', updateError);
    return json({ error: `db update failed: ${updateError.message}` }, 400);
  }

  console.log(`Successfully updated media row ${id}`);

  // Delete original file (key relative to bucket)
  if (originalKey) {
    console.log(`Deleting original file: ${originalKey}`);
    const { error: deleteError } = await supabaseService.storage
      .from(bucket)
      .remove([originalKey]);

    if (deleteError) {
      console.error('Storage removal failed:', deleteError);
      return json({ 
        error: `remove failed: ${deleteError.message}`, 
        key: originalKey 
      }, 400);
    }

    console.log(`Successfully deleted original file: ${originalKey}`);
  }

  console.log('Finalization complete');
  return json({ ok: true });
});