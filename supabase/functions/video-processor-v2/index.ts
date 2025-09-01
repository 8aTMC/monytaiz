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
  inputData?: number[];
  fileName: string;
  mediaId: string;
  targetQualities: string[];
  bucket?: string;
  path?: string;
  streamingMode?: boolean;
}

// Helper functions for smart quality determination and file handling
async function determineSmartQualities(inputPath: string, requestedQualities: string[]): Promise<string[]> {
  try {
    // Get video info using ffprobe
    const probeCommand = new Deno.Command('ffprobe', {
      args: [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_streams',
        inputPath
      ],
      stdout: 'piped',
      stderr: 'piped'
    });
    
    const { stdout } = await probeCommand.output();
    const probeResult = JSON.parse(new TextDecoder().decode(stdout));
    
    const videoStream = probeResult.streams?.find((s: any) => s.codec_type === 'video');
    if (!videoStream) {
      console.warn('No video stream found, using requested qualities');
      return requestedQualities;
    }
    
    const inputHeight = videoStream.height;
    console.log(`Input video resolution: ${videoStream.width}x${inputHeight}`);
    
    // Determine appropriate qualities based on input resolution
    const smartQualities: string[] = [];
    
    // Always include original if requested
    if (requestedQualities.includes('original')) {
      smartQualities.push('original');
    }
    
    // Add appropriate scaled versions
    if (inputHeight >= 2160 && requestedQualities.includes('2160p')) smartQualities.push('2160p');
    if (inputHeight >= 1080 && requestedQualities.includes('1080p')) smartQualities.push('1080p');
    if (inputHeight >= 720 && requestedQualities.includes('720p')) smartQualities.push('720p');
    if (inputHeight >= 480 && requestedQualities.includes('480p')) smartQualities.push('480p');
    
    // If no smart qualities found, fallback to requested
    return smartQualities.length > 0 ? smartQualities : requestedQualities;
    
  } catch (error) {
    console.warn('Failed to determine smart qualities:', error);
    return requestedQualities;
  }
}

function getOriginalExtension(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  return extension || 'mp4';
}

function getMimeTypeFromExtension(extension: string): string {
  const mimeTypes: Record<string, string> = {
    'mp4': 'video/mp4',
    'mov': 'video/quicktime', 
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    'webm': 'video/webm',
    'm4v': 'video/x-m4v'
  };
  return mimeTypes[extension] || 'video/mp4';
}

