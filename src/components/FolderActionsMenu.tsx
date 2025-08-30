import { useState } from 'react';
import { MoreVertical, Edit, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EditFolderDialog } from '@/components/EditFolderDialog';

interface FolderActionsMenuProps {
  folder: {
    id: string;
    label: string;
  };
  onFolderUpdated: () => void;
}

export const FolderActionsMenu = ({ folder, onFolderUpdated }: FolderActionsMenuProps) => {
  const [showEditDialog, setShowEditDialog] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-muted/50"
          >
            <MoreVertical className="h-3 w-3" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
            <Edit className="mr-2 h-3 w-3" />
            Edit
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditFolderDialog
        folder={folder}
        onFolderUpdated={() => {
          onFolderUpdated();
          setShowEditDialog(false);
        }}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />
    </>
  );
};