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
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClearSelection}
            disabled={disabled}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={allSelected ? onClearSelection : onSelectAll}
            disabled={disabled || totalCount === 0}
          >
            <Check className="h-4 w-4 mr-2" />
            {allSelected ? "Deselect All" : "Select All"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={!hasSelection || disabled}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={!hasSelection || disabled}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          {selectedCount} selected
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