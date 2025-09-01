import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function logMemoryUsage(context: string) {
  const memUsage = Deno.memoryUsage();
  const rss = Math.round(memUsage.rss / 1024 / 1024);
  const heapUsed = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotal = Math.round(memUsage.heapTotal / 1024 / 1024);
  
  console.log(`🔍 [${context}] Memory: RSS=${rss}MB, Heap=${heapUsed}/${heapTotal}MB`);
  return { rss, heapUsed, heapTotal };
}

interface VideoProcessRequest {
  fileData?: number[];
  fileName: string;
  mediaId: string;
  mediaType: 'video';
  targetQualities: string[];
  // New streaming mode fields
  bucket?: string;
  path?: string;
  streamingMode?: boolean;
}

// Stream-based video processing to avoid memory issues
async function processVideoStreaming(
  inputData: Uint8Array, 
  fileName: string, 
  targetQualities: string[],
  mediaId: string
): Promise<{
  processedPaths: { [quality: string]: string };
  compressionInfo: { [quality: string]: { size: number; bitrate: string; compressionRatio: number } };
  totalCompressedSize: number;
}> {
  console.log(`🎬 Starting streaming video processing for ${fileName}`);
  logMemoryUsage('process-start');
  
  const results: { [quality: string]: string } = {};
  const compressionInfo: { [quality: string]: { size: number; bitrate: string; compressionRatio: number } } = {};
  let totalCompressedSize = 0;
  
  const baseName = fileName.split('.')[0];
  const originalSize = inputData.length;
  
  // Memory limit - keep it conservative
  const memoryThreshold = 100 * 1024 * 1024; // 100MB
  const currentMemory = logMemoryUsage('before-processing');
  
  if (currentMemory.rss > memoryThreshold) {
    throw new Error(`❌ Insufficient memory: ${currentMemory.rss}MB > ${Math.round(memoryThreshold/1024/1024)}MB threshold`);
  }

  // Write input file once
  const tempInputPath = `/tmp/input_${mediaId}.mp4`;
  console.log(`📁 Writing ${Math.round(originalSize/1024/1024)}MB input file to ${tempInputPath}`);
  await Deno.writeFile(tempInputPath, inputData);
  logMemoryUsage('after-input-write');

  // Process each quality sequentially to minimize memory usage
  for (const quality of targetQualities) {
    console.log(`🎯 Processing quality: ${quality}`);
    logMemoryUsage(`before-${quality}`);
    
    const outputPath = `/tmp/output_${mediaId}_${quality}.webm`;
    
    // Get processing parameters
    const params = getQualityParams(quality);
    if (!params) {
      console.warn(`⚠️ Skipping unknown quality: ${quality}`);
      continue;
    }

    try {
      // Use more memory-efficient FFmpeg settings
      const ffmpegArgs = [
        '-i', tempInputPath,
        
        // Video encoding - VP9 with constrained memory
        '-c:v', 'libvpx-vp9',
        '-crf', params.crf,
        '-b:v', params.bitrate,
        '-maxrate', params.bitrate,
        '-bufsize', params.bufsize,
        '-vf', params.scale,
        
        // Audio encoding - Opus
        '-c:a', 'libopus',
        '-b:a', '64k',
        
        // Memory optimization settings
        '-threads', '1', // Single thread to limit memory
        '-tile-columns', '0', // No tiling to save memory
        '-tile-rows', '0',
        '-frame-parallel', '0', // No parallelism
        '-row-mt', '0',
        '-deadline', 'realtime', // Fast encoding
        '-cpu-used', '5', // Very fast, less memory
        
        // Force memory cleanup
        '-movflags', '+faststart',
        '-y', outputPath
      ];

      console.log(`⚙️ Running FFmpeg for ${quality}:`, ffmpegArgs.slice(0, 10).join(' '), '...');
      
      const process = new Deno.Command("ffmpeg", {
        args: ffmpegArgs,
        stdout: "piped",
        stderr: "piped",
      }).spawn();

      const { success, stderr } = await process.output();
      
      if (!success) {
        const errorText = new TextDecoder().decode(stderr);
        console.error(`❌ FFmpeg failed for ${quality}:`, errorText.slice(0, 500));
        continue;
      }

      // Check if output file was created
      let outputStat;
      try {
        outputStat = await Deno.stat(outputPath);
      } catch {
        console.error(`❌ Output file not created for ${quality}`);
        continue;
      }

      const processedSize = outputStat.size;
      const compressionRatio = Math.round(((originalSize - processedSize) / originalSize) * 100);
      
      console.log(`✅ ${quality} processed: ${Math.round(processedSize/1024/1024)}MB (${compressionRatio}% compression)`);
      
      // Upload to storage in chunks to avoid memory issues
      const processedFileName = `processed/${mediaId}-${baseName}_${quality}.webm`;
      console.log(`⬆️ Uploading ${quality} to: ${processedFileName}`);
      
      // Read and upload in one operation (Deno handles this efficiently)
      const fileData = await Deno.readFile(outputPath);
      
      const { error: uploadError } = await sb.storage
        .from('content')
        .upload(processedFileName, fileData, { 
          upsert: false,
          contentType: 'video/webm'
        });

      if (uploadError) {
        console.error(`❌ Upload failed for ${quality}:`, uploadError);
        // Clean up failed output
        try { await Deno.remove(outputPath); } catch { }
        continue;
      }

      // Success - record results
      results[quality] = processedFileName;
      compressionInfo[quality] = {
        size: processedSize,
        bitrate: params.bitrate,
        compressionRatio
      };
      totalCompressedSize += processedSize;

      // Clean up output file immediately
      try {
        await Deno.remove(outputPath);
        console.log(`🧹 Cleaned up ${outputPath}`);
      } catch (error) {
        console.warn(`⚠️ Failed to cleanup ${outputPath}:`, error);
      }
      
      logMemoryUsage(`after-${quality}`);
      
    } catch (error) {
      console.error(`❌ Processing failed for ${quality}:`, error);
      // Clean up any partial files
      try { await Deno.remove(outputPath); } catch { }
      continue;
    }
  }

  // Clean up input file
  try {
    await Deno.remove(tempInputPath);
    console.log(`🧹 Cleaned up input file: ${tempInputPath}`);
  } catch (error) {
    console.warn(`⚠️ Failed to cleanup input file:`, error);
  }

  logMemoryUsage('process-complete');

  return {
    processedPaths: results,
    compressionInfo,
    totalCompressedSize
  };
}

