import React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface DeleteConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isCustomFolder: boolean
  currentView: string
  selectedCount: number
}

export const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  isCustomFolder,
  currentView,
  selectedCount
}) => {
  const isDefaultView = ['All Files', 'Stories', 'Messages'].includes(currentView)

  const title = isCustomFolder 
    ? 'Remove from this folder?' 
    : 'Delete everywhere?'

  const description = isCustomFolder
    ? `Remove ${selectedCount} item${selectedCount === 1 ? '' : 's'} from this folder? The file${selectedCount === 1 ? '' : 's'} will remain in All Files and other folders.`
    : `This will permanently delete ${selectedCount} original file${selectedCount === 1 ? '' : 's'} and remove ${selectedCount === 1 ? 'it' : 'them'} from all folders and fans' access.`

  const confirmButtonText = isCustomFolder 
    ? 'Remove from folder' 
    : 'Delete everywhere'

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className={isDefaultView ? "bg-destructive hover:bg-destructive/90" : ""}
          >
            {confirmButtonText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}