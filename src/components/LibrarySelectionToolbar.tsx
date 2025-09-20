import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, X, Copy, Trash2, AtSign, Hash } from 'lucide-react'
import { CopyToCollectionDialog } from './CopyToCollectionDialog'
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog'
import { MentionsDialog } from './MentionsDialog'
import { TagsDialog } from './TagsDialog'

interface LibrarySelectionToolbarProps {
  selectedCount: number
  totalCount: number
  currentView: string
  isCustomFolder: boolean
  selectedMediaIds: string[]
  onClearSelection: () => void
  onSelectAll: () => void
  onCopy: (collectionIds: string[]) => void
  onDelete: () => void
  onUpdateMentions: (mentions: string[]) => void
  onUpdateTags: (tags: string[]) => void
  disabled?: boolean
  onFolderCreated?: () => void
}

export const LibrarySelectionToolbar: React.FC<LibrarySelectionToolbarProps> = ({
  selectedCount,
  totalCount,
  currentView,
  isCustomFolder,
  selectedMediaIds,
  onClearSelection,
  onSelectAll,
  onCopy,
  onDelete,
  onUpdateMentions,
  onUpdateTags,
  disabled = false,
  onFolderCreated
}) => {
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [mentionsDialogOpen, setMentionsDialogOpen] = useState(false)
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false)

  const handleCopy = () => {
    setCopyDialogOpen(true)
  }

  const handleCopyConfirm = (collectionIds: string[]) => {
    onCopy(collectionIds)
    setCopyDialogOpen(false)
  }

  const handleDelete = () => {
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    onDelete()
    setDeleteDialogOpen(false)
  }

  const handleMentions = () => {
    setMentionsDialogOpen(true)
  }

  const handleMentionsConfirm = (mentions: string[]) => {
    onUpdateMentions(mentions)
    setMentionsDialogOpen(false)
  }

  const handleTags = () => {
    setTagsDialogOpen(true)
  }

  const handleTagsConfirm = (tags: string[]) => {
    onUpdateTags(tags)
    setTagsDialogOpen(false)
  }

  const hasSelection = selectedCount > 0
  const allSelected = selectedCount === totalCount && totalCount > 0

  return (
    <>
      <div className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-background/95 backdrop-blur-sm border-b border-border mb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClearSelection}
            disabled={disabled}
            className="hover:bg-destructive/10 hover:text-destructive transition-all duration-300"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>

          <div className="w-px h-6 bg-border"></div>

          <Button
            variant="outline"
            size="sm"
            onClick={allSelected ? onClearSelection : onSelectAll}
            disabled={disabled || totalCount === 0}
            className="hover:bg-gradient-glass transition-all duration-300"
          >
            <Check className="h-4 w-4 mr-2" />
            {allSelected ? "Deselect All" : "Select All"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleMentions}
            disabled={!hasSelection || disabled}
            className="hover:bg-gradient-glass transition-all duration-300"
          >
            <AtSign className="h-4 w-4 mr-2" />
            @
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleTags}
            disabled={!hasSelection || disabled}
            className="hover:bg-gradient-glass transition-all duration-300"
          >
            <Hash className="h-4 w-4 mr-2" />
            #
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={!hasSelection || disabled}
            className="hover:bg-gradient-glass transition-all duration-300"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy to Folder
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={!hasSelection || disabled}
            className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all duration-300"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isCustomFolder ? "Remove" : "Delete"}
          </Button>
        </div>

        <div className="text-sm font-medium ml-auto px-3 py-1.5 bg-muted/30 rounded-md border">
          <span className="text-primary">{selectedCount}</span>
          <span className="text-muted-foreground"> of {totalCount} selected</span>
        </div>
      </div>

      <CopyToCollectionDialog
        open={copyDialogOpen}
        onOpenChange={setCopyDialogOpen}
        onConfirm={handleCopyConfirm}
        onFolderCreated={onFolderCreated}
      />

      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        isCustomFolder={isCustomFolder}
        currentView={currentView}
        selectedCount={selectedCount}
      />

      <MentionsDialog
        open={mentionsDialogOpen}
        onOpenChange={setMentionsDialogOpen}
        mentions={[]}
        onMentionsChange={handleMentionsConfirm}
      />

      <TagsDialog
        open={tagsDialogOpen}
        onOpenChange={setTagsDialogOpen}
        tags={[]}
        onTagsChange={handleTagsConfirm}
      />
    </>
  )
}