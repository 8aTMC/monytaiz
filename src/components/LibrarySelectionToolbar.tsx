import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, X, Copy, Trash2 } from 'lucide-react'
import { CopyToCollectionDialog } from './CopyToCollectionDialog'
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog'

interface LibrarySelectionToolbarProps {
  selectedCount: number
  totalCount: number
  currentView: string
  isCustomFolder: boolean
  onClearSelection: () => void
  onSelectAll: () => void
  onCopy: (collectionIds: string[]) => void
  onDelete: () => void
  disabled?: boolean
}

export const LibrarySelectionToolbar: React.FC<LibrarySelectionToolbarProps> = ({
  selectedCount,
  totalCount,
  currentView,
  isCustomFolder,
  onClearSelection,
  onSelectAll,
  onCopy,
  onDelete,
  disabled = false
}) => {
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

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

  const hasSelection = selectedCount > 0
  const allSelected = selectedCount === totalCount && totalCount > 0

  return (
    <>
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-header border-b border-border/50 backdrop-blur-sm">
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

        <div className="text-sm font-medium">
          <span className="text-primary">{selectedCount}</span>
          <span className="text-muted-foreground"> of {totalCount} selected</span>
        </div>
      </div>

      <CopyToCollectionDialog
        open={copyDialogOpen}
        onOpenChange={setCopyDialogOpen}
        onConfirm={handleCopyConfirm}
      />

      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        isCustomFolder={isCustomFolder}
        currentView={currentView}
        selectedCount={selectedCount}
      />
    </>
  )
}