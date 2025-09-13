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
    const quality = searchParams.get('quality') // Don't default to 75 for audio files
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

    // Normalize path - ensure it has content/ prefix for storage operations
    let normalizedPath = path;
    if (!normalizedPath.startsWith('content/')) {
      normalizedPath = `content/${normalizedPath}`;
    }

    console.log(`Generating signed URL for user ${user.id}, original path: ${path}, normalized: ${normalizedPath}`)
    console.log(`Request params - width: ${width}, height: ${height}, quality: ${quality}, format: ${format}`)

    // Check if this is a HEIC file, GIF, or AUDIO file EARLY using normalized path
    const isHEICFile = normalizedPath.toLowerCase().includes('.heic') || 
                       normalizedPath.toLowerCase().includes('.heif') || 
                       normalizedPath.toLowerCase().includes('.heix')
    
    const isGIFFile = normalizedPath.toLowerCase().includes('.gif')
    
    const isAudioFile = normalizedPath.toLowerCase().includes('.mp3') ||
                        normalizedPath.toLowerCase().includes('.m4a') ||
                        normalizedPath.toLowerCase().includes('.aac') ||
                        normalizedPath.toLowerCase().includes('.wav') ||
                        normalizedPath.toLowerCase().includes('.ogg') ||
                        normalizedPath.toLowerCase().includes('.opus') ||
                        normalizedPath.toLowerCase().includes('.flac')
    
    console.log(`Special File Detection - path: ${normalizedPath}, isHEICFile: ${isHEICFile}, isGIFFile: ${isGIFFile}, isAudioFile: ${isAudioFile}`)

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
          .createSignedUrl(normalizedPath.replace(/^content\//, ''), 7200) // No transforms for HEIC files

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

    // IMMEDIATE GIF CHECK - Exit early for GIF files to preserve animation
    if (isGIFFile) {
      console.log(`GIF FILE DETECTED - Processing without transforms to preserve animation: ${path}`)
      
      try {
        const { data: urlData, error: urlError } = await supabaseService.storage
          .from('content')
          .createSignedUrl(normalizedPath.replace(/^content\//, ''), 7200) // No transforms for GIF files

        if (urlError) {
          console.error('GIF STORAGE ERROR:', {
            path,
            errorMessage: urlError.message,
            errorName: urlError.name,
            errorStack: urlError.stack
          })
          return new Response(
            JSON.stringify({ 
              error: 'Failed to generate secure URL for GIF file', 
              details: urlError.message,
              path: path
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log('GIF SUCCESS - Generated signed URL without transforms:', path)
        return new Response(
          JSON.stringify({ 
            success: true, 
            url: urlData.signedUrl,
            expires_at: new Date(Date.now() + 7200 * 1000).toISOString(),
            fileType: 'GIF'
          }),
          { 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=3600'
            }
          }
        )
      } catch (gifError) {
        console.error('GIF EXCEPTION:', gifError)
        return new Response(
          JSON.stringify({ 
            error: 'Exception processing GIF file', 
            details: gifError.message,
            path: path
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // IMMEDIATE AUDIO CHECK - Exit early for audio files to avoid transforms
    if (isAudioFile) {
      console.log(`AUDIO FILE DETECTED - Processing without transforms: ${path}`)
      
      try {
        const { data: urlData, error: urlError } = await supabaseService.storage
          .from('content')
          .createSignedUrl(normalizedPath.replace(/^content\//, ''), 7200) // No transforms for audio files

        if (urlError) {
          console.error('AUDIO STORAGE ERROR:', {
            path,
            errorMessage: urlError.message,
            errorName: urlError.name,
            errorStack: urlError.stack
          })
          return new Response(
            JSON.stringify({ 
              error: 'Failed to generate secure URL for audio file', 
              details: urlError.message,
              path: path
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log('AUDIO SUCCESS - Generated signed URL without transforms:', path)
        return new Response(
          JSON.stringify({ 
            success: true, 
            url: urlData.signedUrl,
            expires_at: new Date(Date.now() + 7200 * 1000).toISOString(),
            fileType: 'AUDIO'
          }),
          { 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=3600'
            }
          }
        )
      } catch (audioError) {
        console.error('AUDIO EXCEPTION:', audioError)
        return new Response(
          JSON.stringify({ 
            error: 'Exception processing audio file', 
            details: audioError.message,
            path: path
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    console.log(`REGULAR FILE - Proceeding with normal processing: ${normalizedPath}`)
    if (normalizedPath.includes('.mp4') || normalizedPath.includes('.webm') || normalizedPath.includes('.mov')) {
      // Try to find processed quality variant matching the request
      let targetPath = path
      
      if (height) {
        const requestedHeight = parseInt(height)
        const { data: qualityData } = await supabaseService
          .from('quality_metadata')
          .select('storage_path, height')
          .like('storage_path', `%${normalizedPath.split('/').pop()?.split('.')[0]}%`)
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
        .createSignedUrl(targetPath.replace(/^content\//, ''), 7200)

      if (!urlError && urlData) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            url: urlData.signedUrl,
            expires_at: new Date(Date.now() + 7200 * 1000).toISOString(),
            processed: targetPath !== normalizedPath
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

    // SAFETY CHECK - Should never reach here for HEIC or GIF files
    if (isHEICFile) {
      console.error('CRITICAL ERROR - HEIC file reached transform section!', normalizedPath)
      return new Response(
        JSON.stringify({ 
          error: 'HEIC file incorrectly reached transform section', 
          path: normalizedPath 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (isGIFFile) {
      console.error('CRITICAL ERROR - GIF file reached transform section!', normalizedPath)
      return new Response(
        JSON.stringify({ 
          error: 'GIF file incorrectly reached transform section', 
          path: normalizedPath 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Add transforms if specified (not for HEIC files)
    if (width || height || quality || format) {
      const transform: any = {
        width: width ? Math.min(parseInt(width), 1920) : undefined,
        height: height ? Math.min(parseInt(height), 1920) : undefined,
        quality: quality ? Math.min(parseInt(quality), 95) : undefined, // Only apply quality if explicitly requested
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
      .createSignedUrl(normalizedPath.replace(/^content\//, ''), 7200, transformOptions)

    if (urlError) {
      console.error('Signed URL error for path:', normalizedPath, 'Error:', urlError)
      return new Response(
        JSON.stringify({ error: 'Failed to generate secure URL', details: urlError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Successfully generated signed URL for:', normalizedPath)

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