function getQualityParams(quality: string) {
  switch (quality) {
    case '480p':
      return {
        scale: 'scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2',
        bitrate: '400k',
        bufsize: '800k',
        crf: '35'
      };
    case '720p':
      return {
        scale: 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
        bitrate: '800k',
        bufsize: '1600k',
        crf: '32'
      };
    case '1080p':
      return {
        scale: 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
        bitrate: '1500k',
        bufsize: '3000k',
        crf: '30'
      };
    default:
      return null;
  }
}

// Streaming-based video processing that downloads directly from storage
async function processVideoStreamingFromStorage(
  bucket: string,
  path: string,
  fileName: string, 
  targetQualities: string[],
  mediaId: string
): Promise<{
  processedPaths: { [quality: string]: string };
  compressionInfo: { [quality: string]: { size: number; bitrate: string; compressionRatio: number } };
  totalCompressedSize: number;
}> {
  console.log(`🌊 Starting streaming video processing from storage: ${bucket}/${path}`);
  logMemoryUsage('streaming-start');
  
  const results: { [quality: string]: string } = {};
  const compressionInfo: { [quality: string]: { size: number; bitrate: string; compressionRatio: number } } = {};
  let totalCompressedSize = 0;
  
  const baseName = fileName.split('.')[0];
  
  // Download file directly to temp location (more memory efficient than ArrayBuffer)
  const tempInputPath = `/tmp/input_${mediaId}.mp4`;
  console.log(`⬇️ Downloading ${path} directly to ${tempInputPath}`);
  
  const { data: fileData, error: downloadError } = await sb.storage
    .from(bucket)
    .download(path);
  
  if (downloadError) {
    throw new Error(`Failed to download video: ${downloadError.message}`);
  }
  
  // Write file as stream to avoid memory issues
  const fileArrayBuffer = await fileData.arrayBuffer();
  const originalSize = fileArrayBuffer.byteLength;
  
  // Memory check before proceeding
  const memoryThreshold = 150 * 1024 * 1024; // 150MB threshold
  const currentMemory = logMemoryUsage('before-file-write');
  
  if (currentMemory.rss > memoryThreshold) {
    throw new Error(`❌ Insufficient memory: ${currentMemory.rss}MB > ${Math.round(memoryThreshold/1024/1024)}MB threshold`);
  }
  
  await Deno.writeFile(tempInputPath, new Uint8Array(fileArrayBuffer));
  console.log(`📁 Written ${Math.round(originalSize/1024/1024)}MB input file`);
  logMemoryUsage('after-file-write');

  // Process each quality sequentially to minimize memory usage
  for (const quality of targetQualities) {
    console.log(`🎯 Processing quality: ${quality}`);
    logMemoryUsage(`before-${quality}`);
    
    const outputPath = `/tmp/output_${mediaId}_${quality}.webm`;
    
    // Get processing parameters
    const params = getQualityParams(quality);
    if (!params) {
      console.warn(`⚠️ Skipping unknown quality: ${quality}`);
      continue;
    }

    try {
      // Ultra-conservative FFmpeg settings for streaming
      const ffmpegArgs = [
        '-i', tempInputPath,
        
        // Video encoding - VP9 with maximum memory efficiency
        '-c:v', 'libvpx-vp9',
        '-crf', params.crf,
        '-b:v', params.bitrate,
        '-maxrate', params.bitrate,
        '-bufsize', params.bufsize,
        '-vf', params.scale,
        
        // Audio encoding - Opus
        '-c:a', 'libopus',
        '-b:a', '64k',
        
        // Extreme memory optimization
        '-threads', '1',           // Single thread
        '-tile-columns', '0',      // No tiling
        '-tile-rows', '0',
        '-frame-parallel', '0',    // No parallelism
        '-row-mt', '0',
        '-deadline', 'realtime',   // Fastest encoding
        '-cpu-used', '8',          // Maximum speed (least memory)
        '-static-thresh', '0',     // Disable static analysis
        '-max-intra-rate', '300',  // Limit complexity
        '-undershoot-pct', '25',   // Conservative bitrate
        '-overshoot-pct', '25',
        
        // Force cleanup and fast start
        '-movflags', '+faststart',
        '-f', 'webm',              // Force WebM container
        '-y', outputPath
      ];

      console.log(`⚙️ Running ultra-efficient FFmpeg for ${quality}`);
      
      const process = new Deno.Command("ffmpeg", {
        args: ffmpegArgs,
        stdout: "piped",
        stderr: "piped",
      }).spawn();

      const { success, stderr } = await process.output();
      
      if (!success) {
        const errorText = new TextDecoder().decode(stderr);
        console.error(`❌ FFmpeg failed for ${quality}:`, errorText.slice(0, 300));
        continue;
      }

      // Check if output file was created
      let outputStat;
      try {
        outputStat = await Deno.stat(outputPath);
      } catch {
        console.error(`❌ Output file not created for ${quality}`);
        continue;
      }

      const processedSize = outputStat.size;
      const compressionRatio = Math.round(((originalSize - processedSize) / originalSize) * 100);
      
      console.log(`✅ ${quality} processed: ${Math.round(processedSize/1024/1024)}MB (${compressionRatio}% compression)`);
      
      // Upload to storage immediately and cleanup
      const processedFileName = `processed/${mediaId}-${baseName}_${quality}.webm`;
      console.log(`⬆️ Uploading ${quality} to: ${processedFileName}`);
      
      const fileData = await Deno.readFile(outputPath);
      
      const { error: uploadError } = await sb.storage
        .from('content')
        .upload(processedFileName, fileData, { 
          upsert: false,
          contentType: 'video/webm'
        });

      // Immediate cleanup regardless of upload result
      try {
        await Deno.remove(outputPath);
        console.log(`🧹 Immediate cleanup: ${outputPath}`);
      } catch (cleanupError) {
        console.warn(`⚠️ Cleanup warning: ${cleanupError}`);
      }

      if (uploadError) {
        console.error(`❌ Upload failed for ${quality}:`, uploadError);
        continue;
      }

      // Success - record results
      results[quality] = processedFileName;
      compressionInfo[quality] = {
        size: processedSize,
        bitrate: params.bitrate,
        compressionRatio
      };
      totalCompressedSize += processedSize;
      
      logMemoryUsage(`after-${quality}`);
      
    } catch (error) {
      console.error(`❌ Processing failed for ${quality}:`, error);
      try { await Deno.remove(outputPath); } catch { }
      continue;
    }
  }

  // Final cleanup
  try {
    await Deno.remove(tempInputPath);
    console.log(`🧹 Final cleanup: ${tempInputPath}`);
  } catch (error) {
    console.warn(`⚠️ Final cleanup warning:`, error);
  }

  logMemoryUsage('streaming-complete');

  return {
    processedPaths: results,
    compressionInfo,
    totalCompressedSize
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🚀 Video processor v2 started');
  logMemoryUsage('request-start');

  try {
    const requestData: VideoProcessRequest = await req.json();
    const { 
      fileData, 
      fileName, 
      mediaId, 
      mediaType, 
      targetQualities = ['480p', '720p', '1080p'],
      bucket,
      path,
      streamingMode = false
    } = requestData;

    if (mediaType !== 'video') {
      return json({ error: 'This function only processes videos' }, 400);
    }

    console.log(`🎬 Processing video: ${fileName}`);
    console.log(`🎯 Target qualities: ${targetQualities.join(', ')}`);
    console.log(`🌊 Streaming mode: ${streamingMode ? 'ENABLED' : 'DISABLED'}`);

    let results;

    if (streamingMode && bucket && path) {
      // Use streaming processing (recommended for larger files)
      console.log(`🌊 Using streaming processing from ${bucket}/${path}`);
      results = await processVideoStreamingFromStorage(bucket, path, fileName, targetQualities, mediaId);
    } else if (fileData) {
      // Use traditional in-memory processing (for smaller files)
      console.log(`💾 Using in-memory processing (${Math.round(fileData.length/1024/1024)}MB)`);
      
      const uint8Array = new Uint8Array(fileData);
      
      // Check file size limits for in-memory processing
      const maxSize = 200 * 1024 * 1024; // Reduced limit for in-memory processing
      if (uint8Array.length > maxSize) {
        console.error(`❌ File too large for in-memory processing: ${Math.round(uint8Array.length/1024/1024)}MB > ${Math.round(maxSize/1024/1024)}MB`);
        return json({ 
          error: `File too large for in-memory processing: ${Math.round(uint8Array.length/1024/1024)}MB. Use streaming mode.`,
          success: false,
          suggestion: 'Use streamingMode: true with bucket and path parameters'
        }, 400);
      }

      results = await processVideoStreaming(uint8Array, fileName, targetQualities, mediaId);
    } else {
      return json({ 
        error: 'Invalid request: provide either fileData or bucket+path with streamingMode=true',
        success: false 
      }, 400);
    }

    if (Object.keys(results.processedPaths).length === 0) {
      console.error('❌ No qualities were successfully processed');
      return json({ error: 'Failed to process video in any quality' }, 500);
    }

    console.log(`✅ Video processing completed: ${Object.keys(results.processedPaths).length} qualities`);
    console.log(`📊 Total compressed size: ${Math.round(results.totalCompressedSize/1024/1024)}MB`);

    return json({
      success: true,
      processedPaths: results.processedPaths,
      compressionInfo: results.compressionInfo,
      totalCompressedSize: results.totalCompressedSize,
      availableQualities: Object.keys(results.processedPaths),
      processingMethod: streamingMode ? 'streaming' : 'in-memory'
    });

  } catch (error) {
    console.error('❌ Video processing error:', error);
    logMemoryUsage('error-state');
    
    return json({ 
      error: error.message,
      success: false 
    }, 500);
  }
});
