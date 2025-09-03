import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  action: 'check_inconsistencies' | 'cleanup_orphaned_collections' | 'cleanup_orphaned_file_folders'
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify user authentication and admin role
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const { data: { user } } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (!user) {
      throw new Error('Invalid or expired token')
    }

    // Check user role
    const { data: roles, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)

    if (roleError) throw roleError

    const userRoles = roles?.map(r => r.role) || []
    const hasAdminAccess = userRoles.includes('owner') || userRoles.includes('superadmin') || userRoles.includes('admin')

    if (!hasAdminAccess) {
      throw new Error('Insufficient permissions - admin role required')
    }

    const body: RequestBody = await req.json()
    console.log('Folder cleanup request:', body)

    let result

    switch (body.action) {
      case 'check_inconsistencies':
        result = await checkFolderInconsistencies(supabaseClient)
        break
        
      case 'cleanup_orphaned_collections':
        result = await cleanupOrphanedCollections(supabaseClient)
        break
        
      case 'cleanup_orphaned_file_folders':
        result = await cleanupOrphanedFileFolders(supabaseClient)
        break
        
      default:
        throw new Error('Invalid action')
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Folder cleanup error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

async function checkFolderInconsistencies(supabaseClient: any) {
  console.log('Checking folder inconsistencies...')

  // Get all collections
  const { data: collections, error: collectionsError } = await supabaseClient
    .from('collections')
    .select('id, name, system')
    .eq('system', false)

  if (collectionsError) throw collectionsError

  // Get all file_folders
  const { data: fileFolders, error: fileFoldersError } = await supabaseClient
    .from('file_folders')
    .select('id, name, creator_id')

  if (fileFoldersError) throw fileFoldersError

  // Find collections that don't have matching file_folders
  const orphanedCollections = collections?.filter(collection => 
    !fileFolders?.some(folder => folder.name === collection.name)
  ) || []

  // Find file_folders that don't have matching collections
  const orphanedFileFolders = fileFolders?.filter(folder => 
    !collections?.some(collection => collection.name === folder.name)
  ) || []

  console.log(`Found ${orphanedCollections.length} orphaned collections and ${orphanedFileFolders.length} orphaned file folders`)

  return {
    success: true,
    inconsistencies: {
      orphaned_collections: orphanedCollections,
      orphaned_file_folders: orphanedFileFolders,
      total_collections: collections?.length || 0,
      total_file_folders: fileFolders?.length || 0
    },
    message: `Found ${orphanedCollections.length} orphaned collections and ${orphanedFileFolders.length} orphaned file folders`
  }
}

async function cleanupOrphanedCollections(supabaseClient: any) {
  console.log('Cleaning up orphaned collections...')

  // First, get the orphaned collections
  const { data: collections, error: collectionsError } = await supabaseClient
    .from('collections')
    .select('id, name')
    .eq('system', false)

  if (collectionsError) throw collectionsError

  const { data: fileFolders, error: fileFoldersError } = await supabaseClient
    .from('file_folders')
    .select('name')

  if (fileFoldersError) throw fileFoldersError

  const orphanedCollections = collections?.filter(collection => 
    !fileFolders?.some(folder => folder.name === collection.name)
  ) || []

  let deletedCount = 0

  if (orphanedCollections.length > 0) {
    const orphanedIds = orphanedCollections.map(c => c.id)

    // Delete collection_items first (foreign key constraint)
    const { error: itemsError } = await supabaseClient
      .from('collection_items')
      .delete()
      .in('collection_id', orphanedIds)

    if (itemsError) throw itemsError

    // Delete the orphaned collections
    const { error: deleteError } = await supabaseClient
      .from('collections')
      .delete()
      .in('id', orphanedIds)

    if (deleteError) throw deleteError

    deletedCount = orphanedCollections.length
  }

  console.log(`Cleaned up ${deletedCount} orphaned collections`)

  return {
    success: true,
    deleted_count: deletedCount,
    deleted_collections: orphanedCollections,
    message: `Successfully cleaned up ${deletedCount} orphaned collections`
  }
}

async function cleanupOrphanedFileFolders(supabaseClient: any) {
  console.log('Cleaning up orphaned file folders...')

  // This is more complex as file_folders is the source of truth
  // We should only delete file_folders if they have no associated media or are truly unused
  // For now, we'll just report them and let admin decide

  const { data: fileFolders, error: fileFoldersError } = await supabaseClient
    .from('file_folders')
    .select('id, name, creator_id')

  if (fileFoldersError) throw fileFoldersError

  // Check which file_folders have no associated media
  const unusedFolders = []

  for (const folder of fileFolders || []) {
    // Check if any media references this folder
    const { data: mediaCount, error: mediaError } = await supabaseClient
      .from('media')
      .select('id', { count: 'exact' })
      .eq('creator_id', folder.creator_id)
      .limit(1)

    if (mediaError) continue

    if (!mediaCount || mediaCount.length === 0) {
      unusedFolders.push(folder)
    }
  }

  return {
    success: true,
    unused_folders: unusedFolders,
    total_folders: fileFolders?.length || 0,
    message: `Found ${unusedFolders.length} potentially unused file folders (manual review recommended)`
  }
}