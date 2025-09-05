import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface ProcessingResult {
  quality: string;
  success: boolean;
  outputPath?: string;
  error?: string;
  compressionRatio?: number;
  sizeMB?: number;
  width?: number;
  height?: number;
}

interface QualityConfig {
  width: number;
  height: number;
  bitrate: string;
  crf: number;
}

function getQualityConfig(quality: string, inputWidth: number, inputHeight: number): QualityConfig {
  const aspectRatio = inputWidth / inputHeight;
  
  switch (quality) {
    case '240p': {
      const height = 240;
      const width = Math.round(height * aspectRatio / 2) * 2; // Ensure even width
      return { width, height, bitrate: '300k', crf: 40 };
    }
    case '360p': {
      const height = 360;
      const width = Math.round(height * aspectRatio / 2) * 2;
      return { width, height, bitrate: '500k', crf: 38 };
    }
    case '480p': {
      const height = 480;
      const width = Math.round(height * aspectRatio / 2) * 2;
      return { width, height, bitrate: '800k', crf: 35 };
    }
    case '720p': {
      const height = 720;
      const width = Math.round(height * aspectRatio / 2) * 2;
      return { width, height, bitrate: '1500k', crf: 32 };
    }
    case '1080p': {
      const height = 1080;
      const width = Math.round(height * aspectRatio / 2) * 2;
      return { width, height, bitrate: '3000k', crf: 30 };
    }
    case '1440p':
    case '2k': {
      const height = 1440;
      const width = Math.round(height * aspectRatio / 2) * 2;
      return { width, height, bitrate: '6000k', crf: 28 };
    }
    case '2160p':
    case '4k': {
      const height = 2160;
      const width = Math.round(height * aspectRatio / 2) * 2;
      return { width, height, bitrate: '12000k', crf: 26 };
    }
    case 'original':
    default: {
      return { width: inputWidth, height: inputHeight, bitrate: '4000k', crf: 28 };
    }
  }
}

