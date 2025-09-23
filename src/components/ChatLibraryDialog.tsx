import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { VirtualizedLibraryGrid } from '@/components/VirtualizedLibraryGrid';
import { useLibraryData } from '@/hooks/useLibraryData';
import { cn } from '@/lib/utils';
import { 
  Search, 
  Filter, 
  FolderOpen, 
  Image, 
  Video, 
  Music, 
  FileText,
  X,
  Check
} from 'lucide-react';

interface MediaItem {
  id: string;
  title: string;
  origin: 'upload' | 'story' | 'livestream' | 'message';
  storage_path: string;
  mime: string;
  type: 'image' | 'video' | 'audio' | 'gif';
  size_bytes: number;
  tags: string[];
  mentions: string[];
  suggested_price_cents: number;
  revenue_generated_cents?: number;
  notes: string | null;
  creator_id: string;
  created_at: string;
  updated_at: string;
  tiny_placeholder?: string;
  thumbnail_path?: string;
  width?: number;
  height?: number;
}

interface ChatLibraryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAttachFiles: (files: MediaItem[]) => void;
  currentUserId: string;
}

export const ChatLibraryDialog = ({ isOpen, onClose, onAttachFiles, currentUserId }: ChatLibraryDialogProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<MediaItem[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [folders, setFolders] = useState<any[]>([]);

  const {
    content: mediaData,
    loading,
    fetchContent: refreshData
  } = useLibraryData({
    selectedCategory: 'all-files',
    searchQuery,
    selectedFilter: activeFilter,
    sortBy: 'newest'
  });

  const totalCount = mediaData.length;

  // Load folders
  useEffect(() => {
    const loadFolders = async () => {
      try {
        const { data, error } = await supabase
          .from('file_folders')
          .select('*')
          .eq('creator_id', currentUserId)
          .order('name');
        
        if (error) throw error;
        setFolders(data || []);
      } catch (error) {
        console.error('Error loading folders:', error);
      }
    };

    if (isOpen) {
      loadFolders();
    }
  }, [isOpen, currentUserId]);

  const handleFileSelection = (fileId: string, item: MediaItem) => {
    const newSelectedFiles = new Set(selectedFiles);
    const newSelectedItems = [...selectedItems];

    if (selectedFiles.has(fileId)) {
      newSelectedFiles.delete(fileId);
      const index = newSelectedItems.findIndex(item => item.id === fileId);
      if (index > -1) {
        newSelectedItems.splice(index, 1);
      }
    } else {
      newSelectedFiles.add(fileId);
      newSelectedItems.push(item);
    }

    setSelectedFiles(newSelectedFiles);
    setSelectedItems(newSelectedItems);
  };

  const handleAttach = () => {
    onAttachFiles(selectedItems);
    setSelectedFiles(new Set());
    setSelectedItems([]);
    onClose();
  };

  const getFileTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      case 'audio': return <Music className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getFileTypeCount = (type: string) => {
    return selectedItems.filter(item => item.type === type).length;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalSize = selectedItems.reduce((sum, item) => sum + (item.size_bytes || 0), 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Library</span>
            {selectedFiles.size > 0 && (
              <Badge variant="secondary">
                {selectedFiles.size} selected
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex gap-4 min-h-0">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0 border-r">
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Filters */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">File Types</h4>
                <div className="space-y-1">
                  {[
                    { key: 'all', label: 'All Files', icon: Filter },
                    { key: 'image', label: 'Images', icon: Image },
                    { key: 'video', label: 'Videos', icon: Video },
                    { key: 'audio', label: 'Audio', icon: Music },
                    { key: 'document', label: 'Documents', icon: FileText }
                  ].map((filter) => (
                    <Button
                      key={filter.key}
                      variant={activeFilter === filter.key ? 'secondary' : 'ghost'}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setActiveFilter(filter.key)}
                    >
                      <filter.icon className="h-4 w-4 mr-2" />
                      {filter.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Folders */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Folders</h4>
                <div className="space-y-1">
                  <Button
                    variant={currentFolder === null ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setCurrentFolder(null)}
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    All Files
                  </Button>
                  {folders.map((folder) => (
                    <Button
                      key={folder.id}
                      variant={currentFolder === folder.id ? 'secondary' : 'ghost'}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setCurrentFolder(folder.id)}
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />
                      {folder.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Content Header */}
            <div className="flex items-center justify-between pb-4">
              <div className="text-sm text-muted-foreground">
                {totalCount} files
              </div>
              {selectedFiles.size > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{formatFileSize(totalSize)}</span>
                  <div className="flex items-center gap-1">
                    {getFileTypeCount('image') > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {getFileTypeCount('image')} <Image className="h-3 w-3 ml-1" />
                      </Badge>
                    )}
                    {getFileTypeCount('video') > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {getFileTypeCount('video')} <Video className="h-3 w-3 ml-1" />
                      </Badge>
                    )}
                    {getFileTypeCount('audio') > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {getFileTypeCount('audio')} <Music className="h-3 w-3 ml-1" />
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* File Grid */}
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="grid grid-cols-6 gap-4">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-6 gap-4">
                  {mediaData.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "relative aspect-square rounded-lg border-2 cursor-pointer transition-all hover:scale-105",
                        selectedFiles.has(item.id) 
                          ? "border-primary bg-primary/10" 
                          : "border-transparent hover:border-muted-foreground"
                      )}
                      onClick={() => handleFileSelection(item.id, item)}
                    >
                      {/* Checkbox */}
                      <div className="absolute top-2 left-2 z-10">
                        <Checkbox
                          checked={selectedFiles.has(item.id)}
                          onChange={() => handleFileSelection(item.id, item)}
                          className="bg-background/80 border-2"
                        />
                      </div>

                      {/* File Type Badge */}
                      <div className="absolute top-2 right-2 z-10">
                        <Badge variant="secondary" className="text-xs">
                          {getFileTypeIcon(item.type)}
                        </Badge>
                      </div>

                      {/* Preview */}
                      <div className="w-full h-full rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                        {item.type === 'image' ? (
                          <img
                            src={item.storage_path}
                            alt={item.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-muted-foreground">
                            {getFileTypeIcon(item.type)}
                            <span className="text-xs mt-1 text-center px-1 truncate w-full">
                              {item.title}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* File Info */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2 rounded-b-lg">
                        <p className="text-xs truncate">{item.title}</p>
                        <p className="text-xs text-white/70">
                          {formatFileSize(item.size_bytes || 0)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {selectedFiles.size > 0 && (
              <span>
                {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} selected
                {totalSize > 0 && ` • ${formatFileSize(totalSize)}`}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleAttach}
              disabled={selectedFiles.size === 0}
              className="min-w-[100px]"
            >
              <Check className="h-4 w-4 mr-2" />
              Attach ({selectedFiles.size})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};