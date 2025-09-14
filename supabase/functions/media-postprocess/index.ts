import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ReqBody = { bucket: string; path: string; isPublic?: boolean };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TRANSFORM_BASE = Deno.env.get("TRANSFORM_BASE") ?? `${SUPABASE_URL}/storage/v1/object`;

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

// Simple image dimension extraction from headers
async function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    
    // Try to get dimensions from headers (some storage services provide this)
    const width = response.headers.get('x-image-width');
    const height = response.headers.get('x-image-height');
    
    if (width && height) {
      return { width: parseInt(width), height: parseInt(height) };
    }
    
    // Fallback to fetching a small amount of data to read headers
    const fullResponse = await fetch(url, {
      headers: { 'Range': 'bytes=0-1023' } // First 1KB should be enough for headers
    });
    
    const arrayBuffer = await fullResponse.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Basic JPEG dimension extraction
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
      for (let i = 2; i < bytes.length - 8; i++) {
        if (bytes[i] === 0xFF && bytes[i + 1] === 0xC0) {
          const height = (bytes[i + 5] << 8) | bytes[i + 6];
          const width = (bytes[i + 7] << 8) | bytes[i + 8];
          return { width, height };
        }
      }
    }
    
    // Basic PNG dimension extraction
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      if (bytes.length >= 24) {
        const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
        const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
        return { width, height };
      }
    }
    
    // Default fallback
    return { width: 1920, height: 1080 };
  } catch (error) {
    console.error('Error getting image dimensions:', error);
    return { width: 1920, height: 1080 };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') return json({ error: "Method not allowed" }, 405);

    // Better error handling for JSON parsing
    let body: ReqBody;
    try {
      const text = await req.text();
      if (!text.trim()) {
        return json({ error: "Request body is empty" }, 400);
      }
      body = JSON.parse(text);
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return json({ error: "Invalid JSON in request body" }, 400);
    }

    const { bucket, path, isPublic = true } = body;
    if (!bucket || !path) return json({ error: "bucket and path required" }, 400);

    console.log(`Processing media: ${bucket}/${path}`);

    // 1) Build a URL to the original (public or signed)
    let originalUrl: string;
    if (isPublic) {
      originalUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
    } else {
      const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 60);
      if (error || !data?.signedUrl) return json({ error: error?.message ?? "sign error" }, 500);
      originalUrl = data.signedUrl;
    }

    // 2) Get metadata from storage - simplified for better reliability
    let size_bytes = null;
    let mime = null;
    let type = 'image';
    
    try {
      // Faster metadata retrieval with shorter timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // Shorter timeout
      
      const { data: meta, error: metaErr } = await sb.storage.from(bucket).list(
        path.includes("/") ? path.split("/").slice(0, -1).join("/") : "",
        { search: path.split("/").pop() }
      );
      clearTimeout(timeoutId);
      
      if (metaErr) {
        console.warn("List meta error:", metaErr);
      } else if (meta && meta.length > 0) {
        const fileMeta = meta.find((f) => f.name === path.split("/").pop());
        if (fileMeta?.metadata) {
          size_bytes = fileMeta.metadata.size ?? null;
          mime = fileMeta.metadata.mimetype ?? null;
        }
      }
    } catch (error) {
      console.warn("Failed to get file metadata:", error);
      // Continue processing even if metadata fails
    }

    // Determine type based on mime or file extension
    if (mime) {
      if (mime.startsWith('video/')) type = 'video';
      else if (mime.startsWith('audio/')) type = 'audio';
      else if (mime === 'image/gif') type = 'gif';
      else if (mime.startsWith('image/')) type = 'image';
    } else {
      // Fallback to file extension
      const ext = path.toLowerCase().split('.').pop();
      if (ext && ['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)) type = 'video';
      else if (ext && ['mp3', 'wav', 'aac', 'ogg'].includes(ext)) type = 'audio';
      else if (ext === 'gif') type = 'gif';
    }

    // 3) Get dimensions and placeholder based on file type
    let width = 1920;
    let height = 1080;
    let tinyDataUrl = '';
    
    console.log(`Processing ${type} file: ${path}`);
    
    if (type === 'gif') {
      // For GIFs, preserve animation by avoiding transformations
      try {
        const dimensions = await getImageDimensions(originalUrl);
        width = dimensions.width;
        height = dimensions.height;
        
        // Use a simple placeholder for GIFs without transformations
        tinyDataUrl = 'data:image/svg+xml;base64,' + btoa(`
          <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="gifGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#8b5cf6;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:1" />
              </linearGradient>
            </defs>
            <rect width="400" height="300" fill="url(#gifGrad)"/>
            <text x="200" y="160" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="16" font-weight="bold">GIF</text>
            <text x="200" y="180" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="12" opacity="0.8">Animated</text>
          </svg>
        `);
        
        console.log('GIF processing completed - animation preserved');
      } catch (error) {
        console.warn('Failed to process GIF:', error);
      }
    } else if (type === 'image') {
      try {
        const dimensions = await getImageDimensions(originalUrl);
        width = dimensions.width;
        height = dimensions.height;
        
        // Generate tiny placeholder for images only
        const tinyUrl = `${TRANSFORM_BASE}/public/${bucket}/${path}?width=24&quality=20`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // Shorter timeout
        
        const tinyRes = await fetch(tinyUrl, { 
          signal: controller.signal,
          headers: { 'Accept': 'image/*' }
        });
        clearTimeout(timeoutId);
        
        if (tinyRes.ok && tinyRes.headers.get('content-type')?.startsWith('image/')) {
          const tinyBytes = new Uint8Array(await tinyRes.arrayBuffer());
          const tinyB64 = btoa(String.fromCharCode(...tinyBytes));
          const contentType = tinyRes.headers.get('content-type') || 'image/jpeg';
          tinyDataUrl = `data:${contentType};base64,${tinyB64}`;
        }
      } catch (error) {
        console.warn('Failed to process image:', error);
      }
    } else if (type === 'video') {
      // For videos, use default dimensions and simple placeholder (no thumbnail generation)
      width = 1920;
      height = 1080;
      
      console.log('Video detected - skipping thumbnail generation, using placeholder');
      
      // Use simple video placeholder without processing
      tinyDataUrl = 'data:image/svg+xml;base64,' + btoa(`
        <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#2563eb;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect width="400" height="300" fill="url(#bg)"/>
          <circle cx="200" cy="150" r="35" fill="#ffffff" opacity="0.9"/>
          <polygon points="185,135 185,165 215,150" fill="#2563eb"/>
          <text x="200" y="220" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="14" opacity="0.8">Video</text>
        </svg>
      `);
      
      console.log('Video placeholder created - no processing done');
    } else if (type === 'audio') {
      // For audio, use square dimensions
      width = 800;
      height = 800;
      console.log('Audio processing - using square dimensions');
    }
    
    // Fallback to simple colored pixel if no placeholder generated
    if (!tinyDataUrl) {
      const fallbackPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      tinyDataUrl = fallbackPixel;
    }

    // 5) Upsert into media table
    const { error: upErr } = await sb
      .from("media")
      .upsert(
        {
          bucket,
          path,
          width,
          height,
          tiny_placeholder: tinyDataUrl,
          size_bytes,
          mime,
          type,
          title: path.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Untitled',
          creator_id: '00000000-0000-0000-0000-000000000000', // Will be updated by the client
          created_by: '00000000-0000-0000-0000-000000000000', // Will be updated by the client
        },
        { onConflict: "bucket,path" }
      );

    if (upErr) {
      console.error('Database upsert error:', upErr);
      return json({ error: upErr.message }, 500);
    }

    console.log(`Successfully processed: ${bucket}/${path} (${width}x${height})`);

    return json({ 
      ok: true, 
      width, 
      height, 
      tiny_placeholder: tinyDataUrl,
      type,
      size_bytes,
      mime
    });
  } catch (e) {
    console.error('Media postprocess error:', e);
    return json({ error: String(e) }, 500);
  }
});