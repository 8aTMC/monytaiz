import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OptimizeRequest {
  mediaId: string;
  originalPath: string;
  mimeType: string;
  mediaType: 'image' | 'video' | 'audio';
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

    const { mediaId, originalPath, mimeType, mediaType }: OptimizeRequest = await req.json();
    
    console.log('Starting optimization for:', { mediaId, originalPath, mimeType, mediaType });

    // Update status to processing
    await supabase
      .from('simple_media')
      .update({ processing_status: 'processing' })
      .eq('id', mediaId);

    // Download original file
    const { data: originalFile, error: downloadError } = await supabase.storage
      .from('content')
      .download(originalPath);

    if (downloadError) {
      throw new Error(`Failed to download original file: ${downloadError.message}`);
    }

    const processedPath = `processed/${mediaId}.webp`;
    const thumbnailPath = `processed/thumbs/${mediaId}.webp`;

    // For now, we'll just copy the original file as WebP
    // In a real implementation, you'd convert using Sharp or similar
    const optimizedBlob = originalFile;
    const thumbnailBlob = originalFile; // Simplified for now

    // Upload processed file
    const { error: uploadError } = await supabase.storage
      .from('content')
      .upload(processedPath, optimizedBlob, {
        contentType: 'image/webp',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Failed to upload processed file: ${uploadError.message}`);
    }

    // Upload thumbnail
    const { error: thumbError } = await supabase.storage
      .from('content')
      .upload(thumbnailPath, thumbnailBlob, {
        contentType: 'image/webp',
        upsert: true
      });

    if (thumbError) {
      console.warn('Thumbnail upload failed:', thumbError.message);
    }

    // Update database with processed paths
    const { error: updateError } = await supabase
      .from('simple_media')
      .update({
        processing_status: 'processed',
        processed_path: processedPath,
        thumbnail_path: thumbnailPath,
        optimized_size_bytes: optimizedBlob.size,
        processed_at: new Date().toISOString()
      })
      .eq('id', mediaId);

    if (updateError) {
      throw new Error(`Failed to update media record: ${updateError.message}`);
    }

    console.log('Optimization completed successfully for:', mediaId);

    return new Response(
      JSON.stringify({
        success: true,
        mediaId,
        processedPath,
        thumbnailPath
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Media optimization error:', error);

    // Try to update status to failed if we have mediaId
    try {
      const body = await req.clone().json();
      if (body.mediaId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase
          .from('simple_media')
          .update({
            processing_status: 'failed',
            processing_error: error.message
          })
          .eq('id', body.mediaId);
      }
    } catch (updateError) {
      console.error('Failed to update error status:', updateError);
    }

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