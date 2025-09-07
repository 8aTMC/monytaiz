import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OrphanedDataResult {
  category: string
  type: string
  count: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  items?: any[]
  size_bytes?: number
  recommendation: string
}

interface DetectionSummary {
  total_issues: number
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  potential_storage_saved: number
  categories: OrphanedDataResult[]
}

// Initialize Supabase client with admin privileges
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action = 'detect', include_items = false, dry_run = true } = await req.json().catch(() => ({}))

    console.log(`Starting orphaned data ${action} with dry_run: ${dry_run}`)

    if (action === 'detect') {
      const results = await detectOrphanedData(include_items)
      return new Response(JSON.stringify(results), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    } else if (action === 'cleanup') {
      const results = await cleanupOrphanedData(dry_run)
      return new Response(JSON.stringify(results), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }
  } catch (error) {
    console.error('Detection/cleanup error:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to process request',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function detectOrphanedData(includeItems: boolean = false): Promise<DetectionSummary> {
  const results: OrphanedDataResult[] = []
  let totalStorageSaved = 0

  console.log('Starting comprehensive orphaned data detection...')

  // 1. Media Analytics with no corresponding media
  try {
    const { data: orphanedAnalytics, error } = await supabase
      .from('media_analytics')
      .select('media_id, count(*)')
      .not('media_id', 'in', 
        supabase.from('simple_media').select('id')
      )

    if (!error && orphanedAnalytics?.length > 0) {
      results.push({
        category: 'Database',
        type: 'orphaned_media_analytics',
        count: orphanedAnalytics.length,
        severity: 'medium',
        description: 'Media analytics records referencing deleted media files',
        items: includeItems ? orphanedAnalytics : undefined,
        recommendation: 'Safe to delete - these are just analytics records'
      })
    }
  } catch (error) {
    console.error('Error checking orphaned analytics:', error)
  }

  // 2. Collection items with no corresponding media
  try {
    const { data: orphanedCollectionItems } = await supabase
      .rpc('cleanup_orphaned_records')
      .single()

    if (orphanedCollectionItems?.deleted_media_records > 0) {
      results.push({
        category: 'Database',
        type: 'orphaned_collection_items',
        count: orphanedCollectionItems.deleted_media_records,
        severity: 'medium',
        description: 'Collection items pointing to deleted media',
        recommendation: 'Safe to delete - prevents broken collection references'
      })
    }
  } catch (error) {
    console.error('Error checking orphaned collection items:', error)
  }

  // 3. Storage files without database records (recursive scan)
  try {
    const orphanedFiles = await findOrphanedStorageFiles('content', '')
    
    if (orphanedFiles.length > 0) {
      const totalSize = orphanedFiles.reduce((sum, f) => sum + f.size, 0)
      totalStorageSaved += totalSize
      
      results.push({
        category: 'Storage',
        type: 'orphaned_storage_files',
        count: orphanedFiles.length,
        severity: 'high',
        description: 'Storage files without corresponding database records',
        items: includeItems ? orphanedFiles : undefined,
        size_bytes: totalSize,
        recommendation: 'Review before deletion - could be recently uploaded files'
      })
    }
  } catch (error) {
    console.error('Error checking orphaned storage files:', error)
  }

  // 4. AI Jobs for deleted conversations/messages
  try {
    const { data: orphanedAIJobs } = await supabase
      .from('ai_jobs')
      .select(`
        id, 
        conversation_id, 
        message_id, 
        status,
        conversations!inner(id, status)
      `)
      .eq('conversations.status', 'pending_deletion')

    if (orphanedAIJobs?.length > 0) {
      results.push({
        category: 'Database',
        type: 'orphaned_ai_jobs',
        count: orphanedAIJobs.length,
        severity: 'low',
        description: 'AI jobs for conversations marked for deletion',
        items: includeItems ? orphanedAIJobs : undefined,
        recommendation: 'Safe to delete - conversations are being deleted'
      })
    }
  } catch (error) {
    console.error('Error checking orphaned AI jobs:', error)
  }

  // 5. Upload sessions for deleted users
  try {
    const { data: orphanedSessions } = await supabase
      .from('upload_sessions')
      .select(`
        id,
        user_id,
        created_at,
        profiles!inner(id, deletion_status)
      `)
      .eq('profiles.deletion_status', 'pending_deletion')

    if (orphanedSessions?.length > 0) {
      results.push({
        category: 'Database',
        type: 'orphaned_upload_sessions',
        count: orphanedSessions.length,
        severity: 'medium',
        description: 'Upload sessions for users marked for deletion',
        items: includeItems ? orphanedSessions : undefined,
        recommendation: 'Safe to delete - users are being deleted'
      })
    }
  } catch (error) {
    console.error('Error checking orphaned upload sessions:', error)
  }

  // 6. Old performance alerts (resolved > 30 days ago)
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: oldAlerts } = await supabase
      .from('performance_alerts')
      .select('id, resolved_at, title')
      .eq('resolved', true)
      .lt('resolved_at', thirtyDaysAgo)

    if (oldAlerts?.length > 0) {
      results.push({
        category: 'Database',
        type: 'old_performance_alerts',
        count: oldAlerts.length,
        severity: 'low',
        description: 'Resolved performance alerts older than 30 days',
        items: includeItems ? oldAlerts : undefined,
        recommendation: 'Archive instead of delete for historical analysis'
      })
    }
  } catch (error) {
    console.error('Error checking old alerts:', error)
  }

  // 7. Stale typing indicators (older than 1 hour)
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: staleTyping } = await supabase
      .from('typing_indicators')
      .select('conversation_id, user_id, updated_at')
      .lt('updated_at', oneHourAgo)

    if (staleTyping?.length > 0) {
      results.push({
        category: 'Database',
        type: 'stale_typing_indicators',
        count: staleTyping.length,
        severity: 'low',
        description: 'Typing indicators older than 1 hour',
        items: includeItems ? staleTyping : undefined,
        recommendation: 'Safe to delete - these are temporary UI indicators'
      })
    }
  } catch (error) {
    console.error('Error checking stale typing indicators:', error)
  }

  // 8. Quality metadata without corresponding media
  try {
    const { data: orphanedQuality, error } = await supabase
      .from('quality_metadata')
      .select('media_id')
      .not('media_id', 'in', 
        supabase.from('simple_media').select('id')
      )

    if (!error && orphanedQuality?.length > 0) {
      results.push({
        category: 'Database',
        type: 'orphaned_quality_metadata',
        count: orphanedQuality.length,
        severity: 'medium',
        description: 'Quality metadata for deleted media files',
        items: includeItems ? orphanedQuality : undefined,
        recommendation: 'Safe to delete - metadata for non-existent media'
      })
    }
  } catch (error) {
    console.error('Error checking orphaned quality metadata:', error)
  }

  // Calculate summary
  const severityCounts = results.reduce((acc, result) => {
    acc[result.severity]++
    return acc
  }, { critical: 0, high: 0, medium: 0, low: 0 })

  const summary: DetectionSummary = {
    total_issues: results.length,
    critical_count: severityCounts.critical,
    high_count: severityCounts.high,
    medium_count: severityCounts.medium,
    low_count: severityCounts.low,
    potential_storage_saved: totalStorageSaved,
    categories: results
  }

  console.log('Detection complete:', summary)
  return summary
}

