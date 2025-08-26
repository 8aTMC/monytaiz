import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')

    // Create supabase client with user's JWT token for RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    )

    const { searchParams } = new URL(req.url)
    const path = searchParams.get('path')
    const width = searchParams.get('width')
    const height = searchParams.get('height')
    const quality = searchParams.get('quality') || '75'

    if (!path) {
      return new Response(
        JSON.stringify({ error: 'Missing path parameter' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check access permissions using our security function
    const { data: accessResult, error: accessError } = await supabase
      .rpc('get_secure_media_url', { 
        media_path: path,
        expires_in_seconds: 3600
      })

    if (accessError || accessResult?.error) {
      console.log('Access denied for path:', path, accessError || accessResult?.error)
      return new Response(
        JSON.stringify({ error: accessResult?.error || 'Access denied' }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Generate signed URL with transforms
    let signedUrlOptions: any = {
      expiresIn: 3600,
    }

    // Add image transforms if specified
    if (width || height) {
      signedUrlOptions.transform = {
        width: width ? parseInt(width) : undefined,
        height: height ? parseInt(height) : undefined,
        quality: parseInt(quality),
        resize: 'cover',
        format: 'webp'
      }
    }

     // Generate signed URL with transforms using service role client
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: urlData, error: urlError } = await supabaseService.storage
      .from('content')
      .createSignedUrl(path, 3600, signedUrlOptions)

    if (urlError) {
      console.error('Error generating signed URL:', urlError)
      return new Response(
        JSON.stringify({ error: 'Failed to generate secure URL' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        url: urlData.signedUrl,
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString()
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
        }
      }
    )

  } catch (error) {
    console.error('Secure media error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})