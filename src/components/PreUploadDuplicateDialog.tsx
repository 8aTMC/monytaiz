import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Image, Video, Music, FileIcon, Eye, Calendar, Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { DatabaseDuplicate } from '@/hooks/useDuplicateDetection';
import { FileComparisonDialog } from './FileComparisonDialog';

interface PreUploadDuplicateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DatabaseDuplicate[];
  onPurgeSelected: (duplicateIds: string[]) => void;
  onKeepBoth: () => void;
  onCancel: () => void;
}

export const PreUploadDuplicateDialog = ({ 
  open, 
  onOpenChange, 
  duplicates, 
  onPurgeSelected,
  onKeepBoth,
  onCancel
}: PreUploadDuplicateDialogProps) => {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [comparisonDialogOpen, setComparisonDialogOpen] = useState(false);
  const [selectedDuplicateForComparison, setSelectedDuplicateForComparison] = useState<DatabaseDuplicate | null>(null);
  
  // Initialize with all files selected by default
  useEffect(() => {
    if (duplicates.length > 0) {
      setSelectedFiles(new Set(duplicates.map(d => d.queueFile.id)));
    }
  }, [duplicates]);
  
  const handleSelectAll = () => {
    if (selectedFiles.size === duplicates.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(duplicates.map(d => d.queueFile.id)));
    }
  };
  
  const handleFileToggle = (fileId: string) => {
    setSelectedFiles(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(fileId)) {
        newSelection.delete(fileId);
      } else {
        newSelection.add(fileId);
      }
      return newSelection;
    });
  };
  
  const handlePurgeSelected = () => {
    onPurgeSelected(Array.from(selectedFiles));
    onOpenChange(false);
  };
  
  const handleKeepBoth = () => {
    onKeepBoth();
    onOpenChange(false);
  };
  
  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };
  
  const handleComparisonClick = (duplicate: DatabaseDuplicate) => {
    setSelectedDuplicateForComparison(duplicate);
    setComparisonDialogOpen(true);
  };
  
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (mimeType.startsWith('video/')) return <Video className="w-4 h-4" />;
    if (mimeType.startsWith('audio/')) return <Music className="w-4 h-4" />;
    if (mimeType.includes('text') || mimeType.includes('document')) return <FileText className="w-4 h-4" />;
    return <FileIcon className="w-4 h-4" />;
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const FileThumbnail = ({ duplicate }: { duplicate: DatabaseDuplicate }) => {
    const { queueFile, existingFile } = duplicate;
    
    if (queueFile.file.type.startsWith('image/')) {
      const url = URL.createObjectURL(queueFile.file);
      return (
        <img 
          src={url} 
          alt="File preview" 
          className="w-12 h-12 object-cover rounded border"
          onLoad={() => URL.revokeObjectURL(url)}
        />
      );
    }
    
    return (
      <div className="w-12 h-12 bg-muted rounded border flex items-center justify-center">
        {getFileIcon(queueFile.file.type)}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Duplicate Files Detected ({duplicates.length})
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              The following files already exist in your library. You can purge selected duplicates from upload, 
              keep both versions, or cancel the upload.
            </p>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Selection header */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedFiles.size === duplicates.length && duplicates.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm font-medium">
                  Select All ({selectedFiles.size}/{duplicates.length})
                </span>
              </div>
              <Badge variant="secondary">
                {selectedFiles.size} selected for removal
              </Badge>
            </div>
            
            {/* Duplicate files list */}
            <ScrollArea className="max-h-96">
              <div className="space-y-3">
                {duplicates.map((duplicate) => (
                  <div 
                    key={duplicate.queueFile.id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedFiles.has(duplicate.queueFile.id)}
                      onCheckedChange={() => handleFileToggle(duplicate.queueFile.id)}
                    />
                    
                    <FileThumbnail duplicate={duplicate} />
                    
                    <div className="flex-1 min-w-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Queue file (new) */}
                        <div className="space-y-1">
                          <Badge variant="outline" className="mb-1">Queue File (New)</Badge>
                          <p className="font-medium text-sm truncate" title={duplicate.queueFile.file.name}>
                            {duplicate.queueFile.file.name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {getFileIcon(duplicate.queueFile.file.type)}
                            <span>{formatFileSize(duplicate.queueFile.file.size)}</span>
                            <span>•</span>
                            <span>Ready to upload</span>
                          </div>
                        </div>
                        
                        {/* Existing file */}
                        <div className="space-y-1">
                          <Badge variant="secondary" className="mb-1">Existing in Library</Badge>
                          <p className="font-medium text-sm truncate" title={duplicate.existingFile.original_filename}>
                            {duplicate.existingFile.title || duplicate.existingFile.original_filename}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            <span>{formatDate(duplicate.existingFile.created_at)}</span>
                            <span>•</span>
                            <Badge variant="outline">
                              {duplicate.existingFile.processing_status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleComparisonClick(duplicate)}
                      className="flex items-center gap-1 shrink-0"
                    >
                      <Eye className="w-3 h-3" />
                      Compare
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel Upload
            </Button>
            <Button 
              variant="secondary" 
              onClick={handleKeepBoth}
              className="flex items-center gap-1"
            >
              Keep Both Versions
            </Button>
            <Button 
              onClick={handlePurgeSelected}
              disabled={selectedFiles.size === 0}
              className="flex items-center gap-1"
            >
              Purge Selected ({selectedFiles.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File comparison dialog */}
      {selectedDuplicateForComparison && (
        <FileComparisonDialog
          open={comparisonDialogOpen}
          onOpenChange={setComparisonDialogOpen}
          existingFile={{
            file: new File([new Blob()], selectedDuplicateForComparison.existingFile.original_filename, {
              type: selectedDuplicateForComparison.existingFile.mime_type
            }),
            id: selectedDuplicateForComparison.existingFile.id
          }}
          newFile={{
            file: selectedDuplicateForComparison.queueFile.file,
            id: selectedDuplicateForComparison.queueFile.id
          }}
        />
      )}
    </>
  );
};
