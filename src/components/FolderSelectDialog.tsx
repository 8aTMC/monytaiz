import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Folder, Check, Loader2 } from 'lucide-react';
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
  selectedFolder: string;
  onFolderChange: (folderId: string) => void;
}

export const FolderSelectDialog = ({
  open,
  onOpenChange,
  selectedFolder,
  onFolderChange,
}: FolderSelectDialogProps) => {
  const [newFolderName, setNewFolderName] = useState('');
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

      // Always include "All Files" as the first option
      const allFolders: Folder[] = [
        { id: 'all-files', name: 'All Files', isDefault: true },
        ...data.map(folder => ({
          id: folder.id,
          name: folder.name,
          isDefault: false
        }))
      ];

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

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('file_folders')
        .insert({
          name: newFolderName.trim(),
          description: null,
          creator_id: user.id,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Add the new folder to the list
      const newFolder: Folder = {
        id: data.id,
        name: data.name,
        isDefault: false,
      };

      setFolders(prev => [...prev, newFolder]);
      onFolderChange(newFolder.id);
      setNewFolderName('');
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

  const selectFolder = (folderId: string) => {
    onFolderChange(folderId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Select Folder</DialogTitle>
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
              {folders.length > 1 ? 'Existing Folders' : 'Folders'}
            </Label>
            <ScrollArea className="h-64 mt-2">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading folders...</span>
                </div>
              ) : folders.length === 1 ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  No custom folders created yet. Create your first folder above.
                </div>
              ) : (
                <div className="space-y-1">
                  {folders.map((folder) => (
                    <Button
                      key={folder.id}
                      variant={selectedFolder === folder.id ? "default" : "ghost"}
                      onClick={() => selectFolder(folder.id)}
                      className="w-full justify-between"
                      disabled={loading}
                    >
                      <div className="flex items-center">
                        <Folder className="w-4 h-4 mr-2" />
                        {folder.name}
                      </div>
                      {selectedFolder === folder.id && (
                        <Check className="w-4 h-4" />
                      )}
                    </Button>
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
