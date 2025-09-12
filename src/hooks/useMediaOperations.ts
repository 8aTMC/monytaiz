import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface MediaItem {
  id: string
  title?: string
  type: 'image' | 'video' | 'audio' | 'gif' | 'document'
  storage_path: string
  created_at: string
}

export interface Collection {
  id: string
  name: string
  system: boolean
  system_key?: string
}

export const useMediaOperations = (callbacks?: {
  onRefreshNeeded?: () => void;
  onCountsRefreshNeeded?: (affectedFolderIds?: string[]) => void;
}) => {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const copyToCollection = async (collectionId: string, mediaIds: string[]) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('media-operations', {
        body: {
          action: 'copy_to_collection',
          collection_id: collectionId,
          media_ids: mediaIds
        }
      })

      if (error) throw error

      toast({
        title: "Success",
        description: data.message || `Copied ${mediaIds.length} items to collection`,
        duration: 3000
      })

      // Trigger refresh of content and counts
      callbacks?.onRefreshNeeded?.()
      callbacks?.onCountsRefreshNeeded?.()

      return data
    } catch (error: any) {
      console.error('Copy to collection error:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to copy to collection",
        variant: "destructive"
      })
      throw error
    } finally {
      setLoading(false)
    }
  }

  const removeFromCollection = async (collectionId: string, mediaIds: string[]) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('media-operations', {
        body: {
          action: 'remove_from_collection',
          collection_id: collectionId,
          media_ids: mediaIds
        }
      })

      if (error) throw error

      toast({
        title: "Success",
        description: data.message || `Removed ${mediaIds.length} items from collection`,
        duration: 3000
      })

      // Trigger refresh of content and counts
      callbacks?.onRefreshNeeded?.()
      callbacks?.onCountsRefreshNeeded?.()

      return data
    } catch (error: any) {
      console.error('Remove from collection error:', error)
      toast({
        title: "Error", 
        description: error.message || "Failed to remove from collection",
        variant: "destructive"
      })
      throw error
    } finally {
      setLoading(false)
    }
  }

  const removeFromFolder = async (folderId: string, mediaIds: string[]) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('media-operations', {
        body: {
          action: 'remove_from_folder',
          folder_id: folderId,
          media_ids: mediaIds
        }
      })

      if (error) throw error

      toast({
        title: "Success",
        description: data.message || `Removed ${mediaIds.length} items from folder`,
        duration: 3000
      })

      // Trigger refresh of content and counts
      callbacks?.onRefreshNeeded?.()
      callbacks?.onCountsRefreshNeeded?.([folderId])

      return data
    } catch (error: any) {
      console.error('Remove from folder error:', error)
      toast({
        title: "Error", 
        description: error.message || "Failed to remove from folder",
        variant: "destructive"
      })
      throw error
    } finally {
      setLoading(false)
    }
  }

  const deleteMediaHard = async (
    mediaIds: string[], 
    onProgress?: (deletedCount: number, totalCount: number) => void
  ) => {
    setLoading(true)
    const totalFiles = mediaIds.length;
    const batchSize = 5; // Process in batches to show progress
    let deletedCount = 0;
    
    try {
      // Process files in batches
      for (let i = 0; i < mediaIds.length; i += batchSize) {
        const batch = mediaIds.slice(i, i + batchSize);
        
        const { data, error } = await supabase.functions.invoke('media-operations', {
          body: {
            action: 'delete_media_hard',
            media_ids: batch
          }
        })

        if (error) throw error
        
        deletedCount += batch.length;
        onProgress?.(deletedCount, totalFiles);
        
        // Small delay to show progress
        if (i + batchSize < mediaIds.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      toast({
        title: "Success",
        description: `Permanently deleted ${totalFiles} files`,
        duration: 3000
      })

      // Trigger refresh of content and counts  
      callbacks?.onRefreshNeeded?.()
      // Don't refresh folder structure for deletions, only refresh counts
      callbacks?.onCountsRefreshNeeded?.()

      return { success: true, deleted_count: totalFiles };
    } catch (error: any) {
      console.error('Delete media error:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete media",
        variant: "destructive"
      })
      throw error
    } finally {
      setLoading(false)
    }
  }

  const createCollection = async (name: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('media-operations', {
        body: {
          action: 'create_collection',
          name
        }
      })

      if (error) throw error

      toast({
        title: "Success",
        description: data.message || `Created collection "${name}"`,
        duration: 3000
      })

      // Trigger refresh of content and counts for new collection
      callbacks?.onRefreshNeeded?.()
      callbacks?.onCountsRefreshNeeded?.()

      return data.collection
    } catch (error: any) {
      console.error('Create collection error:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to create collection",
        variant: "destructive"
      })
      throw error
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    copyToCollection,
    removeFromCollection,
    removeFromFolder,
    deleteMediaHard,
    createCollection
  }
}