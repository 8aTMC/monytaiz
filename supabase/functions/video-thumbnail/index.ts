import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🎬 Video thumbnail generator started');

  try {
    const { bucket, path, mediaId } = await req.json();

    if (!bucket || !path || !mediaId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required parameters: bucket, path, mediaId'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📹 Generating thumbnail for: ${bucket}/${path}`);

    // Download video file
    const { data: videoData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(path);

    if (downloadError || !videoData) {
      throw new Error(`Failed to download video: ${downloadError?.message || 'No data'}`);
    }

    // Write video to temp file
    const tempVideoPath = `/tmp/video_${mediaId}.mp4`;
    const videoBuffer = await videoData.arrayBuffer();
    await Deno.writeFile(tempVideoPath, new Uint8Array(videoBuffer));

    console.log(`💾 Video saved to: ${tempVideoPath}`);

    // Generate thumbnail using ffmpeg
    const thumbnailPath = `/tmp/thumb_${mediaId}.jpg`;
    
    const ffmpegArgs = [
      '-i', tempVideoPath,
      '-ss', '00:00:01',        // Seek to 1 second
      '-vframes', '1',          // Extract 1 frame
      '-q:v', '2',              // High quality
      '-vf', 'scale=320:240',   // Resize to reasonable thumbnail size
      '-y',                     // Overwrite existing
      thumbnailPath
    ];

    console.log('🔄 Running FFmpeg for thumbnail generation...');
    
    const ffmpeg = new Deno.Command('ffmpeg', {
      args: ffmpegArgs,
      stdout: 'piped',
      stderr: 'piped'
    });

    const ffmpegResult = await ffmpeg.output();

    if (!ffmpegResult.success) {
      const stderr = new TextDecoder().decode(ffmpegResult.stderr);
      throw new Error(`FFmpeg failed: ${stderr}`);
    }

    console.log('✅ Thumbnail generated successfully');

    // Read thumbnail and upload to storage
    const thumbnailData = await Deno.readFile(thumbnailPath);
    
    // Get the original filename from the path to create a meaningful thumbnail name
    const pathParts = path.split('/');
    const originalFilename = pathParts[pathParts.length - 1];
    const filenameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
    const thumbnailStoragePath = `thumbnails/${filenameWithoutExt}_thumb.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('content')
      .upload(thumbnailStoragePath, thumbnailData, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Thumbnail upload failed: ${uploadError.message}`);
    }

    console.log(`📤 Thumbnail uploaded to: ${thumbnailStoragePath}`);

    // Update media record with thumbnail path
    const { error: updateError } = await supabase
      .from('simple_media')
      .update({
        thumbnail_path: thumbnailStoragePath,
        processing_status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', mediaId);

    if (updateError) {
      console.error('Failed to update media record:', updateError);
    }

    // Cleanup temp files
    try {
      await Deno.remove(tempVideoPath);
      await Deno.remove(thumbnailPath);
    } catch (e) {
      console.warn('Failed to cleanup temp files:', e);
    }

    return new Response(JSON.stringify({
      success: true,
      thumbnailPath: thumbnailStoragePath,
      message: 'Thumbnail generated successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Thumbnail generation error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Check edge function logs for more information'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});