// Helper function to recursively find orphaned storage files
async function findOrphanedStorageFiles(bucket: string, folder: string = '', maxFiles: number = 100): Promise<any[]> {
  const orphanedFiles = []
  const processedFiles = new Set()
  
  async function scanFolder(currentPath: string) {
    if (orphanedFiles.length >= maxFiles) return
    
    const { data: items, error } = await supabase.storage
      .from(bucket)
      .list(currentPath, { limit: 200, offset: 0 })
    
    if (error || !items) return
    
    for (const item of items) {
      if (orphanedFiles.length >= maxFiles) break
      
      const fullPath = currentPath ? `${currentPath}/${item.name}` : item.name
      
      // Skip if already processed
      if (processedFiles.has(fullPath)) continue
      processedFiles.add(fullPath)
      
      // Check if it's a file (has metadata and size) or folder
      const isFile = item.metadata && typeof item.metadata.size === 'number'
      const hasFileExtension = item.name.includes('.')
      
      if (isFile || hasFileExtension) {
        // This is a file - check if it's orphaned
        const isOrphaned = await isFileOrphaned(fullPath)
        if (isOrphaned) {
          orphanedFiles.push({
            name: fullPath,
            size: item.metadata?.size || 0,
            last_modified: item.updated_at
          })
        }
      } else {
        // This is likely a folder - scan it recursively
        await scanFolder(fullPath)
      }
    }
  }
  
  await scanFolder(folder)
  console.log(`Found ${orphanedFiles.length} orphaned files after scanning ${processedFiles.size} items`)
  return orphanedFiles
}

