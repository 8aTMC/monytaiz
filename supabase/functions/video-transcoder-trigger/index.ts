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

  console.log('🎬 Video transcoder trigger started');
  
  try {
    const { mediaId, bucket, path, originalFilename } = await req.json();
    
    console.log(`🎯 Triggering transcoder for: ${originalFilename} (${mediaId})`);

    if (!mediaId || !bucket || !path) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required parameters'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update media status to processing
    await supabase
      .from('simple_media')
      .update({ 
        processing_status: 'processing',
        processing_error: null 
      })
      .eq('id', mediaId);

    // Check if transcoder service is available (would be configured via environment)
    const transcoderUrl = Deno.env.get('TRANSCODER_SERVICE_URL');
    
    if (transcoderUrl) {
      console.log(`🚀 Sending to external transcoder: ${transcoderUrl}`);
      
      // Send to external transcoder service
      const transcoderResponse = await fetch(`${transcoderUrl}/jobs/transcode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bucket,
          path,
          mediaId,
          originalFilename
        })
      });

      if (!transcoderResponse.ok) {
        throw new Error(`Transcoder service error: ${transcoderResponse.statusText}`);
      }

      const result = await transcoderResponse.json();
      console.log('✅ Transcoder job submitted:', result);

      return new Response(JSON.stringify({
        success: true,
        message: 'Video sent to transcoder service for processing',
        transcoderJobId: result.jobId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      // Fallback to edge function processing for smaller files
      console.log('📦 No external transcoder configured, using edge function');
      
      const { data, error } = await supabase.functions.invoke('video-processor-v2', {
        body: {
          bucket,
          path,
          fileName: originalFilename,
          targetQualities: ['original', '1080p', '720p', '480p'],
          mediaId
        }
      });

      if (error) {
        throw error;
      }

      console.log('✅ Edge function processing completed:', data);

      return new Response(JSON.stringify({
        success: true,
        message: 'Video processed via edge function',
        results: data
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('❌ Transcoder trigger error:', error);
    
    // Update media status to failed
    const { mediaId } = await req.json().catch(() => ({}));
    if (mediaId) {
      await supabase
        .from('simple_media')
        .update({ 
          processing_status: 'failed',
          processing_error: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', mediaId);
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown transcoder error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});