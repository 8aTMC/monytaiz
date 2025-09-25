import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface ChunkInfo {
  chunkIndex: number;
  totalChunks: number;
  chunkPath: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🧩 Chunk reassembly service started');
  
  try {
    const { 
      bucket, 
      chunkPaths, 
      finalPath, 
      totalChunks, 
      contentType 
    } = await req.json();
    
    console.log(`🔧 Reassembling ${totalChunks} chunks into ${finalPath}`);

    if (!bucket || !chunkPaths || !finalPath || !totalChunks) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required parameters'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Sort chunk paths by index to ensure correct order
    const sortedChunkPaths = chunkPaths.sort((a: string, b: string) => {
      const aIndex = parseInt(a.split('.part')[1]);
      const bIndex = parseInt(b.split('.part')[1]);
      return aIndex - bIndex;
    });

    console.log(`📋 Chunk order: ${sortedChunkPaths.join(', ')}`);

    // Download and combine all chunks
    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    for (let i = 0; i < sortedChunkPaths.length; i++) {
      const chunkPath = sortedChunkPaths[i];
      console.log(`⬇️ Downloading chunk ${i + 1}/${totalChunks}: ${chunkPath}`);
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(chunkPath);
      
      if (error || !data) {
        throw new Error(`Failed to download chunk ${chunkPath}: ${error?.message}`);
      }
      
      const chunkBytes = new Uint8Array(await data.arrayBuffer());
      chunks.push(chunkBytes);
      totalSize += chunkBytes.length;
      
      console.log(`✅ Chunk ${i + 1} downloaded: ${chunkBytes.length} bytes`);
    }

    console.log(`🔗 Combining ${chunks.length} chunks, total size: ${totalSize} bytes`);

    // Combine all chunks into a single file
    const combinedData = new Uint8Array(totalSize);
    let offset = 0;
    
    for (const chunk of chunks) {
      combinedData.set(chunk, offset);
      offset += chunk.length;
    }

    console.log(`📤 Uploading reassembled file: ${finalPath}`);

    // Upload the combined file
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(finalPath, combinedData, {
        contentType: contentType || 'application/octet-stream',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    console.log(`✅ File reassembled successfully: ${finalPath}`);

    // Clean up chunk files
    console.log(`🧹 Cleaning up ${sortedChunkPaths.length} chunk files`);
    const cleanupPromises = sortedChunkPaths.map((chunkPath: string) => 
      supabase.storage.from(bucket).remove([chunkPath])
    );
    
    try {
      await Promise.all(cleanupPromises);
      console.log('✅ Cleanup completed');
    } catch (cleanupError) {
      console.warn('⚠️ Some chunks failed to cleanup:', cleanupError);
    }

    return new Response(JSON.stringify({
      success: true,
      finalPath,
      totalSize,
      message: `Successfully reassembled ${totalChunks} chunks into ${finalPath}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Chunk reassembly error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown reassembly error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});