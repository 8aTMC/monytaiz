import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface FinalizeRequest {
  id: string;
  bucket: string;
  original_path: string;
  processed: {
    image?: string;
    video_1080?: string;
    video_720?: string;
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

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return json({ error: "Method not allowed" }, 405);
    }

    // Parse request body
    let body: FinalizeRequest;
    try {
      const text = await req.text();
      if (!text.trim()) {
        return json({ error: "Request body is empty" }, 400);
      }
      body = JSON.parse(text);
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return json({ error: "Invalid JSON in request body" }, 400);
    }

    const { id, bucket, original_path, processed, meta } = body;

    // Validate required fields
    if (!id || !bucket || !original_path) {
      return json({ error: "Missing required fields: id, bucket, original_path" }, 400);
    }

    console.log(`Finalizing media ${id}: original=${original_path}, processed=${JSON.stringify(processed)}`);

    // Step 1: Update media row with processed paths and metadata
    const updateData: any = {
      processing_status: 'done',
      width: meta.width,
      height: meta.height,
      tiny_placeholder: meta.tiny_placeholder,
      original_path: null // Clear original path reference
    };

    // Set main path and renditions based on what was processed
    if (processed.image) {
      updateData.path = processed.image;
    } else if (processed.video_1080) {
      updateData.path = processed.video_1080;
      updateData.renditions = {
        video_1080: processed.video_1080,
        ...(processed.video_720 && { video_720: processed.video_720 })
      };
    }

    if (meta.duration) {
      updateData.duration = meta.duration;
    }

    const { error: updateError } = await supabaseService
      .from('media')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('Failed to update media row:', updateError);
      return json({ error: `Database update failed: ${updateError.message}` }, 500);
    }

    console.log(`Successfully updated media row ${id} with processed paths`);

    // Step 2: Delete original file from content/incoming/
    try {
      const { error: deleteError } = await supabaseService.storage
        .from(bucket)
        .remove([original_path]);

      if (deleteError) {
        console.warn(`Failed to delete original file ${original_path}:`, deleteError);
        // Don't fail the entire operation if deletion fails
        // The cleanup function will handle orphaned files
      } else {
        console.log(`Successfully deleted original file: ${original_path}`);
      }
    } catch (deleteError) {
      console.warn(`Error during file deletion:`, deleteError);
      // Continue without failing
    }

    // Step 3: Return success
    return json({ 
      ok: true, 
      message: 'Media finalized successfully',
      processed_paths: processed,
      metadata: meta
    });

  } catch (error) {
    console.error('Finalize media error:', error);
    return json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});