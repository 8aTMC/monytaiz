import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface MediaItem {
  id: string
  title?: string
  type: 'image' | 'video' | 'audio' | 'document'
  storage_path: string
  created_at: string
}

export interface Collection {
  id: string
  name: string
  system: boolean
  system_key?: string
}

export const useMediaOperations = () => {
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
        description: data.message || `Copied ${mediaIds.length} items to collection`
      })

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
        description: data.message || `Removed ${mediaIds.length} items from collection`
      })

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

  const deleteMediaHard = async (mediaIds: string[]) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('media-operations', {
        body: {
          action: 'delete_media_hard',
          media_ids: mediaIds
        }
      })

      if (error) throw error

      toast({
        title: "Success",
        description: data.message || `Permanently deleted ${mediaIds.length} files`
      })

      return data
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
        description: data.message || `Created collection "${name}"`
      })

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
    deleteMediaHard,
    createCollection
  }
}