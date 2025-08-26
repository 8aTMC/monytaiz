import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, Plus, Folder } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useMediaOperations } from '@/hooks/useMediaOperations'

interface Collection {
  id: string
  name: string
  system: boolean
}

interface CopyToCollectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (collectionIds: string[]) => void
}

export const CopyToCollectionDialog: React.FC<CopyToCollectionDialogProps> = ({
  open,
  onOpenChange,
  onConfirm
}) => {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set())
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const { createCollection, loading: createLoading } = useMediaOperations()

  useEffect(() => {
    if (open) {
      fetchCollections()
    }
  }, [open])

  const fetchCollections = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('collections')
        .select('id, name, system')
        .eq('system', false)
        .order('created_at', { ascending: false })

      if (error) throw error
      setCollections(data || [])
    } catch (error) {
      console.error('Error fetching collections:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return

    try {
      const newCollection = await createCollection(newFolderName.trim())
      setCollections(prev => [newCollection, ...prev])
      setNewFolderName('')
      setShowNewFolder(false)
      setSelectedFolders(new Set([newCollection.id]))
    } catch (error) {
      console.error('Error creating folder:', error)
    }
  }

  const handleToggleSelection = (collectionId: string) => {
    setSelectedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(collectionId)) {
        newSet.delete(collectionId)
      } else {
        newSet.add(collectionId)
      }
      return newSet
    })
  }

  const handleConfirm = () => {
    if (selectedFolders.size > 0) {
      onConfirm(Array.from(selectedFolders))
      resetDialog()
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
    resetDialog()
  }

  const resetDialog = () => {
    setSelectedFolders(new Set())
    setSearchTerm('')
    setShowNewFolder(false)
    setNewFolderName('')
  }

  const filteredCollections = collections.filter(collection =>
    collection.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy to Folders</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search folders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {showNewFolder && (
            <div className="flex gap-2">
              <Input
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder()
                  if (e.key === 'Escape') setShowNewFolder(false)
                }}
                autoFocus
              />
              <Button 
                onClick={handleCreateFolder} 
                disabled={!newFolderName.trim() || createLoading}
                size="sm"
              >
                Create
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowNewFolder(false)}
                size="sm"
              >
                Cancel
              </Button>
            </div>
          )}

          <Button
            variant="outline"
            onClick={() => setShowNewFolder(true)}
            className="w-full justify-start"
            disabled={showNewFolder}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Folder
          </Button>

          <ScrollArea className="h-[200px]">
            <div className="space-y-1">
              {loading ? (
                <div className="text-center text-muted-foreground py-4">
                  Loading folders...
                </div>
              ) : filteredCollections.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">
                  {searchTerm ? 'No folders found' : 'No custom folders yet'}
                </div>
              ) : (
                 filteredCollections.map((collection) => {
                   const isSelected = selectedFolders.has(collection.id)
                   return (
                     <Button
                       key={collection.id}
                       variant={isSelected ? "default" : "ghost"}
                       onClick={() => handleToggleSelection(collection.id)}
                       className={`w-full justify-start relative ${
                         isSelected 
                           ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                           : "hover:bg-accent hover:text-accent-foreground"
                       }`}
                     >
                       <Folder className="h-4 w-4 mr-2" />
                       {collection.name}
                       {isSelected && (
                         <div className="absolute right-2 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary-foreground" />
                       )}
                     </Button>
                   )
                 })
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={selectedFolders.size === 0}
          >
            Copy to {selectedFolders.size} Folder{selectedFolders.size !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}