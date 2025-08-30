import { useState } from 'react';
import { MoreVertical, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface FolderActionsDropdownProps {
  folder: {
    id: string;
    label: string;
  };
  onAction: () => void;
}

export const FolderActionsDropdown = ({ folder, onAction }: FolderActionsDropdownProps) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newName, setNewName] = useState(folder.label);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleRename = async () => {
    if (!newName.trim()) {
      toast({
        title: "Error",
        description: "Folder name is required",
        variant: "destructive",
      });
      return;
    }

    if (newName.length > 30) {
      toast({
        title: "Error",
        description: "Folder name must be 30 characters or less",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('file_folders')
        .update({ name: newName.trim() })
        .eq('id', folder.id);

      if (error) {
        if (error.code === '23505' && error.message.includes('unique_file_folder_name_per_creator')) {
          toast({
            title: "Error",
            description: "A folder with this name already exists",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      toast({
        title: "Success",
        description: "Folder renamed successfully",
      });
      
      setRenameDialogOpen(false);
      setDropdownOpen(false);
      onAction();
    } catch (error) {
      console.error('Error renaming folder:', error);
      toast({
        title: "Error",
        description: "Failed to rename folder",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('file_folders')
        .delete()
        .eq('id', folder.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Folder deleted successfully",
      });
      
      setDeleteDialogOpen(false);
      setDropdownOpen(false);
      onAction();
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast({
        title: "Error",
        description: "Failed to delete folder",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.preventDefault()}
          >
            <MoreVertical className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem 
            onClick={() => {
              setNewName(folder.label);
              setRenameDialogOpen(true);
            }}
          >
            <Edit className="h-3 w-3 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setDeleteDialogOpen(true)}
            className="text-destructive"
          >
            <Trash2 className="h-3 w-3 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Name</Label>
              <Input
                id="folder-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={30}
                placeholder="Enter folder name"
              />
              <p className="text-xs text-muted-foreground">
                {newName.length}/30 characters
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setRenameDialogOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button onClick={handleRename} disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the folder "{folder.label}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};