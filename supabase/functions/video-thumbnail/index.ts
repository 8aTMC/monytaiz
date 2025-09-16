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

  let mediaId: string | undefined;
  let tempVideoPath: string | undefined;
  let thumbnailPath: string | undefined;

  try {
    const requestBody = await req.json();
    const { bucket, path, mediaId: parsedMediaId } = requestBody;
    mediaId = parsedMediaId;

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

    // First, check the file info to get size
    const { data: fileInfo, error: fileInfoError } = await supabase.storage
      .from(bucket)
      .info(path);

    if (fileInfoError) {
      console.log('Could not get file info, proceeding with download...');
    } else if (fileInfo && fileInfo.size > 500 * 1024 * 1024) { // 500MB limit
      // Don't throw error, just mark as processed without thumbnail
      console.log(`File too large for thumbnail generation: ${(fileInfo.size / 1024 / 1024).toFixed(1)}MB. Marking as processed without thumbnail.`);
      
      // Update media record as processed without thumbnail
      const { error: updateError } = await supabase
        .from('simple_media')
        .update({
          processing_status: 'processed',
          processed_at: new Date().toISOString(),
          processing_error: `File too large for thumbnail: ${(fileInfo.size / 1024 / 1024).toFixed(1)}MB`
        })
        .eq('id', mediaId);

      if (updateError) {
        console.error('Failed to update media record:', updateError);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Video processed without thumbnail due to file size',
        skippedThumbnail: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Download video file with streaming approach
    const { data: videoData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(path);

    if (downloadError || !videoData) {
      throw new Error(`Failed to download video: ${downloadError?.message || 'No data'}`);
    }

    // Write video to temp file using streaming
    tempVideoPath = `/tmp/video_${mediaId}.mp4`;
    
    // Use ReadableStream to avoid loading entire file into memory at once
    const videoStream = videoData.stream();
    let fileHandle: Deno.FsFile | undefined;
    
    try {
      fileHandle = await Deno.open(tempVideoPath, { write: true, create: true });
      await videoStream.pipeTo(fileHandle.writable);
    } catch (streamError) {
      console.error('Error during video streaming:', streamError);
      throw new Error(`Video streaming failed: ${streamError instanceof Error ? streamError.message : 'Unknown error'}`);
    } finally {
      if (fileHandle) {
        try {
          fileHandle.close();
        } catch (closeError) {
          console.warn('Warning: Could not close file handle:', closeError);
        }
      }
    }

    console.log(`💾 Video saved to: ${tempVideoPath}`);

    // Generate thumbnail using ffmpeg with memory-efficient settings
    thumbnailPath = `/tmp/thumb_${mediaId}.jpg`;
    
    const ffmpegArgs = [
      '-i', tempVideoPath,
      '-ss', '00:00:01',        // Seek to 1 second
      '-vframes', '1',          // Extract 1 frame
      '-q:v', '3',              // Good quality but smaller file
      '-vf', 'scale=320:240:force_original_aspect_ratio=decrease', // Smart scaling
      '-threads', '1',          // Limit thread usage for memory efficiency
      '-y',                     // Overwrite existing
      thumbnailPath
    ];

    console.log('🔄 Running FFmpeg for thumbnail generation...');
    
    const ffmpeg = new Deno.Command('ffmpeg', {
      args: ffmpegArgs,
      stdout: 'piped',
      stderr: 'piped'
    });

    // Set a timeout for FFmpeg process
    const timeoutMs = 30000; // 30 seconds
    const ffmpegPromise = ffmpeg.output();
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('FFmpeg timeout after 30 seconds')), timeoutMs);
    });

    const ffmpegResult = await Promise.race([ffmpegPromise, timeoutPromise]);

    if (!ffmpegResult.success) {
      const stderr = new TextDecoder().decode(ffmpegResult.stderr);
      throw new Error(`FFmpeg failed: ${stderr}`);
    }

    console.log('✅ Thumbnail generated successfully');

    // Read thumbnail and upload to storage
    const thumbnailData = await Deno.readFile(thumbnailPath);
    
    // Get the file ID and original filename from the path
    const pathParts = path.split('/');
    const originalFilename = pathParts[pathParts.length - 1];
    
    // Extract the fileId and base filename (format: "fileId-originalname.ext")
    const fileIdMatch = originalFilename.match(/^([a-f0-9-]{36})-(.+)$/);
    if (!fileIdMatch) {
      throw new Error(`Invalid filename format: ${originalFilename}`);
    }
    
    const [, fileId, baseFilename] = fileIdMatch;
    const filenameWithoutExt = baseFilename.replace(/\.[^/.]+$/, '');
    const thumbnailStoragePath = `thumbnails/${fileId}-${filenameWithoutExt}_thumb.jpg`;

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
        processing_status: 'processed',
        processed_at: new Date().toISOString()
      })
      .eq('id', mediaId);

    if (updateError) {
      console.error('Failed to update media record:', updateError);
    }

    // Cleanup temp files
    try {
      if (tempVideoPath) {
        await Deno.remove(tempVideoPath);
      }
      if (thumbnailPath) {
        await Deno.remove(thumbnailPath);
      }
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
    
    // Even if thumbnail generation fails, mark video as processed so it shows in library
    if (mediaId) {
      try {
        const { error: updateError } = await supabase
          .from('simple_media')
          .update({
            processing_status: 'processed',
            processed_at: new Date().toISOString(),
            processing_error: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', mediaId);

        if (updateError) {
          console.error('Failed to update media record after error:', updateError);
        }
      } catch (updateErr) {
        console.error('Failed to update media record:', updateErr);
      }
    }
    
    return new Response(JSON.stringify({
      success: true, // Return success so video is still processed
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Video processed without thumbnail due to error',
      skippedThumbnail: true
    }), {
      status: 200, // Return 200 so upload process continues
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } finally {
    // Final cleanup attempt for temp files
    try {
      if (tempVideoPath) {
        await Deno.remove(tempVideoPath);
      }
      if (thumbnailPath) {
        await Deno.remove(thumbnailPath);
      }
    } catch (e) {
      console.warn('Final cleanup warning:', e);
    }
  }
});