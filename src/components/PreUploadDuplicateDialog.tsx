import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Image, Video, Music, FileIcon, Eye, Calendar, Database, Search, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { DatabaseDuplicate, DuplicateMatch, useDuplicateDetection } from '@/hooks/useDuplicateDetection';
import { FileComparisonDialog } from './FileComparisonDialog';

interface PreUploadDuplicateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateMatch[];
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
  const [selectedDuplicateForComparison, setSelectedDuplicateForComparison] = useState<DuplicateMatch | null>(null);
  const { addDuplicateTag } = useDuplicateDetection();
  
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
  
  const handleComparisonClick = (duplicate: DuplicateMatch) => {
    // Only show comparison for database duplicates since queue duplicates don't have existing files to compare against
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

  const getBadgeText = (duplicate: DuplicateMatch) => {
    if (duplicate.sourceType === 'database' && 'matchType' in duplicate) {
      return duplicate.matchType === 'exact' ? 'Exact Database Match' : 'Similar Database Match';
    }
    return duplicate.sourceType === 'queue' ? 'Queue Duplicate' : 'Database Duplicate';
  };
  
  const FileThumbnail = ({ duplicate }: { duplicate: DuplicateMatch }) => {
    const { queueFile } = duplicate;
    
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
              Duplicate Files Found ({duplicates.length})
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Found files with identical names and sizes. Choose how to handle these duplicates.
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
              <div className="space-y-4">
                {/* Exact Duplicates */}
                {duplicates.filter(d => d.sourceType === 'queue' || (d.sourceType === 'database' && (!('matchType' in d) || d.matchType === 'exact'))).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Exact Duplicates ({duplicates.filter(d => d.sourceType === 'queue' || (d.sourceType === 'database' && (!('matchType' in d) || d.matchType === 'exact'))).length})
                    </h4>
                    <div className="space-y-3">
                      {duplicates.filter(d => d.sourceType === 'queue' || (d.sourceType === 'database' && (!('matchType' in d) || d.matchType === 'exact'))).map((duplicate) => (
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
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline">Queue File (New)</Badge>
                                  <Badge variant="destructive">
                                    {getBadgeText(duplicate)}
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
                                <div className="text-xs text-muted-foreground">
                                  Match: Same filename and size | Source: {duplicate.sourceType}
                                </div>
                              </div>
                              
                              {/* Duplicate source (existing file or queue file) */}
                              <div className="space-y-1">
                                {duplicate.sourceType === 'database' ? (
                                  <>
                                    <Badge variant="secondary" className="mb-1 flex items-center gap-1">
                                      <Database className="w-3 h-3" />
                                      Existing in Library
                                    </Badge>
                                    <p className="font-medium text-sm truncate" title={'existingFile' in duplicate ? duplicate.existingFile.original_filename : ''}>
                                      {'existingFile' in duplicate ? (duplicate.existingFile.title || duplicate.existingFile.original_filename) : ''}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <Calendar className="w-3 h-3" />
                                      <span>{'existingFile' in duplicate ? formatDate(duplicate.existingFile.created_at) : ''}</span>
                                      <span>•</span>
                                      <Badge variant="outline">
                                        {'existingFile' in duplicate ? duplicate.existingFile.processing_status : ''}
                                      </Badge>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <Badge variant="destructive" className="mb-1">
                                      Duplicate in Queue
                                    </Badge>
                                    <p className="font-medium text-sm truncate" title={'duplicateFile' in duplicate ? duplicate.duplicateFile.file.name : ''}>
                                      {'duplicateFile' in duplicate ? duplicate.duplicateFile.file.name : ''}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      {duplicate.sourceType === 'queue' && 'duplicateFile' in duplicate && getFileIcon(duplicate.duplicateFile.file.type)}
                                      <span>{'duplicateFile' in duplicate ? formatFileSize(duplicate.duplicateFile.file.size) : ''}</span>
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
                            {duplicate.sourceType === 'database' ? 'Compare' : 'No Preview'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Similar Files */}
                {duplicates.filter(d => d.sourceType === 'database' && 'matchType' in d && d.matchType === 'similar').length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Search className="h-4 w-4 text-orange-500" />
                      Similar Files ({duplicates.filter(d => d.sourceType === 'database' && 'matchType' in d && d.matchType === 'similar').length})
                    </h4>
                    <div className="space-y-3">
                      {duplicates.filter(d => d.sourceType === 'database' && 'matchType' in d && d.matchType === 'similar').map((duplicate) => (
                        <div 
                          key={duplicate.queueFile.id}
                          className="flex items-center gap-4 p-4 border rounded-lg bg-orange-50/50 hover:bg-orange-50/70 transition-colors"
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
                                  <Badge variant="outline">Queue File (New)</Badge>
                                  <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                                    {getBadgeText(duplicate)}
                                  </Badge>
                                  {'similarity' in duplicate && duplicate.similarity && (
                                    <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                                      {duplicate.similarity}% similar
                                    </Badge>
                                  )}
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
                                <div className="text-xs text-muted-foreground">
                                  Match: Similar filename, same size | Source: {duplicate.sourceType}
                                </div>
                              </div>
                              
                              {/* Duplicate source */}
                              <div className="space-y-1">
                                <Badge variant="secondary" className="mb-1 flex items-center gap-1">
                                  <Database className="w-3 h-3" />
                                  Similar in Library
                                </Badge>
                                <p className="font-medium text-sm truncate" title={'existingFile' in duplicate ? duplicate.existingFile.original_filename : ''}>
                                  {'existingFile' in duplicate ? (duplicate.existingFile.title || duplicate.existingFile.original_filename) : ''}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Calendar className="w-3 h-3" />
                                  <span>{'existingFile' in duplicate ? formatDate(duplicate.existingFile.created_at) : ''}</span>
                                  <span>•</span>
                                  <Badge variant="outline">
                                    {'existingFile' in duplicate ? duplicate.existingFile.processing_status : ''}
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
                  </div>
                )}
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

      {/* File comparison dialog - only for database duplicates */}
      {selectedDuplicateForComparison && selectedDuplicateForComparison.sourceType === 'database' && 'existingFile' in selectedDuplicateForComparison && (
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
