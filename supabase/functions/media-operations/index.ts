import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CopyToCollectionRequest {
  action: 'copy_to_collection'
  collection_id: string
  media_ids: string[]
}

interface RemoveFromCollectionRequest {
  action: 'remove_from_collection'
  collection_id: string
  media_ids: string[]
}

interface DeleteMediaRequest {
  action: 'delete_media_hard'
  media_ids: string[]
}

interface CreateCollectionRequest {
  action: 'create_collection'
  name: string
}

type RequestBody = CopyToCollectionRequest | RemoveFromCollectionRequest | DeleteMediaRequest | CreateCollectionRequest

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { 
        global: { 
          headers: { Authorization: req.headers.get('Authorization')! } 
        } 
      }
    )

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      console.error('Auth error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      )
    }

    // Check user role - must be management role
    const { data: userRoles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRoles || !['owner', 'superadmin', 'admin', 'manager', 'chatter'].includes(userRoles.role)) {
      console.error('Insufficient permissions:', userRoles)
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: corsHeaders }
      )
    }

    const body: RequestBody = await req.json()
    console.log('Processing request:', body)

    switch (body.action) {
      case 'copy_to_collection':
        return await copyToCollection(supabaseClient, user.id, body.collection_id, body.media_ids)
      
      case 'remove_from_collection':
        return await removeFromCollection(supabaseClient, user.id, body.collection_id, body.media_ids)
      
      case 'delete_media_hard':
        return await deleteMediaHard(supabaseClient, user.id, body.media_ids)
      
      case 'create_collection':
        return await createCollection(supabaseClient, user.id, body.name)
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: corsHeaders }
        )
    }
  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})

async function copyToCollection(supabaseClient: any, userId: string, collectionId: string, mediaIds: string[]) {
  try {
    // Validate collection ownership
    const { data: collection, error: collectionError } = await supabaseClient
      .from('collections')
      .select('creator_id')
      .eq('id', collectionId)
      .single()

    if (collectionError || !collection) {
      return new Response(
        JSON.stringify({ error: 'Collection not found' }),
        { status: 404, headers: corsHeaders }
      )
    }

    // Validate media ownership - check both media and content_files tables
    const [mediaResults, contentResults] = await Promise.all([
      supabaseClient
        .from('media')
        .select('id, creator_id')
        .in('id', mediaIds),
      supabaseClient
        .from('content_files')
        .select('id, creator_id')
        .in('id', mediaIds)
        .eq('is_active', true)
    ])

    if (mediaResults.error && contentResults.error) {
      return new Response(
        JSON.stringify({ error: 'Failed to validate media' }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Combine results from both tables
    const allMedia = [
      ...(mediaResults.data || []),
      ...(contentResults.data || [])
    ]

    if (allMedia.length !== mediaIds.length) {
      return new Response(
        JSON.stringify({ error: 'Some media not found' }),
        { status: 404, headers: corsHeaders }
      )
    }

    // Insert collection items (on conflict do nothing)
    const items = mediaIds.map(mediaId => ({
      collection_id: collectionId,
      media_id: mediaId,
      added_by: userId
    }))

    const { error: insertError } = await supabaseClient
      .from('collection_items')
      .upsert(items, { onConflict: 'collection_id,media_id' })

    if (insertError) {
      console.error('Insert error:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to copy to collection' }),
        { status: 500, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: `Copied ${mediaIds.length} items to collection` }),
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Copy to collection error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
}

async function removeFromCollection(supabaseClient: any, userId: string, collectionId: string, mediaIds: string[]) {
  try {
    // Delete from collection_items
    const { error } = await supabaseClient
      .from('collection_items')
      .delete()
      .eq('collection_id', collectionId)
      .in('media_id', mediaIds)

    if (error) {
      console.error('Remove from collection error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to remove from collection' }),
        { status: 500, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: `Removed ${mediaIds.length} items from collection` }),
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Remove from collection error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
}

async function deleteMediaHard(supabaseClient: any, userId: string, mediaIds: string[]) {
  try {
    // Get media details for storage cleanup - check both tables
    const [mediaResults, contentResults] = await Promise.all([
      supabaseClient
        .from('media')
        .select('id, storage_path')
        .in('id', mediaIds),
      supabaseClient
        .from('content_files')
        .select('id, file_path')
        .in('id', mediaIds)
        .eq('is_active', true)
    ])

    if (mediaResults.error && contentResults.error) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch media details' }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Combine results from both tables, normalizing file paths
    const allMedia = [
      ...(mediaResults.data || []).map((item: any) => ({ 
        id: item.id, 
        file_path: item.storage_path 
      })),
      ...(contentResults.data || [])
    ]

    if (allMedia.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No media found to delete' }),
        { status: 404, headers: corsHeaders }
      )
    }

    // Delete from storage first
    const storagePromises = allMedia.map(async (item: any) => {
      if (item.file_path) {
        const { error } = await supabaseClient.storage
          .from('content')
          .remove([item.file_path])
        
        if (error) {
          console.error(`Failed to delete storage file ${item.file_path}:`, error)
        }
      }
    })

    await Promise.all(storagePromises)

    // Delete from both database tables
    const [mediaDeleteResult, contentDeleteResult] = await Promise.all([
      supabaseClient
        .from('media')
        .delete()
        .in('id', mediaIds),
      supabaseClient
        .from('content_files')
        .delete()
        .in('id', mediaIds)
    ])

    if (mediaDeleteResult.error && contentDeleteResult.error) {
      console.error('Database delete errors:', mediaDeleteResult.error, contentDeleteResult.error)
      return new Response(
        JSON.stringify({ error: 'Failed to delete media from database' }),
        { status: 500, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Permanently deleted ${mediaIds.length} media files`,
        deleted_count: mediaIds.length 
      }),
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Delete media hard error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
}

async function createCollection(supabaseClient: any, userId: string, name: string) {
  try {
    const { data, error } = await supabaseClient
      .from('collections')
      .insert({
        name,
        creator_id: userId,
        created_by: userId,
        system: false
      })
      .select('id, name')
      .single()

    if (error) {
      console.error('Create collection error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to create collection' }),
        { status: 500, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        collection: data,
        message: `Created collection "${name}"` 
      }),
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Create collection error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
}