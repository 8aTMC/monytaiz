import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
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

    // Get user ID from JWT (much faster than RPC call)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fast access check: Get user roles in one query
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)

    if (rolesError) {
      return new Response(
        JSON.stringify({ error: 'Access check failed' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userRoles = roles?.map(r => r.role) || []
    const isManagement = userRoles.some(role => 
      ['owner', 'superadmin', 'admin', 'manager', 'chatter'].includes(role)
    )

    // Management users get instant access
    if (!isManagement) {
      // For fans, check if they have access to this specific media
      const { data: grants, error: grantsError } = await supabase
        .from('fan_media_grants')
        .select('media_id')
        .eq('fan_id', user.id)
        .limit(1)

      if (grantsError || !grants?.length) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Generate long-lived signed URL (2 hours for aggressive caching)
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let signedUrlOptions: any = {
      expiresIn: 7200, // 2 hours instead of 1
    }

    // Add transforms if specified
    if (width || height) {
      signedUrlOptions.transform = {
        width: width ? parseInt(width) : undefined,
        height: height ? parseInt(height) : undefined,
        quality: parseInt(quality),
        resize: 'cover'
      }
    }

    const { data: urlData, error: urlError } = await supabaseService.storage
      .from('content')
      .createSignedUrl(path, 7200, signedUrlOptions)

    if (urlError) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate secure URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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
          'Cache-Control': 'private, max-age=3600' // Client-side caching for 1 hour
        }
      }
    )

  } catch (error) {
    console.error('Fast secure media error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})