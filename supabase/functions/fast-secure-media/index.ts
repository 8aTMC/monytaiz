import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create supabase client with user's JWT
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { searchParams } = new URL(req.url)
    const path = searchParams.get('path')
    const width = searchParams.get('width')
    const height = searchParams.get('height')
    const quality = searchParams.get('quality') || '75'

    if (!path) {
      return new Response(
        JSON.stringify({ error: 'Missing path parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user ID from JWT (fastest auth check)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('Auth error:', userError)
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fast role check for basic access control
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .limit(1)

    // Allow access for authenticated users (basic check)
    const hasRole = roles && roles.length > 0
    if (!hasRole) {
      console.error('No role found for user:', user.id)
      return new Response(
        JSON.stringify({ error: 'Access denied - no role' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Generating signed URL for user ${user.id}, path: ${path}`)

    // Generate optimized signed URL
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // For videos, check if we have processed quality variants
    if (path.includes('.mp4') || path.includes('.webm') || path.includes('.mov')) {
      // Try to find processed quality variant matching the request
      let targetPath = path
      
      if (height) {
        const requestedHeight = parseInt(height)
        const { data: qualityData } = await supabaseService
          .from('quality_metadata')
          .select('storage_path, height')
          .like('storage_path', `%${path.split('/').pop()?.split('.')[0]}%`)
          .order('height', { ascending: false })
          .limit(5)

        if (qualityData && qualityData.length > 0) {
          // Find best matching quality
          const bestMatch = qualityData.find(q => q.height <= requestedHeight) ||
                           qualityData[qualityData.length - 1] // Use smallest if all are larger
          
          if (bestMatch) {
            targetPath = bestMatch.storage_path
            console.log(`Using processed quality: ${targetPath} (${bestMatch.height}p requested: ${requestedHeight}p)`)
          }
        }
      }

      // Generate signed URL for processed video (no transforms needed)
      const { data: urlData, error: urlError } = await supabaseService.storage
        .from('content')
        .createSignedUrl(targetPath, 7200)

      if (!urlError && urlData) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            url: urlData.signedUrl,
            expires_at: new Date(Date.now() + 7200 * 1000).toISOString(),
            processed: targetPath !== path
          }),
          { 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=3600'
            }
          }
        )
      }
    }

    // Fallback to image transforms or original file
    let transformOptions: any = {
      expiresIn: 7200, // 2 hours
    }

    // Add transforms if specified (mainly for images)
    if (width || height || quality) {
      transformOptions.transform = {
        width: width ? Math.min(parseInt(width), 1920) : undefined,
        height: height ? Math.min(parseInt(height), 1920) : undefined,
        quality: Math.min(parseInt(quality), 95),
        resize: 'cover'
      }
    }

    const { data: urlData, error: urlError } = await supabaseService.storage
      .from('content')
      .createSignedUrl(path, 7200, transformOptions)

    if (urlError) {
      console.error('Signed URL error for path:', path, 'Error:', urlError)
      return new Response(
        JSON.stringify({ error: 'Failed to generate secure URL', details: urlError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Successfully generated signed URL for:', path)

    return new Response(
      JSON.stringify({ 
        success: true, 
        url: urlData.signedUrl,
        expires_at: new Date(Date.now() + 7200 * 1000).toISOString()
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600'
        }
      }
    )

  } catch (error) {
    console.error('Fast secure media error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})