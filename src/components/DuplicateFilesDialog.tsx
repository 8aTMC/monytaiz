import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Image, Video, Music, FileIcon, Eye, Search, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { FileComparisonDialog } from './FileComparisonDialog';
import { useOptimizedThumbnail } from '@/hooks/useOptimizedThumbnail';

interface DuplicateFile {
  id: string;
  name: string;
  size: number;
  type: string;
  existingFile: File; // File already in queue
  newFile: File; // File being uploaded
  similarity?: number; // 0-100 percentage for fuzzy matches
}

interface DuplicateFilesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateFiles: DuplicateFile[];
  onConfirm: (filesToIgnore: string[]) => void;
  stepInfo?: { current: number; total: number } | null;
}

export const DuplicateFilesDialog = ({ 
  open, 
  onOpenChange, 
  duplicateFiles, 
  onConfirm,
  stepInfo 
}: DuplicateFilesDialogProps) => {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [comparisonDialogOpen, setComparisonDialogOpen] = useState(false);
  const [selectedFileForComparison, setSelectedFileForComparison] = useState<DuplicateFile | null>(null);
  const [isConfirmedClose, setIsConfirmedClose] = useState(false);
  
  // Initialize with all files selected by default and reset when duplicateFiles changes
  useEffect(() => {
    if (duplicateFiles.length > 0) {
      setSelectedFiles(new Set(duplicateFiles.map(f => f.id)));
    }
  }, [duplicateFiles]);
  
  const handleSelectAll = () => {
    if (selectedFiles.size === duplicateFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(duplicateFiles.map(f => f.id)));
    }
  };
  
  const handleFileToggle = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };
  
  const handleConfirm = () => {
    setIsConfirmedClose(true);
    onConfirm(Array.from(selectedFiles));
    setSelectedFiles(new Set());
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isConfirmedClose) {
      // Auto-ignore selected files when dialog closes without confirmation
      onConfirm(Array.from(selectedFiles));
      setSelectedFiles(new Set());
    }
    setIsConfirmedClose(false);
    onOpenChange(newOpen);
  };

  const handleComparisonClick = (file: DuplicateFile, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedFileForComparison(file);
    setComparisonDialogOpen(true);
  };
  
  const getFileIcon = (file: DuplicateFile) => {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension)) {
      return <Image className="w-8 h-8 text-blue-500" />;
    }
    if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(extension)) {
      return <Video className="w-8 h-8 text-purple-500" />;
    }
    if (['mp3', 'wav', 'aac', 'ogg', 'flac', 'opus'].includes(extension)) {
      return <Music className="w-8 h-8 text-green-500" />;
    }
    if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(extension)) {
      return <FileText className="w-8 h-8 text-orange-500" />;
    }
    return <FileIcon className="w-8 h-8 text-muted-foreground" />;
  };

  const FileThumbnail = ({ file }: { file: DuplicateFile }) => {
    const { thumbnail, isLoading } = useOptimizedThumbnail(file.newFile);
    
    if (isLoading) {
      return (
        <div className="w-8 h-8 rounded overflow-hidden bg-muted flex-shrink-0 animate-pulse" />
      );
    }
    
    if (thumbnail) {
      return (
        <div className="w-8 h-8 rounded overflow-hidden bg-muted flex-shrink-0">
          <img 
            src={thumbnail} 
            alt={file.name}
            className="w-full h-full object-cover"
          />
        </div>
      );
    }
    
    return getFileIcon(file);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileIcon className="w-5 h-5 text-orange-500" />
            Duplicate Files Found in the Queue
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between mt-2">
            <p className="text-sm text-muted-foreground">
              Found {duplicateFiles.length} duplicate file{duplicateFiles.length > 1 ? 's' : ''}. Selected files will be ignored, unselected files will be added to the queue:
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSelectAll}
              className="text-xs"
            >
              {selectedFiles.size === duplicateFiles.length ? 'Unselect All' : 'Select All'}
            </Button>
          </div>
          
          <ScrollArea className="h-[400px] w-full">
            <div className="pr-4 space-y-6">
              {/* Exact Duplicates */}
              {duplicateFiles.filter(d => !d.similarity).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Exact Duplicates ({duplicateFiles.filter(d => !d.similarity).length})
                  </h4>
                  <div className="space-y-2">
                    {duplicateFiles.filter(d => !d.similarity).map((file) => (
                      <div 
                        key={file.id} 
                        className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex-shrink-0">
                          <FileThumbnail file={file} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {formatFileSize(file.size)}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {file.type}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleComparisonClick(file, e)}
                            className="text-xs gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            See Comparison
                          </Button>
                        </div>
                        <div className="flex-shrink-0">
                          <Checkbox
                            checked={selectedFiles.has(file.id)}
                            onCheckedChange={() => handleFileToggle(file.id)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Similar Files */}          
              {duplicateFiles.filter(d => d.similarity).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Search className="h-4 w-4 text-orange-500" />
                    Similar Files ({duplicateFiles.filter(d => d.similarity).length})
                  </h4>
                  <div className="space-y-2">
                    {duplicateFiles.filter(d => d.similarity).map((file) => (
                      <div 
                        key={file.id} 
                        className="flex items-center gap-3 p-3 rounded-lg border bg-orange-50/50 hover:bg-orange-50/70 transition-colors"
                      >
                        <div className="flex-shrink-0">
                          <FileThumbnail file={file} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {formatFileSize(file.size)}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {file.type}
                            </Badge>
                            <Badge className="text-xs bg-orange-100 text-orange-800 border-orange-200">
                              {file.similarity}% similar
                            </Badge>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleComparisonClick(file, e)}
                            className="text-xs gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            See Comparison
                          </Button>
                        </div>
                        <div className="flex-shrink-0">
                          <Checkbox
                            checked={selectedFiles.has(file.id)}
                            onCheckedChange={() => handleFileToggle(file.id)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => { setIsConfirmedClose(true); onOpenChange(false); }} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="flex-1">
            Ignore Selected Files ({selectedFiles.size})
          </Button>
        </DialogFooter>
      </DialogContent>
      
      {selectedFileForComparison && (
        <FileComparisonDialog
          open={comparisonDialogOpen}
          onOpenChange={setComparisonDialogOpen}
          existingFile={{ file: selectedFileForComparison.existingFile }}
          newFile={{ file: selectedFileForComparison.newFile }}
        />
      )}
    </Dialog>
  );
};