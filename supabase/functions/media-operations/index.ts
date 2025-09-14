import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, x-requested-with, accept, accept-language, user-agent',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Max-Age': '86400'
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

interface RemoveFromFolderRequest {
  action: 'remove_from_folder'
  folder_id: string
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

type MediaOperationRequest = CopyToCollectionRequest | RemoveFromCollectionRequest | RemoveFromFolderRequest | DeleteMediaRequest | CreateCollectionRequest

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false }
    })

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      supabase.auth.setSession({
        access_token: authHeader.replace('Bearer ', ''),
        refresh_token: ''
      })
    }

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user has the right permissions (management roles)
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)

    const hasPermission = userRoles?.some(r => 
      ['owner', 'superadmin', 'admin', 'manager', 'chatter'].includes(r.role)
    )

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body: MediaOperationRequest = await req.json()
    console.log('Processing request:', body)

    let result
    switch (body.action) {
      case 'copy_to_collection':
        result = await copyToCollection(supabase, body.collection_id, body.media_ids, user.id)
        break
      case 'remove_from_collection':
        result = await removeFromCollection(supabase, body.collection_id, body.media_ids)
        break
      case 'remove_from_folder':
        result = await removeFromFolder(supabase, body.folder_id, body.media_ids)
        break
      case 'delete_media_hard':
        result = await deleteMediaHard(supabase, body.media_ids)
        break
      case 'create_collection':
        result = await createCollection(supabase, body.name, user.id)
        break
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Media operations error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function copyToCollection(supabase: any, collectionId: string, mediaIds: string[], userId: string) {
  // Verify collection exists and user has access
  const { data: collection, error: collectionError } = await supabase
    .from('collections')
    .select('*')
    .eq('id', collectionId)
    .single()

  if (collectionError || !collection) {
    throw new Error('Collection not found')
  }

  let successCount = 0
  let duplicateCount = 0

  // Process each media item
  for (const mediaId of mediaIds) {
    // Check if media exists - try both media and simple_media tables
    let mediaExists = false
    
    const { data: mediaRecord } = await supabase
      .from('media')
      .select('id')
      .eq('id', mediaId)
      .single()
    
    if (mediaRecord) {
      mediaExists = true
    } else {
      const { data: simpleMediaRecord } = await supabase
        .from('simple_media')
        .select('id')
        .eq('id', mediaId)
        .single()
      
      if (simpleMediaRecord) {
        mediaExists = true
      }
    }

    if (!mediaExists) {
      console.warn(`Media ${mediaId} not found, skipping`)
      continue
    }

    // Check if already in collection
    const { data: existing } = await supabase
      .from('collection_items')
      .select('media_id')
      .eq('collection_id', collectionId)
      .eq('media_id', mediaId)
      .single()

    if (existing) {
      duplicateCount++
      continue
    }

    // Add to collection
    const { error: insertError } = await supabase
      .from('collection_items')
      .insert({
        collection_id: collectionId,
        media_id: mediaId,
        added_by: userId
      })

    if (!insertError) {
      successCount++
    } else {
      console.error(`Failed to add media ${mediaId} to collection:`, insertError)
    }
  }

  let message = `Added ${successCount} items to collection`
  if (duplicateCount > 0) {
    message += ` (${duplicateCount} already existed)`
  }

  return { message, success_count: successCount, duplicate_count: duplicateCount }
}

async function removeFromCollection(supabase: any, collectionId: string, mediaIds: string[]) {
  const { error } = await supabase
    .from('collection_items')
    .delete()
    .eq('collection_id', collectionId)
    .in('media_id', mediaIds)

  if (error) {
    throw new Error(`Failed to remove items from collection: ${error.message}`)
  }

  return { message: `Removed ${mediaIds.length} items from collection` }
}

async function removeFromFolder(supabase: any, folderId: string, mediaIds: string[]) {
  // Verify folder exists
  const { data: folder, error: folderError } = await supabase
    .from('file_folders')
    .select('*')
    .eq('id', folderId)
    .single()

  if (folderError || !folder) {
    throw new Error('Folder not found')
  }

  const { error } = await supabase
    .from('file_folder_contents')
    .delete()
    .eq('folder_id', folderId)
    .in('media_id', mediaIds)

  if (error) {
    throw new Error(`Failed to remove items from folder: ${error.message}`)
  }

  return { message: `Removed ${mediaIds.length} items from folder` }
}

async function deleteMediaHard(supabase: any, mediaIds: string[]) {
  // Create service role client for storage operations
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceRoleKey) {
    throw new Error('Service role key not configured')
  }

  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey
  )

  let deletedCount = 0

  for (const mediaId of mediaIds) {
    try {
      // Get media info to find storage paths
      let storagePaths: string[] = []
      
      // Try simple_media first
      const { data: simpleMedia } = await supabase
        .from('simple_media')
        .select('original_path, processed_path, thumbnail_path')
        .eq('id', mediaId)
        .single()

      if (simpleMedia) {
        if (simpleMedia.original_path) storagePaths.push(simpleMedia.original_path)
        if (simpleMedia.processed_path) storagePaths.push(simpleMedia.processed_path)
        if (simpleMedia.thumbnail_path) storagePaths.push(simpleMedia.thumbnail_path)
      } else {
        // Try media table
        const { data: media } = await supabase
          .from('media')
          .select('storage_path, original_path')
          .eq('id', mediaId)
          .single()

        if (media) {
          if (media.storage_path) storagePaths.push(media.storage_path)
          if (media.original_path) storagePaths.push(media.original_path)
        }
      }

      // Delete files from storage
      for (const path of storagePaths) {
        if (path) {
          await serviceClient.storage
            .from('content')
            .remove([path])
        }
      }

      // Delete database records
      await supabase.from('collection_items').delete().eq('media_id', mediaId)
      await supabase.from('simple_media').delete().eq('id', mediaId)
      await supabase.from('media').delete().eq('id', mediaId)
      
      deletedCount++
    } catch (error) {
      console.error(`Failed to delete media ${mediaId}:`, error)
    }
  }

  return { message: `Permanently deleted ${deletedCount} items`, deleted_count: deletedCount }
}

async function createCollection(supabase: any, name: string, userId: string) {
  const { data: collection, error } = await supabase
    .from('collections')
    .insert({
      name,
      creator_id: userId,
      created_by: userId,
      system: false
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create collection: ${error.message}`)
  }

  return { 
    message: `Created collection "${name}"`,
    collection
  }
}