// Helper function to check if a file is orphaned
async function isFileOrphaned(filePath: string): Promise<boolean> {
  // Check in simple_media table
  const { data: mediaRecord } = await supabase
    .from('simple_media')
    .select('id')
    .or(`original_path.eq.${filePath},processed_path.eq.${filePath},thumbnail_path.eq.${filePath}`)
    .limit(1)

  if (mediaRecord?.length > 0) return false

  // Check in content_files table
  const { data: contentRecord } = await supabase
    .from('content_files')
    .select('id')
    .eq('file_path', filePath)
    .limit(1)

  if (contentRecord?.length > 0) return false

  // Check in legacy media table
  const { data: legacyMediaRecord } = await supabase
    .from('media')
    .select('id')
    .or(`storage_path.eq.${filePath},path.eq.${filePath}`)
    .limit(1)

  if (legacyMediaRecord?.length > 0) return false

  // File is orphaned
  return true
}

async function cleanupOrphanedData(dryRun: boolean = true): Promise<any> {
  const results = {
    dry_run: dryRun,
    cleaned_categories: [],
    errors: [],
    total_records_cleaned: 0,
    total_storage_freed: 0,
    storage_files_deleted: 0
  }

  console.log(`Starting orphaned data cleanup with dry_run: ${dryRun}`)

  try {
    // 1. Clean orphaned storage files first (most important for user's issue)
    if (!dryRun) {
      console.log('Starting orphaned storage file cleanup...')
      
      const orphanedFiles = await findOrphanedStorageFiles('content', '', 100)
      
      if (orphanedFiles.length > 0) {
        const filesToDelete = orphanedFiles.map(f => f.name)
        const storageSpaceFreed = orphanedFiles.reduce((sum, f) => sum + f.size, 0)
        
        console.log(`Deleting ${filesToDelete.length} orphaned storage files...`)
        
        const { data: deleteResult, error: deleteError } = await supabase.storage
          .from('content')
          .remove(filesToDelete)

        if (deleteError) {
          console.error('Storage file deletion error:', deleteError)
          results.errors.push({ step: 'storage_cleanup', error: deleteError.message })
        } else {
          console.log(`Successfully deleted ${filesToDelete.length} storage files`)
          results.cleaned_categories.push('orphaned_storage_files')
          results.storage_files_deleted = filesToDelete.length
          results.total_storage_freed = storageSpaceFreed
        }
      }
    }

    // 2. Clean orphaned media analytics
    if (!dryRun) {
      console.log('Cleaning orphaned media analytics...')
      const { error: analyticsError, count } = await supabase
        .from('media_analytics')
        .delete({ count: 'exact' })
        .not('media_id', 'in', 
          supabase.from('simple_media').select('id')
        )

      if (!analyticsError) {
        results.cleaned_categories.push('orphaned_media_analytics')
        results.total_records_cleaned += count || 0
      } else {
        results.errors.push({ step: 'analytics_cleanup', error: analyticsError.message })
      }
    }

    // 3. Clean stale typing indicators
    if (!dryRun) {
      console.log('Cleaning stale typing indicators...')
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { error: typingError, count } = await supabase
        .from('typing_indicators')
        .delete({ count: 'exact' })
        .lt('updated_at', oneHourAgo)

      if (!typingError) {
        results.cleaned_categories.push('stale_typing_indicators')
        results.total_records_cleaned += count || 0
      } else {
        results.errors.push({ step: 'typing_cleanup', error: typingError.message })
      }
    }

    // 4. Clean orphaned quality metadata
    if (!dryRun) {
      console.log('Cleaning orphaned quality metadata...')
      const { error: qualityError, count } = await supabase
        .from('quality_metadata')
        .delete({ count: 'exact' })
        .not('media_id', 'in', 
          supabase.from('simple_media').select('id')
        )

      if (!qualityError) {
        results.cleaned_categories.push('orphaned_quality_metadata')
        results.total_records_cleaned += count || 0
      } else {
        results.errors.push({ step: 'quality_cleanup', error: qualityError.message })
      }
    }

    // 5. Use existing cleanup function for comprehensive cleanup
    if (!dryRun) {
      console.log('Running comprehensive database cleanup...')
      const { data: cleanupResult } = await supabase.rpc('cleanup_corrupted_media')
      if (cleanupResult?.success) {
        results.cleaned_categories.push('corrupted_media_cleanup')
        results.total_records_cleaned += cleanupResult.deleted_media_records || 0
      }
    }

    console.log('Cleanup results:', results)
    return results

  } catch (error) {
    console.error('Cleanup error:', error)
    results.errors.push({ step: 'general_cleanup', error: error.message })
    return results
  }
}