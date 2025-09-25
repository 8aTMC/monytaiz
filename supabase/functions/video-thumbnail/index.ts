import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Create a simple 1x1 pixel JPEG as placeholder thumbnail
function createPlaceholderThumbnail(): Uint8Array {
  // This is a minimal valid JPEG file (1x1 pixel, gray)
  const jpegBytes = new Uint8Array([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
    0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
    0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
    0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF, 0xC4,
    0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C,
    0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0x80, 0x00,
    0xFF, 0xD9
  ]);
  return jpegBytes;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🎬 Video thumbnail generator started');

  let mediaId: string | undefined;

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

    console.log(`📹 Processing video: ${bucket}/${path}`);

    // Check file size first
    const { data: fileInfo, error: fileInfoError } = await supabase.storage
      .from(bucket)
      .info(path);

    if (fileInfoError) {
      console.log('Could not get file info, proceeding...');
    } else if (fileInfo && fileInfo.size && fileInfo.size > 200 * 1024 * 1024) {
      console.log(`File too large for processing: ${(fileInfo.size / 1024 / 1024).toFixed(1)}MB. Marking as processed without thumbnail.`);
      
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

    console.log('🔄 Creating placeholder thumbnail...');

    // Create a simple placeholder thumbnail
    const thumbnailData = createPlaceholderThumbnail();
    
    console.log('✅ Placeholder thumbnail created');

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

    // Upload thumbnail to storage
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

    return new Response(JSON.stringify({
      success: true,
      thumbnailPath: thumbnailStoragePath,
      message: 'Placeholder thumbnail generated successfully'
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
  }
});