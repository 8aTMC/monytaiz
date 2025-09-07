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
    const format = searchParams.get('format')

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
    console.log(`Request params - width: ${width}, height: ${height}, quality: ${quality}, format: ${format}`)

    // Check if this is a HEIC file EARLY
    const isHEICFile = path.toLowerCase().includes('.heic') || 
                       path.toLowerCase().includes('.heif') || 
                       path.toLowerCase().includes('.heix')
    
    console.log(`HEIC Detection - path: ${path}, isHEICFile: ${isHEICFile}`)

    // Generate optimized signed URL
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // IMMEDIATE HEIC CHECK - Exit early for HEIC files to avoid any transform logic
    if (isHEICFile) {
      console.log(`HEIC FILE DETECTED - Processing without transforms: ${path}`)
      
      try {
        const { data: urlData, error: urlError } = await supabaseService.storage
          .from('content')
          .createSignedUrl(path, 7200) // No transforms for HEIC files

        if (urlError) {
          console.error('HEIC STORAGE ERROR:', {
            path,
            errorMessage: urlError.message,
            errorName: urlError.name,
            errorStack: urlError.stack
          })
          return new Response(
            JSON.stringify({ 
              error: 'Failed to generate secure URL for HEIC file', 
              details: urlError.message,
              path: path
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log('HEIC SUCCESS - Generated signed URL:', path)
        return new Response(
          JSON.stringify({ 
            success: true, 
            url: urlData.signedUrl,
            expires_at: new Date(Date.now() + 7200 * 1000).toISOString(),
            fileType: 'HEIC'
          }),
          { 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=3600'
            }
          }
        )
      } catch (heicError) {
        console.error('HEIC EXCEPTION:', heicError)
        return new Response(
          JSON.stringify({ 
            error: 'Exception processing HEIC file', 
            details: heicError.message,
            path: path
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    console.log(`NON-HEIC FILE - Proceeding with normal processing: ${path}`)
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

    // Fallback to image transforms for regular files
    let transformOptions: any = {
      expiresIn: 7200, // 2 hours
    }

    // SAFETY CHECK - Should never reach here for HEIC files
    if (isHEICFile) {
      console.error('CRITICAL ERROR - HEIC file reached transform section!', path)
      return new Response(
        JSON.stringify({ 
          error: 'HEIC file incorrectly reached transform section', 
          path: path 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Add transforms if specified (not for HEIC files)
    if (width || height || quality || format) {
      const transform: any = {
        width: width ? Math.min(parseInt(width), 1920) : undefined,
        height: height ? Math.min(parseInt(height), 1920) : undefined,
        quality: Math.min(parseInt(quality), 95),
        resize: 'cover'
      }
      
      // Only add format if it's a valid, non-null value
      // Supported formats by Supabase Storage: webp, jpeg, png, avif
      const validFormats = ['webp', 'jpeg', 'jpg', 'png', 'avif']
      if (format && validFormats.includes(format.toLowerCase())) {
        transform.format = format.toLowerCase()
      }
      
      transformOptions.transform = transform
      console.log(`Applied transforms for regular file:`, transformOptions.transform)
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