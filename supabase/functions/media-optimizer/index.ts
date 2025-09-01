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
      console.log('🎬 Processing video file - converting to WebM with multiple qualities');
      
      try {
        // Get file info first to check size before downloading
        const { data: listData, error: listError } = await supabase.storage
          .from('content')
          .list(originalPath.split('/').slice(0, -1).join('/'), {
            search: originalPath.split('/').pop()
          });
        
        if (listError || !listData?.length) {
          throw new Error(`Video file not found: ${originalPath}`);
        }
        
        const fileInfo = listData[0];
        const fileSizeMB = Math.round((fileInfo.metadata?.size || 0) / 1024 / 1024);
        
        console.log(`📊 Video file size: ${fileSizeMB}MB`);
        
        // Check if file is too large for edge function processing
        const maxSizeMB = 400; // Conservative limit for edge functions
        if (fileSizeMB > maxSizeMB) {
          console.log(`⚠️ File too large for edge function (${fileSizeMB}MB > ${maxSizeMB}MB), using fallback approach`);
          
          // For very large files, just mark as processed without conversion
          // TODO: Implement chunked/streaming processing or external service
          const { error: updateError } = await supabase
            .from('simple_media')
            .update({ 
              processing_status: 'processed',
              processed_path: originalPath, // Keep original for now
              processed_at: new Date().toISOString(),
              processing_error: `File too large for conversion (${fileSizeMB}MB). Stored as original format.`
            })
            .eq('id', mediaId);

          if (updateError) {
            throw new Error(`Failed to update large video record: ${updateError.message}`);
          }

          return new Response(
            JSON.stringify({
              success: true,
              mediaId,
              processedPath: originalPath,
              warning: `File too large for optimization (${fileSizeMB}MB). Stored in original format.`
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200 
            }
          );
        }
        
        console.log('⬇️ Downloading video file for processing...');
        // Get the original video file for processing
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('content')
          .download(originalPath);
        
        if (downloadError) {
          throw new Error(`Failed to download video for processing: ${downloadError.message}`);
        }

        console.log('📦 Converting to array buffer...');
        // Convert file to ArrayBuffer for FFmpeg processing
        const arrayBuffer = await fileData.arrayBuffer();
        const fileSizeActual = Math.round(arrayBuffer.byteLength / 1024 / 1024);
        console.log(`✅ File loaded: ${fileSizeActual}MB`);
        
        // Try the new streaming video processor first, fallback to original
        console.log('🎬 Calling video-processor-v2 for streaming processing...');
        let processData, processError;
        
        try {
          const response = await supabase.functions.invoke('video-processor-v2', {
            body: { 
              fileData: Array.from(new Uint8Array(arrayBuffer)),
              fileName: originalPath.split('/').pop(),
              mediaId: mediaId,
              mediaType: 'video',
              targetQualities: ['480p', '720p', '1080p']
            },
            headers: { 'Content-Type': 'application/json' },
          });
          
          processData = response.data;
          processError = response.error;
          
        } catch (v2Error) {
          console.warn('⚠️ Video-processor-v2 failed, falling back to original processor:', v2Error);
          
          // Fallback to original processor
          const fallbackResponse = await supabase.functions.invoke('video-processor', {
            body: { 
              fileData: Array.from(new Uint8Array(arrayBuffer)),
              fileName: originalPath.split('/').pop(),
              mediaId: mediaId,
              mediaType: 'video',
              targetQualities: ['480p'] // Only process one quality for fallback
            },
            headers: { 'Content-Type': 'application/json' },
          });
          
          processData = fallbackResponse.data;
          processError = fallbackResponse.error;
        }

        if (processError) {
          console.error('❌ Video processing failed:', processError);
          throw new Error(`Video processing failed: ${processError.message}`);
        }

        // Call video-thumbnail function for thumbnail generation
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
          // Don't throw - we can continue without thumbnail
        }

        // Clean up original file (never keep originals for videos)
        const { error: deleteError } = await supabase.storage
          .from('content')
          .remove([originalPath]);
        
        if (deleteError) {
          console.error('Failed to delete original video file:', deleteError);
          // Don't throw - the processed files are still valid
        }

        // Use the best quality as the main processed path (1080p if available, otherwise 720p, otherwise 480p)
        const mainProcessedPath = processData?.processedPaths?.['1080p'] || 
                                 processData?.processedPaths?.['720p'] || 
                                 processData?.processedPaths?.['480p'] || 
                                 originalPath;

        // Update simple_media with success status and paths
        const { error: updateError } = await supabase
          .from('simple_media')
          .update({ 
            processing_status: 'processed',
            processed_path: mainProcessedPath,
            thumbnail_path: thumbnailData?.thumbnailPath,
            processed_at: new Date().toISOString(),
            mime_type: 'video/webm', // Updated to WebM after processing
            optimized_size_bytes: processData?.totalCompressedSize || null
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
            processedPath: mainProcessedPath,
            processedPaths: processData?.processedPaths,
            thumbnailPath: thumbnailData?.thumbnailPath,
            thumbnail: thumbnailData?.thumbnail,
            compressionInfo: processData?.compressionInfo
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