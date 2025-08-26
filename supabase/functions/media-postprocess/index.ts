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

    // 2) Get metadata from storage with timeout to determine file type first
    let size_bytes = null;
    let mime = null;
    let type = 'image';
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const { data: meta, error: metaErr } = await sb.storage.from(bucket).list(
        path.includes("/") ? path.split("/").slice(0, -1).join("/") : "",
        { search: path.split("/").pop() }
      );
      clearTimeout(timeoutId);
      
      if (metaErr) {
        console.warn("List meta error:", metaErr);
      } else {
        const fileMeta = meta?.find((f) => f.name === path.split("/").pop());
        size_bytes = fileMeta?.metadata?.size ?? null;
        mime = fileMeta?.metadata?.mimetype ?? null;
      }
    } catch (error) {
      console.warn("Failed to get file metadata:", error);
    }

    // Determine type based on mime or file extension
    if (mime) {
      if (mime.startsWith('video/')) type = 'video';
      else if (mime.startsWith('audio/')) type = 'audio';
      else if (mime.startsWith('image/')) type = 'image';
    } else {
      // Fallback to file extension
      const ext = path.toLowerCase().split('.').pop();
      if (ext && ['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)) type = 'video';
      else if (ext && ['mp3', 'wav', 'aac', 'ogg'].includes(ext)) type = 'audio';
    }

    // 3) Get image dimensions for images only
    let width = 1920;
    let height = 1080;
    if (type === 'image') {
      const dimensions = await getImageDimensions(originalUrl);
      width = dimensions.width;
      height = dimensions.height;
    }

    // 4) Generate tiny placeholder - simplified approach
    let tinyDataUrl = '';
    try {
      // Only try transform for images, and with timeout
      if (type === 'image' || (!mime || mime.startsWith('image/'))) {
        const tinyUrl = `${TRANSFORM_BASE}/public/${bucket}/${path}?width=24&quality=20`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
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
      }
    } catch (error) {
      console.warn('Failed to generate tiny placeholder:', error);
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