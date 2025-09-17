import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Folder, Check, Loader2, Search } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch folders from database with retry logic
  const fetchFolders = async (retryCount = 0) => {
    const maxRetries = 3;
    setLoading(true);
    
    try {
      // Check if user is authenticated
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Create abort controller for timeout
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 10000); // 10 second timeout

      const { data, error } = await supabase
        .from('file_folders')
        .select('*')
        .order('name')
        .abortSignal(abortController.signal);

      clearTimeout(timeoutId);

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
      
      // Retry with exponential backoff
      if (retryCount < maxRetries && error.name !== 'AbortError') {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
        console.log(`Retrying folder fetch in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        
        setTimeout(() => {
          fetchFolders(retryCount + 1);
        }, delay);
        
        return; // Don't show error toast yet, still retrying
      }
      
      // Show appropriate error message
      let errorMessage = "Failed to load folders. Please try again.";
      
      if (error.name === 'AbortError') {
        errorMessage = "Request timed out. Please check your connection and try again.";
      } else if (error.message?.includes('network')) {
        errorMessage = "Network error. Please check your internet connection.";
      } else if (error.message?.includes('not authenticated')) {
        errorMessage = "Please sign in again to load folders.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      setFolders([]); // Reset to empty state on final failure
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

  // Filter folders based on search query
  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <DialogDescription>
            Organize your content by selecting folders
          </DialogDescription>
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

          {/* Search Bar */}
          {folders.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Search Folders</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search folders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
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
              ) : filteredFolders.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  No folders match your search query.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredFolders.map((folder) => (
                    <div
                      key={folder.id}
                      className="flex items-center space-x-3 p-2 rounded-md hover:bg-primary/10 hover:text-foreground cursor-pointer"
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
