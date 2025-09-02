import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Folder, Check, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './AuthProvider';

interface Folder {
  id: string;
  name: string;
  isDefault?: boolean;
}

interface FolderSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFolders: string[];
  onFoldersChange: (folderIds: string[]) => void;
}

export const FolderSelectDialog = ({
  open,
  onOpenChange,
  selectedFolders,
  onFoldersChange,
}: FolderSelectDialogProps) => {
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch folders from database
  const fetchFolders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('file_folders')
        .select('*')
        .order('name');

      if (error) {
        throw error;
      }

      // Only show custom folders
      const allFolders: Folder[] = data.map(folder => ({
        id: folder.id,
        name: folder.name,
        isDefault: false
      }));

      setFolders(allFolders);
    } catch (error: any) {
      console.error('Error fetching folders:', error);
      toast({
        title: "Error",
        description: "Failed to load folders. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch folders when dialog opens
  useEffect(() => {
    if (open) {
      fetchFolders();
    }
  }, [open]);

  const createNewFolder = async () => {
    if (!newFolderName.trim() || !user?.id) return;

    if (newFolderName.length > 30) {
      toast({
        title: "Validation Error",
        description: "Folder name must be 30 characters or less",
        variant: "destructive"
      });
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('file_folders')
        .insert({
          name: newFolderName.trim(),
          description: newFolderDescription.trim() || null,
          creator_id: user.id,
        })
        .select()
        .single();

      if (error) {
        // Handle unique constraint violation
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

      // Add the new folder to the list
      const newFolder: Folder = {
        id: data.id,
        name: data.name,
        isDefault: false,
      };

      setFolders(prev => [...prev, newFolder]);
      onFoldersChange([...selectedFolders, newFolder.id]);
      setNewFolderName('');
      setNewFolderDescription('');
      setIsCreatingFolder(false);

      toast({
        title: "Success",
        description: "Folder created successfully!",
      });
    } catch (error: any) {
      console.error('Error creating folder:', error);
      toast({
        title: "Error", 
        description: "Failed to create folder. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const toggleFolder = (folderId: string) => {
    if (selectedFolders.includes(folderId)) {
      onFoldersChange(selectedFolders.filter(id => id !== folderId));
    } else {
      onFoldersChange([...selectedFolders, folderId]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Select Folders</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Create New Folder */}
          {!isCreatingFolder ? (
            <Button
              variant="outline"
              onClick={() => setIsCreatingFolder(true)}
              className="w-full justify-start"
              disabled={loading}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Folder
            </Button>
          ) : (
            <div className="space-y-2">
              <Label className="text-sm font-medium">New Folder Name</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createNewFolder();
                    if (e.key === 'Escape') {
                      setIsCreatingFolder(false);
                      setNewFolderName('');
                    }
                  }}
                  autoFocus
                  disabled={creating}
                />
                <Button
                  onClick={createNewFolder}
                  disabled={!newFolderName.trim() || creating}
                  size="sm"
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsCreatingFolder(false);
                  setNewFolderName('');
                }}
                className="w-full"
                disabled={creating}
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Existing Folders */}
          <div>
            <Label className="text-sm font-medium">
              {folders.length > 0 ? 'Select Folders' : 'No Folders Available'}
            </Label>
            <ScrollArea className="h-64 mt-2">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading folders...</span>
                </div>
              ) : folders.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  No custom folders created yet. Create your first folder above.
                </div>
              ) : (
                <div className="space-y-2">
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className="flex items-center space-x-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                      onClick={() => toggleFolder(folder.id)}
                    >
                      <Checkbox
                        checked={selectedFolders.includes(folder.id)}
                        onChange={() => toggleFolder(folder.id)}
                      />
                      <Folder className="w-4 h-4 text-muted-foreground" />
                      <span className="flex-1 text-sm">{folder.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
