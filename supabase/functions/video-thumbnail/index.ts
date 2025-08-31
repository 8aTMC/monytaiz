import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

// Generate video thumbnail using canvas API
async function generateVideoThumbnail(videoUrl: string): Promise<string | null> {
  try {
    // Since we're in Deno, we'll use a different approach
    // We'll need to use FFmpeg or similar tool to extract frames
    // For now, let's create a placeholder that can be enhanced later
    
    // This is a fallback approach - in a real implementation, you'd use FFmpeg
    // to extract a frame from the video at a specific timestamp
    const response = await fetch(videoUrl, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) {
      return null;
    }
    
    // For now, return a video-specific placeholder
    // This could be enhanced with actual frame extraction
    const videoPlaceholder = 'data:image/svg+xml;base64,' + btoa(`
      <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="300" fill="#1a1a1a"/>
        <circle cx="200" cy="150" r="40" fill="#ffffff" opacity="0.8"/>
        <polygon points="185,130 185,170 220,150" fill="#1a1a1a"/>
        <text x="200" y="220" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="16">Video</text>
      </svg>
    `);
    
    return videoPlaceholder;
  } catch (error) {
    console.error('Error generating video thumbnail:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return json({ error: "Method not allowed" }, 405);
    }

    const { bucket, path } = await req.json();
    if (!bucket || !path) {
      return json({ error: "bucket and path required" }, 400);
    }

    console.log(`Generating video thumbnail for: ${bucket}/${path}`);

    // Get signed URL for the video
    const { data: signedData, error: signError } = await sb.storage
      .from(bucket)
      .createSignedUrl(path, 300); // 5 minutes

    if (signError || !signedData?.signedUrl) {
      return json({ error: signError?.message || "Failed to get signed URL" }, 500);
    }

    // Generate thumbnail
    const thumbnailDataUrl = await generateVideoThumbnail(signedData.signedUrl);
    
    if (!thumbnailDataUrl) {
      return json({ error: "Failed to generate video thumbnail" }, 500);
    }

    // Update the media record with the thumbnail
    const { error: updateError } = await sb
      .from("media")
      .update({ tiny_placeholder: thumbnailDataUrl })
      .eq("bucket", bucket)
      .eq("path", path);

    if (updateError) {
      console.error('Failed to update media record:', updateError);
      return json({ error: updateError.message }, 500);
    }

    console.log(`Successfully generated thumbnail for: ${bucket}/${path}`);
    
    return json({ 
      ok: true, 
      thumbnail: thumbnailDataUrl 
    });
  } catch (error) {
    console.error('Video thumbnail generation error:', error);
    return json({ error: String(error) }, 500);
  }
});