const processVideoStreaming = async (bucket: string, path: string, targetQualities: string[], mediaId: string) => {
  console.log(`🌊 Starting streaming video processing from storage: ${bucket}/${path}`);
  
  // Memory monitoring
  const memoryCheck = () => {
    const usage = Deno.memoryUsage();
    const rss = Math.round(usage.rss / 1024 / 1024);
    const heap = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotal = Math.round(usage.heapTotal / 1024 / 1024);
    return { rss, heap, heapTotal, formatted: `RSS=${rss}MB, Heap=${heap}/${heapTotal}MB` };
  };

  let memory = memoryCheck();
  console.log(`🔍 [streaming-start] Memory: ${memory.formatted}`);

  // Check file size first to prevent memory issues
  try {
    const { data: fileList } = await supabase.storage.from(bucket).list(
      path.split('/').slice(0, -1).join('/'), 
      { search: path.split('/').pop() }
    );
    
    const fileInfo = fileList?.[0];
    const fileSizeMB = fileInfo?.metadata?.size ? fileInfo.metadata.size / (1024 * 1024) : 0;
    
    console.log(`📊 File size: ${fileSizeMB.toFixed(1)}MB`);
    
    // Strict size limit for Edge Functions (they have ~512MB total memory)
    if (fileSizeMB > 50) {
      throw new Error(`File too large for processing: ${fileSizeMB.toFixed(1)}MB > 50MB limit. Edge Functions have limited memory.`);
    }
  } catch (sizeError) {
    console.error('Size check failed:', sizeError);
    throw sizeError;
  }

  // Download file with streaming to minimize memory usage
  const inputPath = `/tmp/input_${crypto.randomUUID()}.${path.split('.').pop()}`;
  console.log(`⬇️ Downloading ${path} to ${inputPath}`);
  
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    throw new Error(`Failed to download video: ${error?.message || 'No data'}`);
  }

  // Stream file to disk to avoid keeping it in memory
  const file = await Deno.open(inputPath, { create: true, write: true });
  const reader = data.stream().getReader();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await file.write(value);
    }
  } finally {
    file.close();
    reader.releaseLock();
  }

  memory = memoryCheck();
  console.log(`📁 [download-complete] Memory: ${memory.formatted}`);

  try {
    // Get video metadata with conservative probe
    const probe = new Deno.Command("ffprobe", {
      args: [
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height:format=duration",
        "-of", "csv=p=0",
        inputPath
      ],
      stdout: "piped",
      stderr: "piped"
    });

    const probeOutput = await probe.output();
    if (!probeOutput.success) {
      throw new Error("Failed to probe video metadata");
    }

    const probeResult = new TextDecoder().decode(probeOutput.stdout).trim().split(',');
    const inputWidth = parseInt(probeResult[0]);
    const inputHeight = parseInt(probeResult[1]);
    const duration = parseFloat(probeResult[2] || '0');

    console.log(`📹 Input: ${inputWidth}x${inputHeight}, Duration: ${duration}s`);
    
    // Filter qualities based on input resolution
    const validQualities = targetQualities.filter(quality => {
      if (quality === 'original') return true;
      const height = parseInt(quality.replace('p', ''));
      return height <= inputHeight;
    });

    console.log(`🎯 Valid qualities: ${validQualities.join(', ')}`);
    
    memory = memoryCheck();
    console.log(`🔍 [metadata-complete] Memory: ${memory.formatted}`);

    // Process each quality sequentially with aggressive memory management
    const results: ProcessingResult[] = [];
    
    for (const quality of validQualities) {
      try {
        memory = memoryCheck();
        console.log(`🎯 [${quality}] Starting processing, Memory: ${memory.formatted}`);
        
        const result = await processQualityWithMemoryLimit(inputPath, quality, inputWidth, inputHeight, duration, mediaId);
        results.push(result);
        
        memory = memoryCheck();
        console.log(`✅ [${quality}] Complete, Memory: ${memory.formatted}`);
        
        // Force garbage collection between qualities if available
        if (globalThis.gc) {
          globalThis.gc();
        }
        
      } catch (error) {
        console.error(`❌ [${quality}] Failed:`, error);
        results.push({
          quality,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
    
  } finally {
    // Always cleanup temp files
    try {
      await Deno.remove(inputPath);
    } catch (e) {
      console.warn('Failed to cleanup input file:', e);
    }
  }
};

const processQualityWithMemoryLimit = async (
  inputPath: string,
  quality: string,
  inputWidth: number,
  inputHeight: number,
  duration: number,
  mediaId: string
): Promise<ProcessingResult> => {
  const outputPath = `/tmp/output_${mediaId}_${quality}.mp4`;
  
  try {
    const configs = getQualityConfig(quality, inputWidth, inputHeight);
    
    console.log(`🎯 [${quality}] Target: ${configs.width}x${configs.height}, Bitrate: ${configs.bitrate}, CRF: ${configs.crf}`);

    // Ultra-conservative FFmpeg settings for memory efficiency
    const ffmpegArgs = [
      "-i", inputPath,
      "-c:v", "libx264",
      "-preset", "ultrafast",  // Fastest preset uses least memory
      "-crf", configs.crf.toString(),
      "-maxrate", configs.bitrate,
      "-bufsize", (parseInt(configs.bitrate) * 1.5) + 'k',
      "-vf", `scale=${configs.width}:${configs.height}:flags=fast_bilinear`,
      "-c:a", "aac",
      "-b:a", "96k", // Lower audio bitrate
      "-ac", "2", // Stereo only
      "-threads", "1", // Single thread to minimize memory
      "-movflags", "+faststart",
      "-avoid_negative_ts", "make_zero",
      "-f", "mp4",
      "-y",
      outputPath
    ];

    console.log(`🔄 [${quality}] Starting FFmpeg...`);

    const ffmpeg = new Deno.Command("ffmpeg", {
      args: ffmpegArgs,
      stdout: "piped",
      stderr: "piped"
    });

    const ffmpegProcess = await ffmpeg.output();
    
    if (!ffmpegProcess.success) {
      const stderr = new TextDecoder().decode(ffmpegProcess.stderr);
      throw new Error(`FFmpeg failed: ${stderr.slice(0, 500)}`);
    }

    // Get output file stats
    const outputStats = await Deno.stat(outputPath);
    const inputStats = await Deno.stat(inputPath);
    const compressionRatio = Math.round((1 - outputStats.size / inputStats.size) * 100);
    const sizeMB = Math.round(outputStats.size / 1024 / 1024 * 100) / 100;

    console.log(`✅ [${quality}] Size: ${sizeMB}MB, Compression: ${compressionRatio}%`);

    // Upload to storage with immediate cleanup
    const fileName = `${mediaId}_${quality}.mp4`;
    const storagePath = `processed/${mediaId}/${fileName}`;
    
    const fileData = await Deno.readFile(outputPath);
    const { error: uploadError } = await supabase.storage
      .from('content')
      .upload(storagePath, fileData, {
        contentType: 'video/mp4',
        upsert: true
      });

    // Cleanup output file immediately after upload attempt
    try {
      await Deno.remove(outputPath);
    } catch (e) {
      console.warn(`Failed to cleanup ${outputPath}:`, e);
    }

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    return {
      quality,
      success: true,
      outputPath: storagePath,
      compressionRatio,
      sizeMB,
      width: configs.width,
      height: configs.height
    };

  } catch (error) {
    // Cleanup on error
    try {
      await Deno.remove(outputPath);
    } catch (e) {
      // Ignore cleanup errors
    }
    
    throw error;
  }
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🚀 Video processor v2 started');
  
  try {
    const { bucket, path, fileName, targetQualities = ['240p', '360p', '480p', '720p', '1080p'], mediaId } = await req.json();
    
    console.log(`🎬 Processing video: ${fileName}`);
    console.log(`🎯 Target qualities: ${targetQualities.join(', ')}`);

    if (!bucket || !path || !mediaId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required parameters: bucket, path, mediaId'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Process video with streaming approach
    const results = await processVideoStreaming(bucket, path, targetQualities, mediaId);
    
    // Build quality info for database update
    const qualityInfo = results.reduce((acc, result) => {
      if (result.success) {
        acc[result.quality] = {
          path: result.outputPath,
          size_mb: result.sizeMB,
          compression_ratio: result.compressionRatio,
          width: result.width,
          height: result.height
        };
      }
      return acc;
    }, {} as any);

    // Update media record with results
    const { error: updateError } = await supabase
      .from('simple_media')
      .update({ 
        quality_info: qualityInfo,
        processing_status: Object.keys(qualityInfo).length > 0 ? 'completed' : 'failed',
        processing_error: Object.keys(qualityInfo).length === 0 ? 'No qualities processed successfully' : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', mediaId);

    if (updateError) {
      console.error('Failed to update media record:', updateError);
    }

    return new Response(JSON.stringify({
      success: Object.keys(qualityInfo).length > 0,
      results,
      qualityInfo,
      processedQualities: Object.keys(qualityInfo),
      message: `Processed ${Object.keys(qualityInfo).length} out of ${targetQualities.length} qualities`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Video processor error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown processing error',
      details: 'Check edge function logs for more information'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
