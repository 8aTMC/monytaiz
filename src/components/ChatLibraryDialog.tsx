import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { LibraryFiltersDialog } from '@/components/LibraryFiltersDialog';
import { VirtualizedLibraryGrid } from '@/components/VirtualizedLibraryGrid';
import { useLibraryData } from '@/hooks/useLibraryData';
import { LibraryFilterState } from '@/types/library-filters';
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
  Check,
  Grid3X3,
  Eye,
  EyeOff
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
  const [activeFilter, setActiveFilter] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedCategory, setSelectedCategory] = useState('all-files');
  const [folders, setFolders] = useState<any[]>([]);
  const [showDefaultFolders, setShowDefaultFolders] = useState(true);
  
  // Advanced filters state
  const [advancedFilters, setAdvancedFilters] = useState<LibraryFilterState>(() => ({
    collaborators: [],
    tags: [],
    priceRange: [0, 1000000] // $0 to $10,000 in cents
  }));
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);

  // Default categories
  const defaultCategories = [
    { id: 'all-files', label: 'All Files', icon: Grid3X3, description: 'All media files' },
    { id: 'stories', label: 'Stories', icon: Image, description: 'Story content' },
    { id: 'messages', label: 'Messages', icon: FileText, description: 'Message attachments' }
  ];

  const {
    content: mediaData,
    loading,
    fetchContent: refreshData
  } = useLibraryData({
    selectedCategory: selectedCategory,
    searchQuery,
    selectedFilter: activeFilter,
    sortBy: sortBy,
    advancedFilters,
    currentUserId
  });

  const totalCount = mediaData.length;

  // Reset state when dialog opens to ensure default folders are always visible
  useEffect(() => {
    if (isOpen) {
      setShowDefaultFolders(true);
      setSelectedCategory('all-files');
    }
  }, [isOpen]);

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

  // Advanced filter handlers
  const handleFiltersChange = (newFilters: LibraryFilterState) => {
    setAdvancedFilters(newFilters);
  };

  const hasActiveFilters = 
    advancedFilters.collaborators.length > 0 || 
    advancedFilters.tags.length > 0 || 
    advancedFilters.priceRange[0] > 0 || 
    advancedFilters.priceRange[1] < 1000000;

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
              {/* Default Folders */}
              {showDefaultFolders && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Default Folders</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDefaultFolders(!showDefaultFolders)}
                      className="text-xs px-2 h-7 hover:bg-gradient-glass transition flex items-center gap-1"
                    >
                      <EyeOff className="h-3 w-3" />
                      <span>Hide</span>
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {defaultCategories.map((category) => (
                      <Button
                        key={category.id}
                        variant={selectedCategory === category.id ? 'secondary' : 'ghost'}
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => setSelectedCategory(category.id)}
                      >
                        <category.icon className="h-4 w-4 mr-2" />
                        {category.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {!showDefaultFolders && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Default Folders</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDefaultFolders(true)}
                      className="text-xs px-2 h-7 hover:bg-gradient-glass transition flex items-center gap-1"
                    >
                      <Eye className="h-3 w-3" />
                      <span>Show</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Custom Folders */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">My Folders</h4>
                <div className="space-y-1">
                  {folders.map((folder) => (
                    <Button
                      key={folder.id}
                      variant={selectedCategory === folder.id ? 'secondary' : 'ghost'}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setSelectedCategory(folder.id)}
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
            {/* Enhanced Header with Controls */}
            <div className="pb-4 border-b">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {/* Media Type Filter Tabs */}
                  <div className="flex bg-muted rounded-lg p-1">
                    {[
                      { filter: 'All', icon: Grid3X3, label: 'All files' },
                      { filter: 'Photo', icon: Image, label: 'Photos' },
                      { filter: 'Video', icon: Video, label: 'Videos' },
                      { filter: 'Audio', icon: Music, label: 'Audio' }
                    ].map(({ filter, icon: Icon, label }) => (
                      <Button
                        key={filter}
                        variant={activeFilter === filter ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveFilter(filter)}
                        className="px-3 py-1 text-xs"
                        aria-label={label}
                        title={label}
                      >
                        <Icon className="h-4 w-4" />
                      </Button>
                    ))}
                  </div>

                  {/* Advanced Filters Button */}
                  <Button
                    variant={hasActiveFilters ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFiltersDialogOpen(true)}
                    className="shrink-0"
                  >
                    <Filter className="h-4 w-4 mr-1" />
                    Filters
                    {hasActiveFilters && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-background/20 rounded">
                        {advancedFilters.collaborators.length + advancedFilters.tags.length + (advancedFilters.priceRange[0] > 0 || advancedFilters.priceRange[1] < 1000000 ? 1 : 0)}
                      </span>
                    )}
                  </Button>

                  {/* Search Field */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search files..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                </div>

                {/* Sort */}
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="name-asc">Name A-Z</SelectItem>
                    <SelectItem value="name-desc">Name Z-A</SelectItem>
                    <SelectItem value="size-desc">Largest First</SelectItem>
                    <SelectItem value="size-asc">Smallest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
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

        {/* Advanced Filters Dialog */}
        <LibraryFiltersDialog
          open={filtersDialogOpen}
          onOpenChange={(open) => setFiltersDialogOpen(open)}
          filters={advancedFilters}
          onFiltersChange={handleFiltersChange}
        />

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