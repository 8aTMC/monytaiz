import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Folder, Check } from 'lucide-react';

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
  
  // Mock existing folders for demonstration
  const [folders, setFolders] = useState([
    { id: 'all-files', name: 'All Files', isDefault: true },
    { id: 'photos', name: 'Photos', isDefault: false },
    { id: 'videos', name: 'Videos', isDefault: false },
    { id: 'workout', name: 'Workout Content', isDefault: false },
    { id: 'lifestyle', name: 'Lifestyle', isDefault: false },
  ]);

  const createNewFolder = () => {
    if (newFolderName.trim()) {
      const newFolder = {
        id: Date.now().toString(),
        name: newFolderName.trim(),
        isDefault: false,
      };
      setFolders([...folders, newFolder]);
      onFolderChange(newFolder.id);
      setNewFolderName('');
      setIsCreatingFolder(false);
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
                />
                <Button
                  onClick={createNewFolder}
                  disabled={!newFolderName.trim()}
                  size="sm"
                >
                  <Plus className="w-4 h-4" />
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
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Existing Folders */}
          <div>
            <Label className="text-sm font-medium">Existing Folders</Label>
            <ScrollArea className="h-64 mt-2">
              <div className="space-y-1">
                {folders.map((folder) => (
                  <Button
                    key={folder.id}
                    variant={selectedFolder === folder.id ? "default" : "ghost"}
                    onClick={() => selectFolder(folder.id)}
                    className="w-full justify-between"
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
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
