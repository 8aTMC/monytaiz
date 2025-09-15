import React, { useState, useCallback, memo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { FileImage, FileVideo, FileAudio, X, AtSign, Hash, FolderOpen, FileText, DollarSign, Eye } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { UploadedFileWithMetadata } from '@/components/FileUploadRowWithMetadata';
import { MentionsDialog } from './MentionsDialog';
import { TagsDialog } from './TagsDialog';
import { FolderSelectDialog } from './FolderSelectDialog';
import { DescriptionDialog } from './DescriptionDialog';
import { PriceDialog } from './PriceDialog';
import { FilePreviewDialog } from './FilePreviewDialog';
import { useOptimizedThumbnail } from '@/hooks/useOptimizedThumbnail';
import { Skeleton } from '@/components/ui/skeleton';

interface OptimizedFileReviewRowProps {
  file: UploadedFileWithMetadata & {
    uploadProgress?: number;
    uploadMessage?: string;
    uploadPhase?: string;
  };
  files?: UploadedFileWithMetadata[];
  currentIndex?: number;
  onRemove: (id: string) => void;
  onMetadataChange?: (id: string, metadata: Partial<UploadedFileWithMetadata['metadata']>) => void;
  onSelectionChange?: (id: string, selected: boolean, options?: { range?: boolean; index?: number }) => void;
  onNavigateToFile?: (index: number) => void;
  formatFileSize: (bytes: number) => string;
  selectionMode?: boolean;
  onEnterSelectionMode?: () => void;
}

const getFileIcon = (fileType: string) => {
  if (fileType.startsWith('image/')) return <FileImage className="w-6 h-6" />;
  if (fileType.startsWith('video/')) return <FileVideo className="w-6 h-6" />;
  if (fileType.startsWith('audio/')) return <FileAudio className="w-6 h-6" />;
  return <FileImage className="w-6 h-6" />;
};

function OptimizedFileReviewRowComponent({ 
  file, 
  files, 
  currentIndex, 
  onRemove, 
  onMetadataChange, 
  onSelectionChange, 
  onNavigateToFile, 
  formatFileSize,
  selectionMode = false,
  onEnterSelectionMode
}: OptimizedFileReviewRowProps) {
  const { thumbnail, isLoading } = useOptimizedThumbnail(file.file);
  
  // Dialog states
  const [mentionsDialogOpen, setMentionsDialogOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [foldersDialogOpen, setFoldersDialogOpen] = useState(false);
  const [descriptionDialogOpen, setDescriptionDialogOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  const handleDoubleClick = useCallback(() => {
    setPreviewDialogOpen(true);
  }, []);
  
  const handleMetadataUpdate = useCallback((field: keyof UploadedFileWithMetadata['metadata'], value: any) => {
    if (onMetadataChange) {
      onMetadataChange(file.id, { [field]: value });
    }
  }, [file.id, onMetadataChange]);

  const handleRemove = useCallback(() => {
    onRemove(file.id);
  }, [file.id, onRemove]);

  const handleSelectionChange = useCallback((checked: boolean, e?: React.MouseEvent) => {
    if (onSelectionChange && currentIndex !== undefined) {
      // Activate selection mode when checkbox is clicked
      onEnterSelectionMode?.();
      
      // Check if this is a range selection (Shift/Alt + click)
      const isRangeSelection = e && (e.shiftKey || e.altKey);
      
      if (isRangeSelection) {
        // Prevent text selection during range operations
        e.preventDefault();
        window.getSelection()?.removeAllRanges();
        onSelectionChange(file.id, true, { 
          range: true, 
          index: currentIndex 
        });
      } else {
        onSelectionChange(file.id, checked, { 
          range: false, 
          index: currentIndex 
        });
      }
    }
  }, [file.id, onSelectionChange, onEnterSelectionMode, currentIndex]);

  const handleRowClick = useCallback((e: React.MouseEvent) => {
    // Check if the click was on a button or input element
    const target = e.target as HTMLElement;
    const isButton = target.closest('button') || target.closest('input') || target.hasAttribute('role');
    
    if (isButton) {
      // Let buttons handle their own clicks
      return;
    }

    if (onSelectionChange && files && currentIndex !== undefined) {
      const isRangeSelection = e.shiftKey || e.altKey;
      
      // Prevent text selection during range operations
      if (isRangeSelection) {
        e.preventDefault();
        window.getSelection()?.removeAllRanges();
      }
      
      if (isRangeSelection) {
        // Range selection: automatically enter selection mode and process selection
        if (onEnterSelectionMode) {
          onEnterSelectionMode();
        }
        onSelectionChange(file.id, !file.selected, { 
          range: true, 
          index: currentIndex 
        });
      } else if (selectionMode) {
        // In selection mode: clicking the row selects/deselects
        onSelectionChange(file.id, !file.selected, { 
          range: false, 
          index: currentIndex 
        });
      } else {
        // Not in selection mode: open preview
        setPreviewDialogOpen(true);
      }
    } else if (!selectionMode) {
      // No selection callback but not in selection mode: open preview
      setPreviewDialogOpen(true);
    }
  }, [onSelectionChange, file.id, file.selected, files, currentIndex, selectionMode, onEnterSelectionMode]);

  // Memoize metadata calculations
  const hasMetadata = file.metadata.mentions.length > 0 || 
                     file.metadata.tags.length > 0 || 
                     file.metadata.folders.length > 0;
  const hasContentData = file.metadata.description || 
                        (file.metadata.suggestedPrice && file.metadata.suggestedPrice > 0);
  
  let cardClassName = "p-3 hover:bg-muted/50 transition-colors cursor-pointer relative bg-card text-card-foreground";
  
  if (file.selected) {
    cardClassName = "p-3 transition-colors cursor-pointer relative bg-primary/10 text-foreground border-2 border-primary hover:bg-primary/20";
  }

  return (
    <>
      <Card 
        className={cardClassName}
        onClick={handleRowClick}
        onDoubleClick={handleDoubleClick}
        title="Click to select, double-click to preview"
      >
        <div className="flex items-center gap-4">
          {/* Selection Checkbox */}
          {onSelectionChange && (
            <div className="flex-shrink-0">
              <Checkbox
                checked={file.selected || false}
                onCheckedChange={(checked) => {
                  if (typeof checked === 'boolean') {
                    handleSelectionChange(checked);
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  // Handle range selection on checkbox click
                  const isRangeSelection = e.shiftKey || e.altKey;
                  if (isRangeSelection) {
                    handleSelectionChange(true, e);
                  }
                }}
                className="w-5 h-5"
              />
            </div>
          )}
          
          {/* Thumbnail */}
          <div className="flex-shrink-0 w-20 h-16 bg-muted rounded-lg overflow-hidden flex items-center justify-center">
            {isLoading ? (
              <Skeleton className="w-full h-full" />
            ) : thumbnail ? (
              <img 
                src={thumbnail} 
                alt={file.file.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="text-muted-foreground">
                {getFileIcon(file.file.type)}
              </div>
            )}
          </div>

          {/* File Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate text-foreground">{file.file.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatFileSize(file.file.size)} • {file.file.type}
                </p>
                
                {/* Upload Progress */}
                {file.status === 'uploading' && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">
                        {file.uploadMessage || 'Uploading...'}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {file.uploadProgress || 0}%
                      </span>
                    </div>
                    <Progress value={file.uploadProgress || 0} className="h-2" />
                  </div>
                )}
                
                {/* Metadata Preview */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {file.metadata.mentions.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {file.metadata.mentions.length} mentions
                    </Badge>
                  )}
                  {file.metadata.tags.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {file.metadata.tags.length} tags
                    </Badge>
                  )}
                  {file.metadata.folders.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {file.metadata.folders.length} folders
                    </Badge>
                  )}
                  {file.metadata.description && (
                    <Badge variant="secondary" className="text-xs">
                      Description added
                    </Badge>
                  )}
                  {file.metadata.suggestedPrice && file.metadata.suggestedPrice > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      ${file.metadata.suggestedPrice.toFixed(2)}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 ml-4">
                {file.status !== 'uploading' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleDoubleClick(); }}
                    className="text-xs"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Preview
                  </Button>
                )}
                {file.status !== 'uploading' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleRemove(); }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
            
            {/* Metadata Editing Buttons */}
            {onMetadataChange && file.status !== 'uploading' && (
              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  variant={file.metadata.mentions.length > 0 ? "default" : "outline"}
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setMentionsDialogOpen(true); }}
                  className="text-xs"
                >
                  <AtSign className="w-3 h-3 mr-1" />
                  Mentions {file.metadata.mentions.length > 0 && `(${file.metadata.mentions.length})`}
                </Button>
                
                <Button
                  variant={file.metadata.tags.length > 0 ? "default" : "outline"}
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setTagsDialogOpen(true); }}
                  className="text-xs"
                >
                  <Hash className="w-3 h-3 mr-1" />
                  Tags {file.metadata.tags.length > 0 && `(${file.metadata.tags.length})`}
                </Button>
                
                <Button
                  variant={file.metadata.folders.length > 0 ? "default" : "outline"}
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setFoldersDialogOpen(true); }}
                  className="text-xs"
                >
                  <FolderOpen className="w-3 h-3 mr-1" />
                  Folders {file.metadata.folders.length > 0 && `(${file.metadata.folders.length})`}
                </Button>
                
                <Button
                  variant={file.metadata.description ? "default" : "outline"}
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setDescriptionDialogOpen(true); }}
                  className="text-xs"
                >
                  <FileText className="w-3 h-3 mr-1" />
                  Description {file.metadata.description && '✓'}
                </Button>
                
                <Button
                  variant={file.metadata.suggestedPrice && file.metadata.suggestedPrice > 0 ? "default" : "outline"}
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setPriceDialogOpen(true); }}
                  className="text-xs"
                >
                  <DollarSign className="w-3 h-3 mr-1" />
                  Price {file.metadata.suggestedPrice && file.metadata.suggestedPrice > 0 && `($${file.metadata.suggestedPrice.toFixed(2)})`}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Metadata editing dialogs */}
      {onMetadataChange && (
        <>
          <MentionsDialog
            open={mentionsDialogOpen}
            onOpenChange={setMentionsDialogOpen}
            mentions={file.metadata.mentions}
            onMentionsChange={(mentions) => handleMetadataUpdate('mentions', mentions)}
          />
          
          <TagsDialog
            open={tagsDialogOpen}
            onOpenChange={setTagsDialogOpen}
            tags={file.metadata.tags}
            onTagsChange={(tags) => handleMetadataUpdate('tags', tags)}
          />
          
          <FolderSelectDialog
            open={foldersDialogOpen}
            onOpenChange={setFoldersDialogOpen}
            selectedFolders={file.metadata.folders}
            onFoldersChange={(folders) => handleMetadataUpdate('folders', folders)}
          />
          
          <DescriptionDialog
            open={descriptionDialogOpen}
            onOpenChange={setDescriptionDialogOpen}
            description={file.metadata.description}
            onDescriptionChange={(description) => handleMetadataUpdate('description', description)}
          />
          
          <PriceDialog
            open={priceDialogOpen}
            onOpenChange={setPriceDialogOpen}
            price={file.metadata.suggestedPrice}
            onPriceChange={(price) => handleMetadataUpdate('suggestedPrice', price)}
          />
        </>
      )}
      
      {/* Preview dialog */}
      <FilePreviewDialog
        file={file.file}
        files={files?.map(f => ({ id: f.id, file: f.file }))}
        totalFiles={files?.length || 1}
        currentIndex={files?.findIndex(f => f.id === file.id) ?? 0}
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
        mentions={file.metadata?.mentions || []}
        tags={file.metadata?.tags || []}
        folders={file.metadata?.folders || []}
        description={file.metadata?.description || ''}
        suggestedPrice={file.metadata?.suggestedPrice ? file.metadata.suggestedPrice * 100 : 0}
        title={file.file.name}
        onMentionsChange={onMetadataChange ? (mentions) => handleMetadataUpdate('mentions', mentions) : undefined}
        onTagsChange={onMetadataChange ? (tags) => handleMetadataUpdate('tags', tags) : undefined}
        onFoldersChange={onMetadataChange ? (folders) => handleMetadataUpdate('folders', folders) : undefined}
        onDescriptionChange={onMetadataChange ? (description) => handleMetadataUpdate('description', description) : undefined}
        onPriceChange={onMetadataChange ? (price) => handleMetadataUpdate('suggestedPrice', price ? price / 100 : null) : undefined}
        selecting={!!onSelectionChange}
        selectedFiles={new Set(files?.filter(f => f.selected).map(f => f.id) || [])}
        onToggleSelection={onSelectionChange ? (targetId) => {
          if (onEnterSelectionMode) {
            onEnterSelectionMode();
          }
          const target = files?.find(f => f.id === targetId);
          onSelectionChange(targetId, !(target?.selected ?? false));
        } : undefined}
        fileId={file.id}
      />
    </>
  );
}

// Memoize with custom comparison function
export const OptimizedFileReviewRow = memo(OptimizedFileReviewRowComponent, (prevProps, nextProps) => {
  // Only re-render if the file data or key props actually changed
  return (
    prevProps.file.id === nextProps.file.id &&
    prevProps.file.selected === nextProps.file.selected &&
    prevProps.file.metadata === nextProps.file.metadata &&
    prevProps.currentIndex === nextProps.currentIndex &&
    prevProps.files?.length === nextProps.files?.length
  );
});