import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, X, Copy, Trash2 } from 'lucide-react'
import { CopyToCollectionDialog } from './CopyToCollectionDialog'
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog'

interface LibrarySelectionToolbarProps {
  selecting: boolean
  selectedCount: number
  currentView: string
  isCustomFolder: boolean
  onToggleSelect: () => void
  onClearSelection: () => void
  onCopy: (collectionId: string) => void
  onDelete: () => void
  disabled?: boolean
}

export const LibrarySelectionToolbar: React.FC<LibrarySelectionToolbarProps> = ({
  selecting,
  selectedCount,
  currentView,
  isCustomFolder,
  onToggleSelect,
  onClearSelection,
  onCopy,
  onDelete,
  disabled = false
}) => {
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const handleCopy = () => {
    setCopyDialogOpen(true)
  }

  const handleCopyConfirm = (collectionId: string) => {
    onCopy(collectionId)
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

  return (
    <>
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-2">
          <Button
            variant={selecting ? "secondary" : "outline"}
            size="sm"
            onClick={selecting ? onClearSelection : onToggleSelect}
            disabled={disabled}
          >
            {selecting ? (
              <>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Select
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={!selecting || !hasSelection || disabled}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={!selecting || !hasSelection || disabled}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>

        {selecting && (
          <div className="text-sm text-muted-foreground">
            {selectedCount} selected
          </div>
        )}
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