function getQualityParams(quality: string): string[] {
  switch (quality) {
    case '480p':
      return [
        '-vf', 'scale=-2:480',
        '-b:v', '800k',
        '-bufsize', '1600k',
        '-crf', '35'
      ];
    case '720p':
      return [
        '-vf', 'scale=-2:720', 
        '-b:v', '1500k',
        '-bufsize', '3000k',
        '-crf', '32'
      ];
    case '1080p':
      return [
        '-vf', 'scale=-2:1080',
        '-b:v', '3000k', 
        '-bufsize', '6000k',
        '-crf', '30'
      ];
    case '2160p':
    case '4k':
      return [
        '-vf', 'scale=-2:2160',
        '-b:v', '8000k',
        '-bufsize', '16000k',
        '-crf', '28'
      ];
    case 'original':
      return [
        '-b:v', '0',  // Use CRF only for original quality
        '-crf', '28'
      ];
    default:
      return [
        '-vf', 'scale=-2:480',
        '-b:v', '800k',
        '-bufsize', '1600k', 
        '-crf', '35'
      ];
  }
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
  
  const originalSize = inputData.length;
  
  // Write input file once
  const tempInputPath = `/tmp/input_${mediaId}.${getOriginalExtension(fileName)}`;
  console.log(`📁 Writing ${Math.round(originalSize/1024/1024)}MB input file to ${tempInputPath}`);
  await Deno.writeFile(tempInputPath, inputData);
  logMemoryUsage('after-input-write');

  try {
    // Determine target qualities based on input resolution
    const smartQualities = await determineSmartQualities(tempInputPath, targetQualities);
    console.log(`Smart qualities determined: ${smartQualities.join(', ')}`);
    
    // Iterate through smart target qualities
    for (const quality of smartQualities) {
      console.log(`Processing quality: ${quality}`);
      logMemoryUsage(`Before ${quality} processing`);
      
      const qualityParams = getQualityParams(quality);
      const outputExtension = quality === 'original' ? getOriginalExtension(fileName) : 'mp4';
      const outputFileName = quality === 'original' ? 
        `${mediaId}_original.${outputExtension}` : 
        `${mediaId}_${quality}.mp4`;
      const outputPath = `/tmp/${outputFileName}`;
      
      const baseCommand = ['-i', tempInputPath];
      const codecCommand = quality === 'original' ? 
        ['-c:v', 'libx264', '-c:a', 'aac'] : 
        ['-c:v', 'libx264', '-c:a', 'aac'];
      
      const ffmpegCommand = [
        ...baseCommand,
        ...codecCommand,
        ...qualityParams,
        '-movflags', '+faststart',
        '-preset', 'medium',
        '-y',
        outputPath
      ];

      console.log(`⚙️ Running FFmpeg for ${quality}:`, ffmpegCommand.slice(0, 10).join(' '), '...');
      
      const process = new Deno.Command("ffmpeg", {
        args: ffmpegCommand,
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
      
      // Upload to storage
      const processedFileName = `processed/${mediaId}/${outputFileName}`;
      console.log(`⬆️ Uploading ${quality} to: ${processedFileName}`);
      
      const fileData = await Deno.readFile(outputPath);
      const contentType = quality === 'original' ? 
        getMimeTypeFromExtension(outputExtension) : 
        'video/mp4';
      
      const { error: uploadError } = await sb.storage
        .from('content')
        .upload(processedFileName, fileData, { 
          upsert: true,
          contentType
        });

      if (uploadError) {
        console.error(`❌ Upload failed for ${quality}:`, uploadError);
        try { await Deno.remove(outputPath); } catch { }
        continue;
      }

      // Success - record results
      results[quality] = processedFileName;
      compressionInfo[quality] = {
        size: processedSize,
        bitrate: qualityParams.includes('-b:v') ? qualityParams[qualityParams.indexOf('-b:v') + 1] : 'variable',
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
    }

  } catch (error) {
    console.error('❌ Video processing failed:', error);
    throw new Error(`Video processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // Clean up input file
    try {
      await Deno.remove(tempInputPath);
      console.log(`🧹 Cleaned up input file: ${tempInputPath}`);
    } catch (error) {
      console.warn(`⚠️ Failed to cleanup input file:`, error);
    }
  }

  logMemoryUsage('process-complete');

  return {
    processedPaths: results,
    compressionInfo,
    totalCompressedSize
  };
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
  
  // Download file directly to temp location
  const tempInputPath = `/tmp/input_${mediaId}.${getOriginalExtension(fileName)}`;
  console.log(`⬇️ Downloading ${path} directly to ${tempInputPath}`);
  
  const { data: fileData, error: downloadError } = await sb.storage
    .from(bucket)
    .download(path);
  
  if (downloadError) {
    throw new Error(`Failed to download video: ${downloadError.message}`);
  }
  
  const fileArrayBuffer = await fileData.arrayBuffer();
  const originalSize = fileArrayBuffer.byteLength;
  
  await Deno.writeFile(tempInputPath, new Uint8Array(fileArrayBuffer));
  console.log(`📁 Written ${Math.round(originalSize/1024/1024)}MB input file`);
  logMemoryUsage('after-file-write');

  try {
    // Determine target qualities based on input resolution
    const smartQualities = await determineSmartQualities(tempInputPath, targetQualities);
    console.log(`Smart qualities determined: ${smartQualities.join(', ')}`);
    
    // Iterate through smart target qualities
    for (const quality of smartQualities) {
      console.log(`Processing quality: ${quality} (streaming mode)`);
      logMemoryUsage(`Before ${quality} processing (streaming)`);
      
      const qualityParams = getQualityParams(quality);
      const outputExtension = quality === 'original' ? getOriginalExtension(fileName) : 'mp4';
      const outputFileName = quality === 'original' ? 
        `${mediaId}_original.${outputExtension}` : 
        `${mediaId}_${quality}.mp4`;
      const outputPath = `/tmp/${outputFileName}`;
      
      const baseCommand = ['-i', tempInputPath];
      const codecCommand = quality === 'original' ? 
        ['-c:v', 'libx264', '-c:a', 'aac'] : 
        ['-c:v', 'libx264', '-c:a', 'aac'];
      
      const ffmpegCommand = [
        ...baseCommand,
        ...codecCommand,
        ...qualityParams,
        '-movflags', '+faststart',
        '-preset', 'medium',
        '-threads', '2',
        '-y',
        outputPath
      ];

      console.log(`⚙️ Running ultra-efficient FFmpeg for ${quality}`);
      
      const process = new Deno.Command("ffmpeg", {
        args: ffmpegCommand,
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
      
      const processedFileName = `processed/${mediaId}/${outputFileName}`;
      console.log(`⬆️ Uploading ${quality} to: ${processedFileName}`);
      
      const fileDataBuffer = await Deno.readFile(outputPath);
      const contentType = quality === 'original' ? 
        getMimeTypeFromExtension(outputExtension) : 
        'video/mp4';

      const { error: uploadError } = await sb.storage
        .from('content')
        .upload(processedFileName, fileDataBuffer, { 
          upsert: true,
          contentType
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
        bitrate: qualityParams.includes('-b:v') ? qualityParams[qualityParams.indexOf('-b:v') + 1] : 'variable',
        compressionRatio
      };
      totalCompressedSize += processedSize;
      
      logMemoryUsage(`after-${quality}`);
    }

  } catch (error) {
    console.error('❌ Video processing failed:', error);
    throw new Error(`Video processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // Final cleanup
    try {
      await Deno.remove(tempInputPath);
      console.log(`🧹 Final cleanup: ${tempInputPath}`);
    } catch (error) {
      console.warn(`⚠️ Final cleanup warning:`, error);
    }
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
    // Parse request body
    const { 
      inputData, 
      fileName, 
      targetQualities = ['original', '1080p', '720p', '480p'], 
      mediaId,
      streamingMode = false,
      bucket,
      path 
    } = await req.json() as VideoProcessRequest;

    console.log(`🎬 Processing video: ${fileName}`);
    console.log(`🎯 Target qualities: ${targetQualities.join(', ')}`);
    console.log(`🌊 Streaming mode: ${streamingMode ? 'ENABLED' : 'DISABLED'}`);

    let results;

    if (streamingMode && bucket && path) {
      // Use streaming processing (recommended for larger files)
      console.log(`🌊 Using streaming processing from ${bucket}/${path}`);
      results = await processVideoStreamingFromStorage(bucket, path, fileName, targetQualities, mediaId);
    } else if (inputData) {
      // Use traditional in-memory processing (for smaller files)
      console.log(`💾 Using in-memory processing (${Math.round(inputData.length/1024/1024)}MB)`);
      
      const uint8Array = new Uint8Array(inputData);
      
      // Check file size limits for in-memory processing
      const maxSize = 200 * 1024 * 1024; // 200MB limit for in-memory processing
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
        error: 'Invalid request: provide either inputData or bucket+path with streamingMode=true',
        success: false 
      }, 400);
    }

    if (Object.keys(results.processedPaths).length === 0) {
      console.error('❌ No qualities were successfully processed');
      return json({ error: 'Failed to process video in any quality' }, 500);
    }

    console.log(`✅ Video processing completed: ${Object.keys(results.processedPaths).length} qualities`);
    logMemoryUsage('request-complete');

    return json({
      success: true,
      processedPaths: results.processedPaths,
      compressionInfo: results.compressionInfo,
      totalCompressedSize: results.totalCompressedSize,
      message: `Successfully processed ${Object.keys(results.processedPaths).length} qualities`
    });

  } catch (error) {
    console.error('❌ Video processor error:', error);
    logMemoryUsage('error-state');
    
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown processing error',
      details: 'Check edge function logs for more information'
    }, 500);
  }
});