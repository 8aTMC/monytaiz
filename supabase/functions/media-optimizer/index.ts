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

    if (mediaType === 'video') {
      console.log('Processing video file for thumbnail generation');
      
      try {
        // Call video-thumbnail function for videos
        const { data: thumbnailData, error: thumbnailError } = await supabase.functions.invoke('video-thumbnail', {
          body: { 
            bucket: 'content', 
            path: originalPath,
            mediaId: mediaId 
          },
          headers: { 'Content-Type': 'application/json' },
        });

        if (thumbnailError) {
          console.error('Video thumbnail generation failed:', thumbnailError);
          throw new Error(`Video thumbnail generation failed: ${thumbnailError.message}`);
        }

        // Update simple_media with success status and paths
        const { error: updateError } = await supabase
          .from('simple_media')
          .update({ 
            processing_status: 'processed',
            processed_path: originalPath, // Video doesn't need separate processed version
            thumbnail_path: thumbnailData?.thumbnailPath,
            processed_at: new Date().toISOString()
          })
          .eq('id', mediaId);

        if (updateError) {
          throw new Error(`Failed to update media record: ${updateError.message}`);
        }

        console.log('Video processing completed successfully for:', mediaId);
        
        return new Response(
          JSON.stringify({
            success: true,
            mediaId,
            processedPath: originalPath,
            thumbnailPath: thumbnailData?.thumbnailPath,
            thumbnail: thumbnailData?.thumbnail
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
        
      } catch (error) {
        console.error('Video processing error:', error);
        throw error; // Re-throw to be caught by outer try-catch
      }
    } else if (mediaType === 'image') {
      // For images, just mark as processed (no additional processing needed for now)
      const { error: updateError } = await supabase
        .from('simple_media')
        .update({ 
          processing_status: 'processed',
          processed_path: originalPath,
          processed_at: new Date().toISOString()
        })
        .eq('id', mediaId);

      if (updateError) {
        throw new Error(`Failed to update image record: ${updateError.message}`);
      }

      console.log('Image processing completed successfully for:', mediaId);
      
      return new Response(
        JSON.stringify({
          success: true,
          mediaId,
          processedPath: originalPath
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    } else {
      // For audio and other types, just mark as processed
      const { error: updateError } = await supabase
        .from('simple_media')
        .update({ 
          processing_status: 'processed',
          processed_path: originalPath,
          processed_at: new Date().toISOString()
        })
        .eq('id', mediaId);

      if (updateError) {
        throw new Error(`Failed to update media record: ${updateError.message}`);
      }

      console.log('Audio/Other processing completed successfully for:', mediaId);
      
      return new Response(
        JSON.stringify({
          success: true,
          mediaId,
          processedPath: originalPath
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

  } catch (error) {
    console.error('Media optimization error:', error);

    // Try to update status to failed if we have mediaId
    try {
      const body = await req.clone().json();
      if (body.mediaId) {        
        await supabase
          .from('simple_media')
          .update({
            processing_status: 'failed',
            processing_error: error.message,
            processed_at: new Date().toISOString()
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