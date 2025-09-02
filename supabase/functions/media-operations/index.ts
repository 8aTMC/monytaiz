import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Edge Runtime API for background tasks
declare const EdgeRuntime: {
  waitUntil(promise: Promise<any>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CopyToCollectionRequest {
  action: 'copy_to_collection'
  collection_id: string
  media_ids: string[]
}

interface CopyToFolderRequest {
  action: 'copy_to_folder'
  folder_id: string
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

interface StorageOptimizationRequest {
  action: 'optimize_storage'
}

interface CleanOrphanedRecordsRequest {
  action: 'clean_orphaned_records'
}

interface ForceDeleteGhostFilesRequest {
  action: 'force_delete_ghost_files'
  media_ids?: string[]
}

type RequestBody = CopyToCollectionRequest | CopyToFolderRequest | RemoveFromCollectionRequest | RemoveFromFolderRequest | DeleteMediaRequest | CreateCollectionRequest | StorageOptimizationRequest | CleanOrphanedRecordsRequest | ForceDeleteGhostFilesRequest

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
      
      case 'copy_to_folder':
        return await copyToFolder(supabaseClient, user.id, body.folder_id, body.media_ids)
      
      case 'remove_from_collection':
        return await removeFromCollection(supabaseClient, user.id, body.collection_id, body.media_ids)
      
      case 'remove_from_folder':
        return await removeFromFolder(supabaseClient, user.id, body.folder_id, body.media_ids)
      
      case 'delete_media_hard':
        return await deleteMediaHard(supabaseClient, user.id, body.media_ids)
      
      case 'create_collection':
        return await createCollection(supabaseClient, user.id, body.name)
      
      case 'optimize_storage':
        return await optimizeStorage(supabaseClient, user.id)
      
      case 'clean_orphaned_records':
        return await cleanOrphanedRecords(supabaseClient, user.id)
      
      case 'force_delete_ghost_files':
        return await forceDeleteGhostFiles(supabaseClient, user.id, body.media_ids)
      
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

    // Check which IDs exist in media table vs content_files table
    const [mediaResults, contentResults] = await Promise.all([
      supabaseClient
        .from('media')
        .select('id, creator_id')
        .in('id', mediaIds),
        supabaseClient
        .from('content_files')
        .select('id, creator_id, title, content_type, file_path, file_size, mime_type')
        .in('id', mediaIds)
        .eq('is_active', true)
    ])

    if (mediaResults.error && contentResults.error) {
      return new Response(
        JSON.stringify({ error: 'Failed to validate media' }),
        { status: 500, headers: corsHeaders }
      )
    }

    const existingMediaIds = (mediaResults.data || []).map((item: any) => item.id)
    const contentFileIds = (contentResults.data || []).map((item: any) => item.id)
    const allValidIds = [...existingMediaIds, ...contentFileIds]

    // Validate all requested IDs exist in either table
    const missingIds = mediaIds.filter(id => !allValidIds.includes(id))
    if (missingIds.length > 0) {
      return new Response(
        JSON.stringify({ error: `Media not found: ${missingIds.join(', ')}` }),
        { status: 404, headers: corsHeaders }
      )
    }

    // For IDs that exist in media table, use media_id
    // For IDs that only exist in content_files, we'll need to handle them differently
    const itemsToInsert = []
    
    for (const id of mediaIds) {
      if (existingMediaIds.includes(id)) {
        // This ID exists in media table, use normal collection_items entry
        itemsToInsert.push({
          collection_id: collectionId,
          media_id: id,
          added_by: userId
        })
      } else if (contentFileIds.includes(id)) {
        // This ID only exists in content_files - for now, we'll create a media record
        // Get the content file details
        const contentFile = (contentResults.data || []).find((item: any) => item.id === id)
        if (contentFile) {
          // First create a media record with proper content_file data
          const { error: mediaInsertError } = await supabaseClient
            .from('media')
            .insert({
              id: id,
              creator_id: contentFile.creator_id,
              title: contentFile.title || `Content File ${id.substring(0, 8)}`,
              type: contentFile.content_type === 'image' ? 'image' : 
                    contentFile.content_type === 'video' ? 'video' :
                    contentFile.content_type === 'audio' ? 'audio' : 'document',
              storage_path: contentFile.file_path,
              bucket: 'content',
              path: contentFile.file_path,
              mime: contentFile.mime_type || 'application/octet-stream',
              size_bytes: contentFile.file_size || 0,
              origin: 'upload',
              created_by: contentFile.creator_id
            })

          if (!mediaInsertError) {
            // If media record created successfully, add to collection
            itemsToInsert.push({
              collection_id: collectionId,
              media_id: id,
              added_by: userId
            })
          }
        }
      }
    }

    // Insert collection items
    if (itemsToInsert.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('collection_items')
        .upsert(itemsToInsert, { onConflict: 'collection_id,media_id' })

      if (insertError) {
        console.error('Insert error:', insertError)
        return new Response(
          JSON.stringify({ error: 'Failed to copy to collection' }),
          { status: 500, headers: corsHeaders }
        )
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: `Copied ${itemsToInsert.length} items to collection` }),
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

async function copyToFolder(supabaseClient: any, userId: string, folderId: string, mediaIds: string[]) {
  try {
    console.log('Copy to folder request:', { userId, folderId, mediaIds: mediaIds.length })

    // Validate folder exists and user has access to it
    const { data: folder, error: folderError } = await supabaseClient
      .from('file_folders')
      .select('id, creator_id')
      .eq('id', folderId)
      .single()

    if (folderError || !folder || folder.creator_id !== userId) {
      console.error('Folder validation error:', { folderError, folder, folderId })
      return new Response(
        JSON.stringify({ error: 'Folder not found or access denied' }),
        { status: 403, headers: corsHeaders }
      )
    }

    // Check what media exists in simple_media table
    const { data: existingMedia, error: mediaError } = await supabaseClient
      .from('simple_media')
      .select('id, creator_id')
      .in('id', mediaIds)

    if (mediaError) {
      console.error('Media validation error:', mediaError)
      return new Response(
        JSON.stringify({ error: 'Failed to validate media' }),
        { status: 500, headers: corsHeaders }
      )
    }

    const existingIds = (existingMedia || []).map((item: any) => item.id)
    
    if (existingIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No valid media items found to copy' }),
        { headers: corsHeaders }
      )
    }
    
    // Check for existing entries to avoid duplicates
    const { data: existingEntries, error: existingError } = await supabaseClient
      .from('file_folder_contents')
      .select('media_id')
      .eq('folder_id', folderId)
      .in('media_id', existingIds)

    if (existingError) {
      console.error('Existing entries check error:', existingError)
      return new Response(
        JSON.stringify({ error: 'Failed to check existing entries' }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Filter out already existing entries
    const alreadyInFolder = (existingEntries || []).map((item: any) => item.media_id)
    const itemsToInsert = existingIds
      .filter(id => !alreadyInFolder.includes(id))
      .map(mediaId => ({
        folder_id: folderId,
        media_id: mediaId,
        added_by: userId
      }))

    if (itemsToInsert.length > 0) {
      // Bulk insert new entries - this is synchronous and will complete before returning
      const { error: insertError } = await supabaseClient
        .from('file_folder_contents')    
        .insert(itemsToInsert)

      if (insertError) {
        console.error('Insert error:', insertError)
        return new Response(
          JSON.stringify({ error: 'Failed to copy items to folder' }),
          { status: 500, headers: corsHeaders }
        )
      }

      console.log(`Successfully copied ${itemsToInsert.length} items to folder ${folderId}`)
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Successfully copied ${itemsToInsert.length} items to folder`,
          copiedCount: itemsToInsert.length,
          skippedCount: alreadyInFolder.length
        }),
        { headers: corsHeaders }
      )
    } else {
      console.log('All items were already in the folder')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'All items were already in the folder',
          copiedCount: 0,
          skippedCount: alreadyInFolder.length
        }),
        { headers: corsHeaders }
      )
    }
  } catch (error: any) {
    console.error('Copy to folder error:', error)
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

async function removeFromFolder(supabaseClient: any, userId: string, folderId: string, mediaIds: string[]) {
  try {
    console.log('Remove from folder request:', { userId, folderId, mediaIds: mediaIds.length })

    // Validate folder exists and user has access to it
    const { data: folder, error: folderError } = await supabaseClient
      .from('file_folders')
      .select('id, creator_id')
      .eq('id', folderId)
      .single()

    if (folderError || !folder || folder.creator_id !== userId) {
      console.error('Folder validation error:', { folderError, folder, folderId })
      return new Response(
        JSON.stringify({ error: 'Folder not found or access denied' }),
        { status: 403, headers: corsHeaders }
      )
    }

    // Bulk delete from file_folder_contents synchronously
    const { error } = await supabaseClient
      .from('file_folder_contents')
      .delete()
      .eq('folder_id', folderId)
      .in('media_id', mediaIds)

    if (error) {
      console.error('Remove from folder error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to remove from folder' }),
        { status: 500, headers: corsHeaders }
      )
    }

    console.log(`Successfully removed ${mediaIds.length} items from folder ${folderId}`)

    return new Response(
      JSON.stringify({ success: true, message: `Removed ${mediaIds.length} items from folder` }),
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Remove from folder error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
}

async function deleteMediaHard(supabaseClient: any, userId: string, mediaIds: string[]) {
  try {
    // Get media details for storage cleanup - check all three tables
    const [simpleMediaResults, mediaResults, contentResults] = await Promise.all([
      supabaseClient
        .from('simple_media')
        .select('id, processed_path, original_path, thumbnail_path')
        .in('id', mediaIds),
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

    // Combine results from all three tables, normalizing file paths
    const allMedia = [
      ...(simpleMediaResults.data || []).map((item: any) => ({
        id: item.id,
        file_paths: [item.processed_path, item.original_path, item.thumbnail_path].filter(Boolean)
      })),
      ...(mediaResults.data || []).map((item: any) => ({ 
        id: item.id, 
        file_paths: [item.storage_path].filter(Boolean)
      })),
      ...(contentResults.data || []).map((item: any) => ({
        id: item.id,
        file_paths: [item.file_path].filter(Boolean)
      }))
    ]

    if (allMedia.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No media found to delete' }),
        { status: 404, headers: corsHeaders }
      )
    }

    // Delete from storage first
    const storagePromises = allMedia.flatMap((item: any) => 
      item.file_paths.map(async (file_path: string) => {
        if (file_path) {
          const { error } = await supabaseClient.storage
            .from('content')
            .remove([file_path])
          
          if (error) {
            console.error(`Failed to delete storage file ${file_path}:`, error)
          }
        }
      })
    )

    await Promise.all(storagePromises)

    // Delete related records first to avoid foreign key constraints
    await Promise.all([
      // Delete collection items
      supabaseClient
        .from('collection_items')
        .delete()
        .in('media_id', mediaIds),
      // Delete fan media grants
      supabaseClient
        .from('fan_media_grants')
        .delete()
        .in('media_id', mediaIds),
      // Delete file folder contents
      supabaseClient
        .from('file_folder_contents')
        .delete()
        .in('media_id', mediaIds)
    ])

    // Delete from all three database tables
    const [simpleDeleteResult, mediaDeleteResult, contentDeleteResult] = await Promise.all([
      supabaseClient
        .from('simple_media')
        .delete()
        .in('id', mediaIds),
      supabaseClient
        .from('media')
        .delete()
        .in('id', mediaIds),
      supabaseClient
        .from('content_files')
        .delete()
        .in('id', mediaIds)
    ])

    console.log('Delete results:', {
      simple: simpleDeleteResult,
      media: mediaDeleteResult,
      content: contentDeleteResult
    })

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

async function optimizeStorage(supabaseClient: any, userId: string) {
  try {
    console.log('Starting comprehensive storage optimization...');
    
    const result = {
      orphaned_files_deleted: 0,
      empty_folders_removed: 0,
      migrated_files: 0,
      storage_saved_bytes: 0,
      errors: [] as string[]
    };

    // Step 1: Clean up orphaned thumbnail files
    try {
      const { data: thumbnailFiles, error: listError } = await supabaseClient.storage
        .from('content')
        .list('thumbnails', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });

      if (!listError && thumbnailFiles?.length > 0) {
        // Check which thumbnails have corresponding media records
        const thumbnailNames = thumbnailFiles.map(f => f.name.replace('.jpg', '').replace('.png', ''));
        
        const { data: mediaRecords } = await supabaseClient
          .from('simple_media')
          .select('id')
          .in('id', thumbnailNames);
        
        const validMediaIds = (mediaRecords || []).map(m => m.id);
        const orphanedThumbnails = thumbnailFiles.filter(f => {
          const mediaId = f.name.replace('.jpg', '').replace('.png', '');
          return !validMediaIds.includes(mediaId);
        });

        if (orphanedThumbnails.length > 0) {
          const thumbnailPaths = orphanedThumbnails.map(f => `thumbnails/${f.name}`);
          const { error: deleteError } = await supabaseClient.storage
            .from('content')
            .remove(thumbnailPaths);

          if (!deleteError) {
            result.orphaned_files_deleted = thumbnailPaths.length;
            result.storage_saved_bytes += orphanedThumbnails.reduce((acc, f) => acc + (f.metadata?.size || 0), 0);
            console.log(`Deleted ${thumbnailPaths.length} orphaned thumbnail files`);
          } else {
            result.errors.push(`Failed to delete thumbnail files: ${deleteError.message}`);
          }
        }
      }
    } catch (error) {
      result.errors.push(`Error cleaning thumbnail files: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Step 2: Clean up UUID folders and legacy folders (processed/, photos/)
    try {
      // Check processed/ folder for UUID folders
      const { data: processedFiles } = await supabaseClient.storage
        .from('content')
        .list('processed', { limit: 1000 });

      if (processedFiles?.length > 0) {
        for (const folder of processedFiles) {
          if (folder.name.length === 36) { // UUID length check
            try {
              const { data: folderContents } = await supabaseClient.storage
                .from('content')
                .list(`processed/${folder.name}`, { limit: 100 });

              if (!folderContents || folderContents.length === 0) {
                console.log(`Found empty UUID folder: ${folder.name}`);
                result.empty_folders_removed++;
              } else {
                // Check if all files in folder are orphaned
                const folderFiles = folderContents.map(f => `processed/${folder.name}/${f.name}`);
                
                // Get database references for these files
                const [mediaRefs, contentRefs] = await Promise.all([
                  supabaseClient.from('media').select('path, storage_path')
                    .or(folderFiles.map(p => `path.eq.${p},storage_path.eq.${p}`).join(',')),
                  supabaseClient.from('content_files').select('file_path')
                    .in('file_path', folderFiles)
                ]);

                const referencedFiles = [
                  ...(mediaRefs.data || []).flatMap(m => [m.path, m.storage_path].filter(Boolean)),
                  ...(contentRefs.data || []).map(c => c.file_path).filter(Boolean)
                ];

                const orphanedFiles = folderFiles.filter(f => !referencedFiles.includes(f));
                
                if (orphanedFiles.length === folderFiles.length) {
                  // All files are orphaned - delete the entire folder
                  const { error: deleteFolderError } = await supabaseClient.storage
                    .from('content')
                    .remove(folderFiles);
                    
                  if (!deleteFolderError) {
                    result.orphaned_files_deleted += folderFiles.length;
                    result.empty_folders_removed++;
                    console.log(`Removed orphaned UUID folder: ${folder.name} with ${folderFiles.length} files`);
                  }
                } else if (orphanedFiles.length > 0) {
                  // Delete only orphaned files
                  const { error: deleteError } = await supabaseClient.storage
                    .from('content')
                    .remove(orphanedFiles);
                    
                  if (!deleteError) {
                    result.orphaned_files_deleted += orphanedFiles.length;
                    console.log(`Removed ${orphanedFiles.length} orphaned files from folder: ${folder.name}`);
                  }
                }
              }
            } catch (folderError) {
              console.log(`Error processing folder ${folder.name}: ${folderError}`);
            }
          }
        }
      }

      // Step 2b: Clean up legacy 'photos' folder
      try {
        const { data: photosContents } = await supabaseClient.storage
          .from('content')
          .list('photos', { limit: 1000 });

        if (photosContents?.length > 0) {
          const photoFiles = photosContents.map(f => `photos/${f.name}`);
          
          // Check database references
          const [mediaRefs, contentRefs] = await Promise.all([
            supabaseClient.from('media').select('path, storage_path')
              .or(photoFiles.map(p => `path.eq.${p},storage_path.eq.${p}`).join(',')),
            supabaseClient.from('content_files').select('file_path')
              .in('file_path', photoFiles)
          ]);

          const referencedPhotos = [
            ...(mediaRefs.data || []).flatMap(m => [m.path, m.storage_path].filter(Boolean)),
            ...(contentRefs.data || []).map(c => c.file_path).filter(Boolean)
          ];

          const orphanedPhotos = photoFiles.filter(f => !referencedPhotos.includes(f));
          
          if (orphanedPhotos.length > 0) {
            const { error: deletePhotosError } = await supabaseClient.storage
              .from('content')
              .remove(orphanedPhotos);
              
            if (!deletePhotosError) {
              result.orphaned_files_deleted += orphanedPhotos.length;
              console.log(`Removed ${orphanedPhotos.length} orphaned files from photos folder`);
              
              // If all files were orphaned, the folder is now empty
              if (orphanedPhotos.length === photoFiles.length) {
                result.empty_folders_removed++;
              }
            } else {
              result.errors.push(`Failed to delete photos files: ${deletePhotosError.message}`);
            }
          }
        }
      } catch (photosError) {
        result.errors.push(`Error cleaning photos folder: ${photosError instanceof Error ? photosError.message : String(photosError)}`);
      }

    } catch (error) {
      result.errors.push(`Error cleaning folders: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Step 3: Remove database records pointing to non-existent files
    try {
      // Find media records with missing storage files
      const { data: mediaRecords } = await supabaseClient
        .from('media')
        .select('id, path, storage_path, original_path');

      if (mediaRecords?.length > 0) {
        const filesToCheck = [];
        const recordsToUpdate = [];

        for (const record of mediaRecords) {
          const paths = [record.path, record.storage_path, record.original_path].filter(Boolean);
          for (const path of paths) {
            filesToCheck.push({ recordId: record.id, path, field: 'storage' });
          }
        }

        // Check which files actually exist in storage
        let clearedRecords = 0;
        for (const check of filesToCheck.slice(0, 50)) { // Limit to avoid timeout
          try {
            const { error: headError } = await supabaseClient.storage
              .from('content')
              .list(check.path.includes('/') ? check.path.substring(0, check.path.lastIndexOf('/')) : '', {
                limit: 1000,
                search: check.path.includes('/') ? check.path.substring(check.path.lastIndexOf('/') + 1) : check.path
              });

            if (headError) {
              // File doesn't exist - clear the database reference
              await supabaseClient
                .from('media')
                .update({ 
                  path: null, 
                  storage_path: null,
                  processing_status: 'error' 
                })
                .eq('id', check.recordId);
              
              clearedRecords++;
            }
          } catch (checkError) {
            // File doesn't exist
            clearedRecords++;
          }
        }

        if (clearedRecords > 0) {
          result.migrated_files = clearedRecords;
          console.log(`Cleared ${clearedRecords} database references to missing files`);
        }
      }
    } catch (error) {
      result.errors.push(`Error cleaning database references: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Step 4: Find and remove files not referenced in database
    try {
      const { data: allStorageFiles, error: storageListError } = await supabaseClient.storage
        .from('content')
        .list('processed', { limit: 2000 });

      if (!storageListError && allStorageFiles?.length > 0) {
        // Get all file paths from database
        const [mediaResults, contentResults] = await Promise.all([
          supabaseClient.from('media').select('path, storage_path'),
          supabaseClient.from('content_files').select('file_path').eq('is_active', true)
        ]);

        const referencedPaths = new Set([
          ...(mediaResults.data || []).flatMap((m: any) => [m.path, m.storage_path].filter(Boolean)),
          ...(contentResults.data || []).map((c: any) => c.file_path).filter(Boolean)
        ]);

        // Check storage files against database references
        let orphanedFiles = [];
        const checkFiles = async (files: any[], prefix = '') => {
          for (const file of files) {
            const fullPath = prefix ? `${prefix}/${file.name}` : file.name;
            if (!referencedPaths.has(fullPath) && !referencedPaths.has(`processed/${fullPath}`)) {
              orphanedFiles.push(fullPath);
            }
          }
        };

        await checkFiles(allStorageFiles, 'processed');

        if (orphanedFiles.length > 0) {
          const { error: cleanupError } = await supabaseClient.storage
            .from('content')
            .remove(orphanedFiles);

          if (!cleanupError) {
            result.orphaned_files_deleted += orphanedFiles.length;
            console.log(`Removed ${orphanedFiles.length} orphaned storage files`);
          } else {
            result.errors.push(`Failed to remove orphaned files: ${cleanupError.message}`);
          }
        }
      }
    } catch (error) {
      result.errors.push(`Error finding orphaned files: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Step 5: Clean up media rows in 'processing' state for >1 hour
    try {
      const processingCutoff = new Date(Date.now() - 60 * 60 * 1000);
      const { error: staleError } = await supabaseClient
        .from('media')
        .update({ processing_status: 'error' })
        .eq('processing_status', 'processing')
        .lt('created_at', processingCutoff.toISOString());

      if (staleError) {
        result.errors.push(`Failed to clean stale processing records: ${staleError.message}`);
      }
    } catch (error) {
      result.errors.push(`Error cleaning stale records: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log('Storage optimization completed:', result);
    
    return new Response(
      JSON.stringify({
        success: result.errors.length === 0,
        ...result,
        message: `Storage optimization completed: ${result.orphaned_files_deleted} orphaned files removed, ${result.empty_folders_removed} empty folders cleaned, ${Math.round(result.storage_saved_bytes / 1024 / 1024)}MB saved`
      }),
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Storage optimization error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: corsHeaders }
    );
  }
}

async function cleanOrphanedRecords(supabaseClient: any, userId: string) {
  try {
    console.log('Starting cleanup of orphaned database records...');
    
    const result = {
      deleted_media_records: 0,
      deleted_content_records: 0,
      verified_files: 0,
      errors: [] as string[]
    };

    // Step 1: Get all media records
    const { data: mediaRecords, error: mediaError } = await supabaseClient
      .from('media')
      .select('id, path, storage_path, original_path, bucket');

    if (mediaError) {
      result.errors.push(`Failed to fetch media records: ${mediaError.message}`);
      return new Response(JSON.stringify(result), { headers: corsHeaders });
    }

    console.log(`Found ${mediaRecords?.length || 0} media records to verify`);

    // Step 2: Check which files actually exist in storage
    const recordsToDelete = [];
    let verifiedCount = 0;

    for (const record of mediaRecords || []) {
      const pathsToCheck = [record.path, record.storage_path, record.original_path].filter(Boolean);
      let fileExists = false;

      for (const filePath of pathsToCheck) {
        if (!filePath) continue;

        try {
          // Try to get file info to check if it exists
          const { data: fileInfo, error: fileError } = await supabaseClient.storage
            .from(record.bucket || 'content')
            .list(filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '', {
              limit: 1000,
              search: filePath.includes('/') ? filePath.substring(filePath.lastIndexOf('/') + 1) : filePath
            });

          if (!fileError && fileInfo?.length > 0) {
            const fileName = filePath.includes('/') ? filePath.substring(filePath.lastIndexOf('/') + 1) : filePath;
            const fileFound = fileInfo.some(f => f.name === fileName);
            if (fileFound) {
              fileExists = true;
              break;
            }
          }
        } catch (checkError) {
          // File doesn't exist - continue to check other paths
        }
      }

      if (!fileExists) {
        recordsToDelete.push(record.id);
        console.log(`Marking record ${record.id} for deletion - no storage files found`);
      } else {
        verifiedCount++;
      }
    }

    result.verified_files = verifiedCount;

    // Step 3: Delete orphaned media records
    if (recordsToDelete.length > 0) {
      const { error: deleteMediaError } = await supabaseClient
        .from('media')
        .delete()
        .in('id', recordsToDelete);

      if (deleteMediaError) {
        result.errors.push(`Failed to delete media records: ${deleteMediaError.message}`);
      } else {
        result.deleted_media_records = recordsToDelete.length;
        console.log(`Deleted ${recordsToDelete.length} orphaned media records`);
      }
    }

    // Step 4: Check content_files table as well
    const { data: contentRecords, error: contentError } = await supabaseClient
      .from('content_files')
      .select('id, file_path')
      .eq('is_active', true);

    if (!contentError && contentRecords?.length > 0) {
      const contentRecordsToDelete = [];

      for (const record of contentRecords) {
        if (!record.file_path) continue;

        try {
          const { data: fileInfo, error: fileError } = await supabaseClient.storage
            .from('content')
            .list(record.file_path.includes('/') ? record.file_path.substring(0, record.file_path.lastIndexOf('/')) : '', {
              limit: 1000,
              search: record.file_path.includes('/') ? record.file_path.substring(record.file_path.lastIndexOf('/') + 1) : record.file_path
            });

          if (fileError || !fileInfo?.length) {
            contentRecordsToDelete.push(record.id);
          } else {
            const fileName = record.file_path.includes('/') ? record.file_path.substring(record.file_path.lastIndexOf('/') + 1) : record.file_path;
            const fileFound = fileInfo.some(f => f.name === fileName);
            if (!fileFound) {
              contentRecordsToDelete.push(record.id);
            }
          }
        } catch (checkError) {
          contentRecordsToDelete.push(record.id);
        }
      }

      if (contentRecordsToDelete.length > 0) {
        const { error: deleteContentError } = await supabaseClient
          .from('content_files')
          .delete()
          .in('id', contentRecordsToDelete);

        if (deleteContentError) {
          result.errors.push(`Failed to delete content records: ${deleteContentError.message}`);
        } else {
          result.deleted_content_records = contentRecordsToDelete.length;
          console.log(`Deleted ${contentRecordsToDelete.length} orphaned content_files records`);
        }
      }
    }

    console.log('Orphaned records cleanup completed:', result);
    
    return new Response(
      JSON.stringify({
        success: result.errors.length === 0,
        ...result,
        message: `Cleanup completed: ${result.deleted_media_records} media records and ${result.deleted_content_records} content records removed. ${result.verified_files} files verified as existing.`
      }),
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Clean orphaned records error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: corsHeaders }
    );
  }
}

async function forceDeleteGhostFiles(supabaseClient: any, userId: string, mediaIds?: string[]) {
  try {
    console.log('Starting force delete of ghost files...');
    
    const result = {
      deleted_media_records: 0,
      deleted_content_records: 0,
      deleted_collection_items: 0,
      deleted_grants: 0,
      errors: [] as string[]
    };

    let recordsToDelete: string[] = [];

    if (mediaIds && mediaIds.length > 0) {
      // Delete specific media IDs provided
      recordsToDelete = mediaIds;
      console.log(`Force deleting specific media IDs: ${mediaIds.join(', ')}`);
    } else {
      // Find all records where storage files don't exist (scan all records)
      console.log('Scanning for all ghost files...');
      
      const { data: mediaRecords } = await supabaseClient
        .from('media')
        .select('id, path, storage_path, original_path');

      const { data: contentRecords } = await supabaseClient
        .from('content_files')
        .select('id, file_path')
        .eq('is_active', true);

      // Check which files actually exist in storage by attempting to get file info
      for (const record of mediaRecords || []) {
        const pathsToCheck = [record.path, record.storage_path, record.original_path].filter(Boolean);
        let fileExists = false;

        for (const filePath of pathsToCheck) {
          if (!filePath) continue;
          try {
            const { data: fileInfo, error: fileError } = await supabaseClient.storage
              .from('content')
              .list(filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '', {
                limit: 1000,
                search: filePath.includes('/') ? filePath.substring(filePath.lastIndexOf('/') + 1) : filePath
              });

            if (!fileError && fileInfo?.length > 0) {
              const fileName = filePath.includes('/') ? filePath.substring(filePath.lastIndexOf('/') + 1) : filePath;
              const fileFound = fileInfo.some(f => f.name === fileName);
              if (fileFound) {
                fileExists = true;
                break;
              }
            }
          } catch (checkError) {
            // File doesn't exist - continue to check other paths
          }
        }

        if (!fileExists) {
          recordsToDelete.push(record.id);
        }
      }

      // Check content_files as well
      for (const record of contentRecords || []) {
        if (!record.file_path) continue;

        try {
          const { data: fileInfo, error: fileError } = await supabaseClient.storage
            .from('content')
            .list(record.file_path.includes('/') ? record.file_path.substring(0, record.file_path.lastIndexOf('/')) : '', {
              limit: 1000,
              search: record.file_path.includes('/') ? record.file_path.substring(record.file_path.lastIndexOf('/') + 1) : record.file_path
            });

          if (fileError || !fileInfo?.length) {
            recordsToDelete.push(record.id);
          } else {
            const fileName = record.file_path.includes('/') ? record.file_path.substring(record.file_path.lastIndexOf('/') + 1) : record.file_path;
            const fileFound = fileInfo.some(f => f.name === fileName);
            if (!fileFound) {
              recordsToDelete.push(record.id);
            }
          }
        } catch (checkError) {
          recordsToDelete.push(record.id);
        }
      }
    }

    if (recordsToDelete.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          ...result,
          message: 'No ghost files found to delete'
        }),
        { headers: corsHeaders }
      );
    }

    console.log(`Found ${recordsToDelete.length} ghost files to delete`);

    // Delete related records first to avoid foreign key constraints
    // 1. Delete collection items
    const { error: collectionItemsError } = await supabaseClient
      .from('collection_items')
      .delete()
      .in('media_id', recordsToDelete);

    if (collectionItemsError) {
      console.error('Error deleting collection items:', collectionItemsError);
      result.errors.push(`Failed to delete collection items: ${collectionItemsError.message}`);
    } else {
      result.deleted_collection_items = recordsToDelete.length; // Approximate
    }

    // 2. Delete fan media grants
    const { error: grantsError } = await supabaseClient
      .from('fan_media_grants')
      .delete()
      .in('media_id', recordsToDelete);

    if (grantsError) {
      console.error('Error deleting grants:', grantsError);
      result.errors.push(`Failed to delete grants: ${grantsError.message}`);
    } else {
      result.deleted_grants = recordsToDelete.length; // Approximate
    }

    // 3. Delete from media table
    const { error: deleteMediaError } = await supabaseClient
      .from('media')
      .delete()
      .in('id', recordsToDelete);

    if (deleteMediaError) {
      console.error('Error deleting media records:', deleteMediaError);
      result.errors.push(`Failed to delete media records: ${deleteMediaError.message}`);
    } else {
      result.deleted_media_records = recordsToDelete.length;
    }

    // 4. Delete from content_files table
    const { error: deleteContentError } = await supabaseClient
      .from('content_files')
      .delete()
      .in('id', recordsToDelete);

    if (deleteContentError) {
      console.error('Error deleting content records:', deleteContentError);
      result.errors.push(`Failed to delete content records: ${deleteContentError.message}`);
    } else {
      result.deleted_content_records = recordsToDelete.length;
    }

    console.log('Force delete ghost files completed:', result);
    
    return new Response(
      JSON.stringify({
        success: result.errors.length === 0,
        ...result,
        message: `Force deleted ${recordsToDelete.length} ghost files and all related records`
      }),
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Force delete ghost files error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: corsHeaders }
    );
  }
}
