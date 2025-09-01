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

interface VideoProcessRequest {
  fileData: number[];
  fileName: string;
  mediaId: string;
  mediaType: 'video';
  targetQualities: string[];
}

async function processVideoWithFFmpeg(
  inputPath: string, 
  fileName: string, 
  targetQualities: string[]
): Promise<{
  processedPaths: { [quality: string]: string };
  compressionInfo: { [quality: string]: { size: number; bitrate: string; compressionRatio: number } };
  totalCompressedSize: number;
}> {
  const results: { [quality: string]: string } = {};
  const compressionInfo: { [quality: string]: { size: number; bitrate: string; compressionRatio: number } } = {};
  let totalCompressedSize = 0;
  
  const baseName = fileName.split('.')[0];
  const mediaId = crypto.randomUUID();
  
  // Get original file size for compression ratio calculation
  const originalStat = await Deno.stat(inputPath);
  const originalSize = originalStat.size;

  for (const quality of targetQualities) {
    console.log(`Processing video quality: ${quality}`);
    
    const outputPath = `/tmp/output_${mediaId}_${quality}.webm`;
    
    let scale: string;
    let bitrate: string;
    let crf: string;
    
    switch (quality) {
      case '480p':
        scale = 'scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2';
        bitrate = '500k';
        crf = '32';
        break;
      case '720p':
        scale = 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2';
        bitrate = '1000k';
        crf = '30';
        break;
      case '1080p':
        scale = 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2';
        bitrate = '2000k';
        crf = '28';
        break;
      default:
        continue;
    }

    const ffmpegCommand = new Deno.Command("ffmpeg", {
      args: [
        '-i', inputPath,
        '-c:v', 'libvpx-vp9',
        '-crf', crf,
        '-b:v', bitrate,
        '-vf', scale,
        '-c:a', 'libopus',
        '-b:a', '64k',
        '-deadline', 'good',
        '-cpu-used', '1',
        '-row-mt', '1',
        '-y',
        outputPath
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const process = ffmpegCommand.spawn();
    const { success, stderr } = await process.output();

    if (!success) {
      const errorText = new TextDecoder().decode(stderr);
      console.error(`FFmpeg error for ${quality}:`, errorText);
      continue;
    }

    // Get processed file size
    const processedStat = await Deno.stat(outputPath);
    const processedSize = processedStat.size;
    const compressionRatio = Math.round(((originalSize - processedSize) / originalSize) * 100);
    
    totalCompressedSize += processedSize;
    
    // Upload processed file to Supabase storage
    const processedFileName = `processed/${mediaId}-${baseName}_${quality}.webm`;
    const fileData = await Deno.readFile(outputPath);
    
    const { error: uploadError } = await sb.storage
      .from('content')
      .upload(processedFileName, fileData, { 
        upsert: false,
        contentType: 'video/webm'
      });

    if (uploadError) {
      console.error(`Failed to upload ${quality} version:`, uploadError);
      continue;
    }

    results[quality] = processedFileName;
    compressionInfo[quality] = {
      size: processedSize,
      bitrate,
      compressionRatio
    };

    console.log(`Successfully processed ${quality}: ${processedFileName} (${compressionRatio}% compression)`);
    
    // Clean up temporary file
    try {
      await Deno.remove(outputPath);
    } catch (error) {
      console.warn(`Failed to cleanup ${outputPath}:`, error);
    }
  }

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

  try {
    const {
      fileData,
      fileName,
      mediaId,
      mediaType,
      targetQualities = ['480p', '720p', '1080p']
    }: VideoProcessRequest = await req.json();

    if (mediaType !== 'video') {
      return json({ error: 'This function only processes videos' }, 400);
    }

    console.log(`Starting video processing for ${fileName} with qualities:`, targetQualities);

    // Write input file to temporary location
    const tempInputPath = `/tmp/input_${mediaId}_${Date.now()}.mp4`;
    const uint8Array = new Uint8Array(fileData);
    await Deno.writeFile(tempInputPath, uint8Array);

    console.log(`Input file written to: ${tempInputPath}, size: ${uint8Array.length} bytes`);

    // Process video with FFmpeg
    const results = await processVideoWithFFmpeg(tempInputPath, fileName, targetQualities);

    // Clean up input file
    try {
      await Deno.remove(tempInputPath);
      console.log('Input file cleaned up successfully');
    } catch (error) {
      console.warn('Failed to cleanup input file:', error);
    }

    if (Object.keys(results.processedPaths).length === 0) {
      return json({ error: 'Failed to process video in any quality' }, 500);
    }

    console.log(`Video processing completed for ${fileName}:`, results);

    return json({
      success: true,
      processedPaths: results.processedPaths,
      compressionInfo: results.compressionInfo,
      totalCompressedSize: results.totalCompressedSize,
      availableQualities: Object.keys(results.processedPaths)
    });

  } catch (error) {
    console.error('Video processing error:', error);
    return json({ 
      error: error.message,
      success: false 
    }, 500);
  }
});