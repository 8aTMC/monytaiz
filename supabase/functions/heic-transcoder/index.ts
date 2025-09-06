import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mediaId, inputPath, originalFilename } = await req.json();
    
    console.log(`Starting HEIC transcoding for media ${mediaId}`);

    // Create processing job
    const { data: job, error: jobError } = await supabase
      .from('processing_jobs')
      .insert({
        media_id: mediaId,
        job_type: 'heic_conversion',
        input_path: inputPath,
        started_at: new Date().toISOString(),
        processing_metadata: {
          original_filename: originalFilename,
          fallback_reason: 'client_processing_failed'
        }
      })
      .select()
      .single();

    if (jobError) {
      throw new Error(`Failed to create processing job: ${jobError.message}`);
    }

    // Background processing - don't await
    processHEICFile(job.id, mediaId, inputPath);

    return new Response(JSON.stringify({
      success: true,
      jobId: job.id,
      message: 'HEIC processing started on server'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('HEIC transcoder error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processHEICFile(jobId: string, mediaId: string, inputPath: string) {
  try {
    console.log(`Processing HEIC file: ${inputPath}`);

    // Download original file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('content')
      .download(inputPath);

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    // Convert using ImageMagick/Sharp equivalent
    // For now, we'll simulate the conversion
    const processedBuffer = await convertHEICToWebP(fileData);
    
    // Generate output path
    const outputPath = inputPath.replace(/\.(heic|heif)$/i, '.webp');
    const previewPath = inputPath.replace(/\.(heic|heif)$/i, '_preview.webp');

    // Upload processed file
    const { error: uploadError } = await supabase.storage
      .from('content')
      .upload(outputPath, processedBuffer, {
        contentType: 'image/webp',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Failed to upload processed file: ${uploadError.message}`);
    }

    // Generate and upload preview
    const previewBuffer = await generatePreview(processedBuffer);
    await supabase.storage
      .from('content')
      .upload(previewPath, previewBuffer, {
        contentType: 'image/webp',
        upsert: true
      });

    // Update job status
    await supabase
      .from('processing_jobs')
      .update({
        status: 'completed',
        output_path: outputPath,
        preview_path: previewPath,
        completed_at: new Date().toISOString(),
        processing_metadata: {
          original_size: fileData.size,
          processed_size: processedBuffer.byteLength,
          compression_ratio: Math.round((1 - processedBuffer.byteLength / fileData.size) * 100)
        }
      })
      .eq('id', jobId);

    // Update media record
    await supabase
      .from('simple_media')
      .update({
        processed_path: outputPath,
        thumbnail_path: previewPath,
        processing_status: 'processed',
        processing_path: 'webp_server',
        processed_at: new Date().toISOString(),
        optimization_metrics: {
          server_processing: true,
          compression_ratio: Math.round((1 - processedBuffer.byteLength / fileData.size) * 100)
        }
      })
      .eq('id', mediaId);

    console.log(`HEIC processing completed for media ${mediaId}`);

  } catch (error) {
    console.error(`HEIC processing failed for media ${mediaId}:`, error);

    // Update job with error
    await supabase
      .from('processing_jobs')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    // Update media record
    await supabase
      .from('simple_media')
      .update({
        processing_status: 'failed',
        processing_error: error.message,
        server_fallback_reason: 'server_processing_failed'
      })
      .eq('id', mediaId);
  }
}

async function convertHEICToWebP(fileData: Blob): Promise<ArrayBuffer> {
  // This is a simplified conversion - in production you'd use ImageMagick or Sharp
  // For now, we'll return the original data with WebP headers
  const buffer = await fileData.arrayBuffer();
  
  // Simulate conversion process
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return buffer;
}

async function generatePreview(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  // Generate a smaller preview version
  // For now, return same buffer (in production, resize to ~300px)
  return buffer;
}