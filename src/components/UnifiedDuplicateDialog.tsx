import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Image, Video, Music, FileIcon, Eye, Calendar, Database, List, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect, useMemo } from 'react';
import { DuplicateMatch, QueueDuplicate, DatabaseDuplicate } from '@/hooks/useBatchDuplicateDetection';
import { FileComparisonDialog } from './FileComparisonDialog';
import { useOptimizedThumbnail } from '@/hooks/useOptimizedThumbnail';

interface UnifiedDuplicateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateMatch[];
  onPurgeSelected: (duplicateIds: string[]) => void;
  onKeepBoth: () => void;
  onCancel: () => void;
}

export const UnifiedDuplicateDialog = ({ 
  open, 
  onOpenChange, 
  duplicates, 
  onPurgeSelected,
  onKeepBoth,
  onCancel
}: UnifiedDuplicateDialogProps) => {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [comparisonDialogOpen, setComparisonDialogOpen] = useState(false);
  const [selectedDuplicateForComparison, setSelectedDuplicateForComparison] = useState<DuplicateMatch | null>(null);
  
  // Separate duplicates by type
  const libraryDuplicates = duplicates.filter(d => d.sourceType === 'database') as DatabaseDuplicate[];
  const queueDuplicates = duplicates.filter(d => d.sourceType === 'queue') as QueueDuplicate[];
  // Unique staged file ids (a file can appear in both sections)
  const uniqueIds = useMemo(() => Array.from(new Set(duplicates.map(d => d.queueFile.id))), [duplicates]);
  
  // Initialize with all files selected by default
  useEffect(() => {
    if (duplicates.length > 0) {
      setSelectedFiles(new Set(duplicates.map(d => d.queueFile.id)));
    }
  }, [duplicates]);
  
  const handleSelectAll = () => {
    const total = uniqueIds.length;
    if (selectedFiles.size === total) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(uniqueIds));
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
  
  const handleComparisonClick = (duplicate: DuplicateMatch) => {
    // Only show comparison for database duplicates
    if (duplicate.sourceType === 'database') {
      setSelectedDuplicateForComparison(duplicate);
      setComparisonDialogOpen(true);
    }
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

  const FileThumbnail = ({ duplicate }: { duplicate: DuplicateMatch }) => {
    const { thumbnail, isLoading } = useOptimizedThumbnail(duplicate.queueFile.file);
    
    if (isLoading) {
      return (
        <div className="w-12 h-12 rounded overflow-hidden bg-muted flex-shrink-0 animate-pulse" />
      );
    }
    
    if (thumbnail) {
      return (
        <div className="w-12 h-12 rounded overflow-hidden bg-muted flex-shrink-0">
          <img 
            src={thumbnail} 
            alt="File preview" 
            className="w-full h-full object-cover"
          />
        </div>
      );
    }
    
    return (
      <div className="w-12 h-12 bg-muted rounded border flex items-center justify-center">
        {getFileIcon(duplicate.queueFile.file.type)}
      </div>
    );
  };

  const DuplicateRow = ({ duplicate }: { duplicate: DuplicateMatch }) => (
    <div 
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
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline">New File</Badge>
              <Badge variant="destructive">
                {duplicate.sourceType === 'database' ? 'Library Match' : 'Queue Match'}
              </Badge>
            </div>
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
          
          {/* Duplicate source */}
          <div className="space-y-1">
            {duplicate.sourceType === 'database' ? (
              <>
                <Badge variant="secondary" className="mb-1 flex items-center gap-1 w-fit">
                  <Database className="w-3 h-3" />
                  In Library
                </Badge>
                <p className="font-medium text-sm truncate" title={duplicate.existingFile.title || duplicate.existingFile.original_filename}>
                  {duplicate.existingFile.title || duplicate.existingFile.original_filename}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(duplicate.existingFile.created_at)}</span>
                  <span>•</span>
                  <Badge variant="outline" className="text-xs">
                    {duplicate.existingFile.processing_status}
                  </Badge>
                </div>
              </>
            ) : (
              <>
                <Badge variant="destructive" className="mb-1 flex items-center gap-1 w-fit">
                  <List className="w-3 h-3" />
                  In Queue
                </Badge>
                <p className="font-medium text-sm truncate" title={duplicate.duplicateFile.file.name}>
                  {duplicate.duplicateFile.file.name}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {getFileIcon(duplicate.duplicateFile.file.type)}
                  <span>{formatFileSize(duplicate.duplicateFile.file.size)}</span>
                  <span>•</span>
                  <span>Also in upload queue</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleComparisonClick(duplicate)}
        disabled={duplicate.sourceType === 'queue'}
        className="flex items-center gap-1 shrink-0"
      >
        <Eye className="w-3 h-3" />
        {duplicate.sourceType === 'database' ? 'Compare' : 'N/A'}
      </Button>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Duplicate Detection ({duplicates.length})
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Found files with identical names and sizes. Choose how to handle these duplicates.
            </p>
          </DialogHeader>
          
          <div className="flex flex-col flex-1 min-h-0 space-y-4">
            {/* Selection header */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg flex-shrink-0">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedFiles.size === uniqueIds.length && uniqueIds.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm font-medium">
                  Select All ({selectedFiles.size}/{uniqueIds.length})
                </span>
              </div>
              <Badge variant="secondary">
                {selectedFiles.size} selected for removal
              </Badge>
            </div>
            
            {/* Duplicate files list */}
            <ScrollArea className="h-[400px]">
              <div className="space-y-6 pr-4">
                {/* Library Duplicates Section */}
                {libraryDuplicates.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Database className="h-4 w-4 text-primary" />
                      Duplicates in the Library ({libraryDuplicates.length})
                    </h4>
                    <div className="space-y-3">
                      {libraryDuplicates.map((duplicate) => (
                        <DuplicateRow key={`${duplicate.queueFile.id}-database`} duplicate={duplicate} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Queue Duplicates Section */}
                {queueDuplicates.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <List className="h-4 w-4 text-destructive" />
                      Duplicates in the Queue ({queueDuplicates.length})
                    </h4>
                    <div className="space-y-3">
                      {queueDuplicates.map((duplicate) => (
                        <DuplicateRow key={`${duplicate.queueFile.id}-queue`} duplicate={duplicate} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
          
          <DialogFooter className="flex gap-2 sm:gap-2 flex-shrink-0">
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

      {/* File comparison dialog - only for database duplicates */}
      {selectedDuplicateForComparison && selectedDuplicateForComparison.sourceType === 'database' && (
        <FileComparisonDialog
          open={comparisonDialogOpen}
          onOpenChange={setComparisonDialogOpen}
          existingFile={{
            id: selectedDuplicateForComparison.existingFile.id,
            original_filename: selectedDuplicateForComparison.existingFile.original_filename,
            title: selectedDuplicateForComparison.existingFile.title,
            original_size_bytes: selectedDuplicateForComparison.existingFile.original_size_bytes,
            optimized_size_bytes: selectedDuplicateForComparison.existingFile.optimized_size_bytes,
            mime_type: selectedDuplicateForComparison.existingFile.mime_type,
            created_at: selectedDuplicateForComparison.existingFile.created_at,
            processing_status: selectedDuplicateForComparison.existingFile.processing_status,
            thumbnail_path: selectedDuplicateForComparison.existingFile.thumbnail_path,
            processed_path: selectedDuplicateForComparison.existingFile.processed_path
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