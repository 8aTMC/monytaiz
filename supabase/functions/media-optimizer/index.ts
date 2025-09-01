import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OptimizeRequest {
  mediaId: string;
  originalPath: string;
  processedPath?: string;
  processedPaths?: { [quality: string]: string };
  thumbnailPath?: string;
  mimeType: string;
  mediaType: 'image' | 'video' | 'audio';
  skipProcessing?: boolean;
  qualityInfo?: any;
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

    const { 
      mediaId, 
      originalPath, 
      processedPath, 
      processedPaths, 
      thumbnailPath, 
      mimeType, 
      mediaType, 
      skipProcessing,
      qualityInfo 
    }: OptimizeRequest = await req.json();
    
    console.log('Starting optimization for:', { mediaId, originalPath, processedPaths, thumbnailPath, mimeType, mediaType, skipProcessing });

    // Update status to processing
    await supabase
      .from('simple_media')
      .update({ processing_status: 'processing' })
      .eq('id', mediaId);

    // Handle pre-processed media (client-side optimization already complete)
    if (skipProcessing) {
      console.log(`Cleaning up original file for pre-processed ${mediaType}:`, mediaId);
      
      try {
        // Delete original file from storage (never keep originals)
        const { error: deleteError } = await supabase.storage
          .from('content')
          .remove([originalPath]);
        
        if (deleteError) {
          console.error('Failed to delete original file:', deleteError);
          // Don't throw - the processed files are still valid
        }
        
        console.log(`Pre-processed ${mediaType} cleanup completed for:`, mediaId);
        
        return new Response(
          JSON.stringify({
            success: true,
            mediaId,
            processedPaths: processedPaths || { default: processedPath },
            thumbnailPath,
            cleanedUp: true,
            qualityInfo
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
        
      } catch (error) {
        console.error(`Cleanup error for pre-processed ${mediaType}:`, error);
        // Don't throw - the media is still processed and usable
        return new Response(
          JSON.stringify({
            success: true,
            mediaId,
            processedPaths: processedPaths || { default: processedPath },
            thumbnailPath,
            cleanupError: error.message,
            qualityInfo
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      }
    }

    if (mediaType === 'video') {
      console.log('🎬 Video upload detected - using upload-only mode (no server processing)');
      
      // For videos, we now simply mark as processed without any server-side processing
      // This eliminates memory issues and ensures uploads always succeed
      const { error: updateError } = await supabase
        .from('simple_media')
        .update({ 
          processing_status: 'processed',
          processed_path: originalPath, // Keep original file
          processed_at: new Date().toISOString()
        })
        .eq('id', mediaId);

      if (updateError) {
        throw new Error(`Failed to update video record: ${updateError.message}`);
      }

      console.log('✅ Video upload completed successfully for:', mediaId);
      
      return new Response(
        JSON.stringify({
          success: true,
          mediaId,
          processedPath: originalPath,
          message: 'Video uploaded successfully in original format'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    } else if (mediaType === 'image') {
      // For images without client-side processing, just mark as processed
      // (This is the fallback case when client-side processing fails)
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
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
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