import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ThumbnailRequest {
  bucket: string;
  path: string;
  mediaId: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { bucket, path, mediaId }: ThumbnailRequest = await req.json();
    
    console.log(`Generating thumbnail for video: ${path}`);

    // Download the original video
    const { data: videoData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(path);
    
    if (downloadError) {
      throw new Error(`Failed to download video: ${downloadError.message}`);
    }

    // Write video to temporary file
    const tempVideoPath = `/tmp/input_${mediaId}.mp4`;
    const videoBytes = new Uint8Array(await videoData.arrayBuffer());
    await Deno.writeFile(tempVideoPath, videoBytes);

    // Generate thumbnail using FFmpeg at 1 second mark
    const thumbnailPath = `/tmp/thumbnail_${mediaId}.jpg`;
    
    const ffmpegCommand = new Deno.Command("ffmpeg", {
      args: [
        '-i', tempVideoPath,
        '-ss', '00:00:01',
        '-vframes', '1',
        '-q:v', '2',
        '-vf', 'scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2',
        '-y',
        thumbnailPath
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const process = ffmpegCommand.spawn();
    const { success, stderr } = await process.output();

    if (!success) {
      const errorText = new TextDecoder().decode(stderr);
      console.error('Thumbnail generation failed:', errorText);
      
      // Fallback: try first frame
      const fallbackCommand = new Deno.Command("ffmpeg", {
        args: [
          '-i', tempVideoPath,
          '-vframes', '1',
          '-q:v', '2',
          '-vf', 'scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2',
          '-y',
          thumbnailPath
        ],
        stdout: "piped",
        stderr: "piped",
      });

      const fallbackProcess = fallbackCommand.spawn();
      const fallbackResult = await fallbackProcess.output();
      
      if (!fallbackResult.success) {
        throw new Error('Both thumbnail extraction methods failed');
      }
    }

    // Upload thumbnail to Supabase
    const thumbnailData = await Deno.readFile(thumbnailPath);
    const thumbnailFileName = `thumbnails/${mediaId}-thumbnail.jpg`;
    
    const { error: uploadError } = await supabase.storage
      .from('content')
      .upload(thumbnailFileName, thumbnailData, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Failed to upload thumbnail: ${uploadError.message}`);
    }

    // Clean up temporary files
    try {
      await Deno.remove(tempVideoPath);
      await Deno.remove(thumbnailPath);
    } catch (cleanupError) {
      console.warn('Failed to cleanup temporary files:', cleanupError);
    }

    console.log(`Thumbnail generated successfully: ${thumbnailFileName}`);

    return new Response(
      JSON.stringify({
        success: true,
        thumbnailPath: thumbnailFileName
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Thumbnail generation error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});