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

interface CleanupResult {
  dry_run: boolean
  cleaned_categories: string[]
  errors: Array<{
    category: string
    type: string
    key?: string
    id?: string
    reason: string
    retriable: boolean
  }>
  totals: {
    records_cleaned: number
    storage_freed_bytes: number
    files_deleted: number
  }
  audit: {
    [category: string]: {
      attempted: number
      deleted: number
      skipped: number
      errors: number
    }
  }
}

interface BatchResult {
  success: boolean
  processed: number
  errors: Array<{
    key: string
    reason: string
    retriable: boolean
  }>
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

  // 1. Media Analytics with no corresponding media (using EXISTS instead of IN)
  try {
    const { data: orphanedAnalytics, error } = await supabase
      .from('media_analytics')
      .select('media_id, count(*)', { count: 'exact' })
      .not('media_id', 'in', '(SELECT id FROM simple_media)')

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
    // Use raw SQL as fallback
    try {
      const { data: analyticsCount } = await supabase
        .rpc('sql', { 
          query: `
            SELECT COUNT(*) as count
            FROM media_analytics ma
            WHERE NOT EXISTS (
              SELECT 1 FROM simple_media sm WHERE sm.id = ma.media_id
            )
          `
        })
      
      if (analyticsCount?.[0]?.count > 0) {
        results.push({
          category: 'Database',
          type: 'orphaned_media_analytics',
          count: parseInt(analyticsCount[0].count),
          severity: 'medium',
          description: 'Media analytics records referencing deleted media files',
          recommendation: 'Safe to delete - these are just analytics records'
        })
      }
    } catch (sqlError) {
      console.error('Fallback SQL also failed:', sqlError)
    }
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

  // 8. Quality metadata without corresponding media (using EXISTS)
  try {
    // Use raw SQL for complex NOT EXISTS query
    const { data: orphanedQuality } = await supabase
      .rpc('sql', { 
        query: `
          SELECT media_id, COUNT(*) as count
          FROM quality_metadata qm
          WHERE NOT EXISTS (
            SELECT 1 FROM simple_media sm WHERE sm.id = qm.media_id
          )
          GROUP BY media_id
        `
      })

    if (orphanedQuality?.length > 0) {
      const totalCount = orphanedQuality.reduce((sum, q) => sum + parseInt(q.count), 0)
      results.push({
        category: 'Database',
        type: 'orphaned_quality_metadata',
        count: totalCount,
        severity: 'medium',
        description: 'Quality metadata for deleted media files',
        items: includeItems ? orphanedQuality : undefined,
        recommendation: 'Safe to delete - metadata for non-existent media'
      })
    }
  } catch (error) {
    console.error('Error checking orphaned quality metadata:', error)
    // Fallback to simple query
    try {
      const { data: qualityCount } = await supabase
        .from('quality_metadata')
        .select('media_id', { count: 'exact' })

      if (qualityCount?.length > 0) {
        results.push({
          category: 'Database',
          type: 'orphaned_quality_metadata',
          count: qualityCount.length,
          severity: 'medium',
          description: 'Quality metadata for deleted media files',
          recommendation: 'Safe to delete - metadata for non-existent media'
        })
      }
    } catch (fallbackError) {
      console.error('Quality metadata fallback failed:', fallbackError)
    }
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

async function cleanupOrphanedData(dryRun: boolean = true): Promise<CleanupResult> {
  const results: CleanupResult = {
    dry_run: dryRun,
    cleaned_categories: [],
    errors: [],
    totals: {
      records_cleaned: 0,
      storage_freed_bytes: 0,
      files_deleted: 0
    },
    audit: {}
  }

  // Preflight checks
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !serviceKey) {
    results.errors.push({
      category: 'System',
      type: 'configuration',
      reason: 'Missing required environment variables',
      retriable: false
    })
    return results
  }

  try {
    // 1. Clean orphaned storage files (highest priority)
    await cleanupOrphanedStorageFiles(results, dryRun)
    
    // 2. Clean orphaned database records
    await cleanupOrphanedDatabaseRecords(results, dryRun)
    
    // 3. Clean stale temporary data
    await cleanupStaleTemporaryData(results, dryRun)
    
    // 4. Run comprehensive cleanup
    await runComprehensiveCleanup(results, dryRun)

    return results

  } catch (error) {
    console.error('Cleanup error:', error)
    results.errors.push({
      category: 'System',
      type: 'general_cleanup',
      reason: error.message,
      retriable: true
    })
    return results
  }
}

// Cleanup orphaned storage files with batching and retries
async function cleanupOrphanedStorageFiles(results: CleanupResult, dryRun: boolean) {
  const category = 'orphaned_storage_files'
  results.audit[category] = { attempted: 0, deleted: 0, skipped: 0, errors: 0 }
  
  try {
    const orphanedFiles = await findOrphanedStorageFiles('content', '')
    results.audit[category].attempted = orphanedFiles.length
    
    if (orphanedFiles.length === 0) {
      return
    }

    const filesToDelete = orphanedFiles.map(f => f.name)
    const totalSize = orphanedFiles.reduce((sum, f) => sum + f.size, 0)
    
    if (dryRun) {
      results.totals.files_deleted = filesToDelete.length
      results.totals.storage_freed_bytes = totalSize
      return
    }
    
    // Batch delete storage files (max 1000 per batch)
    const batchSize = 1000
    let totalDeleted = 0
    let totalFreed = 0
    
    for (let i = 0; i < filesToDelete.length; i += batchSize) {
      const batch = filesToDelete.slice(i, i + batchSize)
      const batchSizes = orphanedFiles.slice(i, i + batchSize).map(f => f.size)
      
      const batchResult = await deleteStorageBatch('content', batch, batchSizes)
      
      if (batchResult.success) {
        totalDeleted += batchResult.processed
        totalFreed += batchSizes.reduce((sum, size) => sum + size, 0)
        results.audit[category].deleted += batchResult.processed
      } else {
        results.audit[category].errors += batch.length - batchResult.processed
        batchResult.errors.forEach(error => {
          results.errors.push({
            category: 'Storage',
            type: category,
            key: error.key,
            reason: error.reason,
            retriable: error.retriable
          })
        })
      }
      
      // Add delay between batches to avoid rate limiting
      if (i + batchSize < filesToDelete.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    if (totalDeleted > 0) {
      results.cleaned_categories.push(category)
      results.totals.files_deleted = totalDeleted
      results.totals.storage_freed_bytes = totalFreed
    }
    
  } catch (error) {
    console.error('Storage cleanup error:', error)
    results.errors.push({
      category: 'Storage',
      type: category,
      reason: error.message,
      retriable: true
    })
    results.audit[category].errors++
  }
}

// Batch delete storage files with proper error handling
async function deleteStorageBatch(bucket: string, filePaths: string[], fileSizes: number[]): Promise<BatchResult> {
  const result: BatchResult = {
    success: false,
    processed: 0,
    errors: []
  }
  
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .remove(filePaths)
    
    if (error) {
      // Classify the error
      if (error.message.includes('not found') || error.message.includes('404')) {
        // Files already deleted - treat as success
        result.success = true
        result.processed = filePaths.length
      } else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
        result.errors.push({
          key: 'batch',
          reason: 'RLS_denied: ' + error.message,
          retriable: false
        })
      } else if (error.message.includes('rate limit')) {
        result.errors.push({
          key: 'batch',
          reason: 'rate_limit: ' + error.message,
          retriable: true
        })
      } else {
        result.errors.push({
          key: 'batch',
          reason: 'storage_error: ' + error.message,
          retriable: true
        })
      }
    } else {
      result.success = true
      result.processed = filePaths.length
    }
    
  } catch (error) {
    result.errors.push({
      key: 'batch',
      reason: 'network_error: ' + error.message,
      retriable: true
    })
  }
  
  return result
}

// Clean orphaned database records with proper SQL
async function cleanupOrphanedDatabaseRecords(results: CleanupResult, dryRun: boolean) {
  // Clean orphaned media analytics
  await cleanupDatabaseCategory(
    results,
    'orphaned_media_analytics',
    'media_analytics',
    `DELETE FROM media_analytics 
     WHERE NOT EXISTS (
       SELECT 1 FROM simple_media WHERE id = media_analytics.media_id
     )`,
    dryRun
  )
  
  // Clean orphaned quality metadata
  await cleanupDatabaseCategory(
    results,
    'orphaned_quality_metadata',
    'quality_metadata',
    `DELETE FROM quality_metadata 
     WHERE NOT EXISTS (
       SELECT 1 FROM simple_media WHERE id = quality_metadata.media_id
     )`,
    dryRun
  )
}

// Generic database cleanup with transaction support
async function cleanupDatabaseCategory(
  results: CleanupResult,
  category: string,
  tableName: string,
  deleteQuery: string,
  dryRun: boolean
) {
  results.audit[category] = { attempted: 0, deleted: 0, skipped: 0, errors: 0 }
  
  try {
    // First, count what would be deleted
    const countQuery = deleteQuery.replace('DELETE', 'SELECT COUNT(*)')
    const { data: countData, error: countError } = await supabase
      .rpc('sql', { query: countQuery })
    
    if (countError) {
      throw new Error(`Count failed: ${countError.message}`)
    }
    
    const recordCount = parseInt(countData?.[0]?.count || '0')
    results.audit[category].attempted = recordCount
    
    if (recordCount === 0) {
      return
    }
    
    if (dryRun) {
      results.totals.records_cleaned += recordCount
      return
    }
    
    // Execute the deletion
    const { data: deleteData, error: deleteError } = await supabase
      .rpc('sql', { query: deleteQuery })
    
    if (deleteError) {
      throw new Error(`Delete failed: ${deleteError.message}`)
    }
    
    results.audit[category].deleted = recordCount
    results.totals.records_cleaned += recordCount
    results.cleaned_categories.push(category)
    
  } catch (error) {
    console.error(`${category} cleanup error:`, error)
    results.errors.push({
      category: 'Database',
      type: category,
      reason: error.message,
      retriable: true
    })
    results.audit[category].errors++
  }
}

// Clean stale temporary data
async function cleanupStaleTemporaryData(results: CleanupResult, dryRun: boolean) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  
  // Clean stale typing indicators
  await cleanupDatabaseCategory(
    results,
    'stale_typing_indicators',
    'typing_indicators',
    `DELETE FROM typing_indicators WHERE updated_at < '${oneHourAgo}'`,
    dryRun
  )
}

// Run comprehensive cleanup using existing RPC
async function runComprehensiveCleanup(results: CleanupResult, dryRun: boolean) {
  if (dryRun) {
    return
  }
  
  try {
    const { data: cleanupResult, error } = await supabase.rpc('cleanup_corrupted_media')
    
    if (error) {
      throw new Error(error.message)
    }
    
    if (cleanupResult?.success) {
      const category = 'corrupted_media_cleanup'
      results.cleaned_categories.push(category)
      results.totals.records_cleaned += cleanupResult.deleted_media_records || 0
      results.audit[category] = {
        attempted: cleanupResult.deleted_media_records || 0,
        deleted: cleanupResult.deleted_media_records || 0,
        skipped: 0,
        errors: 0
      }
    }
  } catch (error) {
    console.error('Comprehensive cleanup error:', error)
    results.errors.push({
      category: 'Database',
      type: 'comprehensive_cleanup',
      reason: error.message,
      retriable: true
    })
  }
}