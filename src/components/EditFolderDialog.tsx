import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { MoreVertical, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EditFolderDialogProps {
  folder: {
    id: string;
    label: string;
    description?: string;
  };
  onFolderUpdated: () => void;
  /** Optional: provide your own trigger node (e.g., a custom icon button). */
  trigger?: React.ReactNode;
}

export const EditFolderDialog = ({
  folder,
  onFolderUpdated,
  trigger,
}: EditFolderDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(folder.label);
  const [description, setDescription] = useState(folder.description || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Folder name is required',
        variant: 'destructive',
      });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('file_folders')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', folder.id);

      if (error) throw error;

      toast({ title: 'Success', description: 'Folder updated successfully' });
      setIsOpen(false);
      onFolderUpdated();
    } catch (error) {
      console.error('Error updating folder:', error);
      toast({
        title: 'Error',
        description: 'Failed to update folder',
        variant: 'destructive',
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

      if (error) throw error;

      toast({ title: 'Success', description: 'Folder deleted successfully' });
      setIsOpen(false);
      onFolderUpdated();
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete folder',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    setName(folder.label);
    setDescription(folder.description || '');
  };

  // Default elegant three-dots trigger if none provided
  const defaultTrigger = (
    <Button
      variant="ghost"
      size="icon"
      onClick={(e) => e.stopPropagation()}
      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full"
      aria-label="Folder options"
      title="Folder options"
    >
      <MoreVertical className="h-4 w-4" />
    </Button>
  );

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) resetForm();
      }}
    >
      <DialogTrigger asChild>
        {/* If a custom trigger is passed, use it; otherwise use the default kebab */}
        <span onClick={(e) => e.stopPropagation()}>
          {trigger ?? defaultTrigger}
        </span>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Folder</DialogTitle>
          <DialogDescription>
            Update the folder name and description. The description will be visible in the sidebar.
          </DialogDescription>
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
            <p className="text-xs text-muted-foreground">{name.length}/30 characters</p>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="folder-description">Description</Label>
            <Textarea
              id="folder-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              maxLength={40}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">{description.length}/40 characters</p>
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
              onClick={() => setIsOpen(false)}
              disabled={isLoading || isDeleting}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isLoading || isDeleting}>
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
