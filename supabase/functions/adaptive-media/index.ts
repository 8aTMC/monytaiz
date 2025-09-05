import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface AdaptiveMediaRequest {
  mediaId: string;
  quality?: string;
  expiresIn?: number;
  format?: 'url' | 'manifest';
}

interface QualityInfo {
  path: string;
  size_mb: number;
  compression_ratio: number;
  width: number;
  height: number;
}

interface MediaManifest {
  mediaId: string;
  qualities: Array<{
    level: string;
    width: number;
    height: number;
    bitrate: string;
    url: string;
    size_mb: number;
  }>;
  originalPath: string;
  thumbnailUrl?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🎬 Adaptive Media API called');
  
  try {
    const { mediaId, quality, expiresIn = 3600, format = 'url' }: AdaptiveMediaRequest = await req.json();
    
    if (!mediaId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'mediaId is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get media record from database
    const { data: mediaRecord, error: mediaError } = await supabase
      .from('simple_media')
      .select('*')
      .eq('id', mediaId)
      .single();

    if (mediaError || !mediaRecord) {
      console.error('Media not found:', mediaError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Media not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const qualityInfo = mediaRecord.quality_info as Record<string, QualityInfo> || {};
    
    if (format === 'manifest') {
      // Return full manifest with all available qualities
      const qualities = Object.entries(qualityInfo).map(([level, info]) => {
        // Generate signed URL for this quality
        const { data: signedUrl } = supabase.storage
          .from('content')
          .createSignedUrl(info.path, expiresIn);
          
        return {
          level,
          width: info.width,
          height: info.height,
          bitrate: getBitrateForQuality(level),
          url: signedUrl?.signedUrl || '',
          size_mb: info.size_mb
        };
      });

      // Get thumbnail URL if available
      let thumbnailUrl;
      if (mediaRecord.thumbnail_path) {
        const { data: thumbSigned } = supabase.storage
          .from('content')
          .createSignedUrl(mediaRecord.thumbnail_path, expiresIn);
        thumbnailUrl = thumbSigned?.signedUrl;
      }

      const manifest: MediaManifest = {
        mediaId,
        qualities,
        originalPath: mediaRecord.original_path,
        thumbnailUrl
      };

      return new Response(JSON.stringify({
        success: true,
        manifest
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else {
      // Return single quality URL
      let targetPath = mediaRecord.processed_path;
      
      if (quality && qualityInfo[quality]) {
        targetPath = qualityInfo[quality].path;
      } else if (quality) {
        console.warn(`Quality ${quality} not available, using processed path`);
      }

      if (!targetPath) {
        return new Response(JSON.stringify({
          success: false,
          error: 'No processed media available'
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Generate signed URL
      const { data: signedData, error: signError } = supabase.storage
        .from('content')
        .createSignedUrl(targetPath, expiresIn);

      if (signError || !signedData) {
        console.error('Failed to create signed URL:', signError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to generate media URL'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        signedUrl: signedData.signedUrl,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
        quality: quality || 'processed',
        mediaInfo: quality && qualityInfo[quality] ? {
          width: qualityInfo[quality].width,
          height: qualityInfo[quality].height,
          size_mb: qualityInfo[quality].size_mb,
          compression_ratio: qualityInfo[quality].compression_ratio
        } : null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('❌ Adaptive media error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Check edge function logs for more information'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getBitrateForQuality(quality: string): string {
  const bitrateMap: Record<string, string> = {
    '240p': '300k',
    '360p': '500k', 
    '480p': '800k',
    '720p': '1500k',
    '1080p': '3000k',
    '1440p': '6000k',
    '4k': '12000k',
    '2160p': '12000k'
  };
  
  return bitrateMap[quality] || '1000k';
}