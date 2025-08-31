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

// Generate video thumbnail using FFmpeg
async function generateVideoThumbnail(videoUrl: string): Promise<string | null> {
  try {
    console.log('Generating thumbnail for video:', videoUrl);
    
    // Create a temporary file for the video
    const videoResponse = await fetch(videoUrl, {
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });
    
    if (!videoResponse.ok) {
      console.error('Failed to fetch video:', videoResponse.status);
      return null;
    }
    
    const videoBuffer = await videoResponse.arrayBuffer();
    const tempVideoPath = `/tmp/input_${Date.now()}.mp4`;
    const tempThumbnailPath = `/tmp/thumb_${Date.now()}.jpg`;
    
    // Write video to temporary file
    await Deno.writeFile(tempVideoPath, new Uint8Array(videoBuffer));
    
    // Use FFmpeg to extract thumbnail at 1 second mark
    const ffmpegCommand = new Deno.Command("ffmpeg", {
      args: [
        "-i", tempVideoPath,
        "-ss", "00:00:01",  // Seek to 1 second
        "-vframes", "1",    // Extract 1 frame
        "-q:v", "2",        // High quality
        "-vf", "scale=400:300:force_original_aspect_ratio=decrease,pad=400:300:(ow-iw)/2:(oh-ih)/2", // Scale and pad
        "-y",               // Overwrite output file
        tempThumbnailPath
      ],
      stdout: "piped",
      stderr: "piped",
    });
    
    const process = ffmpegCommand.spawn();
    const { success, stderr } = await process.output();
    
    if (!success) {
      const errorText = new TextDecoder().decode(stderr);
      console.error('FFmpeg error:', errorText);
      
      // Cleanup temp files
      try {
        await Deno.remove(tempVideoPath);
      } catch {}
      
      return createFallbackThumbnail();
    }
    
    // Read the generated thumbnail
    const thumbnailBuffer = await Deno.readFile(tempThumbnailPath);
    const base64Thumbnail = btoa(String.fromCharCode(...thumbnailBuffer));
    const dataUrl = `data:image/jpeg;base64,${base64Thumbnail}`;
    
    // Cleanup temp files
    try {
      await Deno.remove(tempVideoPath);
      await Deno.remove(tempThumbnailPath);
    } catch (cleanupError) {
      console.warn('Cleanup error:', cleanupError);
    }
    
    console.log('Successfully generated video thumbnail');
    return dataUrl;
    
  } catch (error) {
    console.error('Error generating video thumbnail:', error);
    return createFallbackThumbnail();
  }
}

// Create fallback SVG thumbnail
function createFallbackThumbnail(): string {
  const videoPlaceholder = 'data:image/svg+xml;base64,' + btoa(`
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#2563eb;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bg)"/>
      <circle cx="200" cy="150" r="35" fill="#ffffff" opacity="0.9"/>
      <polygon points="185,135 185,165 215,150" fill="#2563eb"/>
      <text x="200" y="220" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="14" opacity="0.8">Video Thumbnail</text>
    </svg>
  `);
  return videoPlaceholder;
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