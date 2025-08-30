import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface EditFolderDialogProps {
  folder: {
    id: string;
    label: string;
  };
  onFolderUpdated: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const EditFolderDialog = ({ 
  folder, 
  onFolderUpdated, 
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange
}: EditFolderDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [name, setName] = useState(folder.label);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Folder name is required",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('file_folders')
        .update({
          name: name.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', folder.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Folder updated successfully",
      });
      
      setOpen(false);
      onFolderUpdated();
    } catch (error) {
      console.error('Error updating folder:', error);
      toast({
        title: "Error",
        description: "Failed to update folder",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('file_folders')
        .delete()
        .eq('id', folder.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Folder deleted successfully",
      });
      
      setOpen(false);
      onFolderUpdated();
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast({
        title: "Error",
        description: "Failed to delete folder",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    setName(folder.label);
  };

  return (
    <Dialog open={open} onOpenChange={(openState) => {
      setOpen(openState);
      if (!openState) {
        resetForm();
      }
    }}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm"
            className="h-8 w-8 p-0 hover:bg-muted/50"
            onClick={(e) => e.stopPropagation()}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Folder</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter folder name"
              maxLength={30}
            />
            <p className="text-xs text-muted-foreground">
              {name.length}/30 characters
            </p>
          </div>
        </div>
        <div className="flex justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isDeleting || isLoading}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Folder</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete the folder "{folder.label}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={isLoading || isDeleting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={isLoading || isDeleting}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};