import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  FileImage, 
  FileVideo, 
  FileAudio, 
  FileText as FileDoc,
  X, 
  CheckCircle, 
  AtSign, 
  Hash, 
  FolderOpen, 
  FileText, 
  DollarSign,
  Eye,
  Pause,
  Play,
  AlertCircle,
  Clock
} from 'lucide-react';
import { MentionsDialog } from './MentionsDialog';
import { TagsDialog } from './TagsDialog';
import { FolderSelectDialog } from './FolderSelectDialog';
import { DescriptionDialog } from './DescriptionDialog';
import { PriceDialog } from './PriceDialog';

import { FileUploadItem } from '@/hooks/useFileUpload';

interface EnhancedFileUploadRowProps {
  item: FileUploadItem;
  index: number;
  currentUploadIndex: number;
  isUploading: boolean;
  onRemove: (id: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onCancel?: (id: string) => void;
  onMetadataChange: (id: string, metadata: Partial<FileUploadItem['metadata']>) => void;
  onToggleSelection?: (id: string) => void;
  getStatusIcon: (status: string) => React.ReactNode;
  formatFileSize: (bytes: number) => string;
  onPreview?: () => void;
}

export function EnhancedFileUploadRow({
  item,
  index,
  currentUploadIndex,
  isUploading,
  onRemove,
  onPause,
  onResume,
  onCancel,
  onMetadataChange,
  onToggleSelection,
  getStatusIcon,
  formatFileSize,
  onPreview
}: EnhancedFileUploadRowProps) {
  // Dialog states
  const [mentionsDialogOpen, setMentionsDialogOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [foldersDialogOpen, setFoldersDialogOpen] = useState(false);
  const [descriptionDialogOpen, setDescriptionDialogOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <FileImage className="w-6 h-6" />;
    if (file.type.startsWith('video/')) return <FileVideo className="w-6 h-6" />;
    if (file.type.startsWith('audio/')) return <FileAudio className="w-6 h-6" />;
    return <FileDoc className="w-6 h-6" />;
  };

  const handleMetadataUpdate = (field: keyof NonNullable<FileUploadItem['metadata']>, value: any) => {
    const currentMetadata = item.metadata || {
      mentions: [],
      tags: [],
      folders: [],
      description: '',
      suggestedPrice: null,
    };
    onMetadataChange(item.id, { ...currentMetadata, [field]: value });
  };

  const handleDoubleClick = () => {
    console.log('Double-click detected on file:', item.file.name);
    onPreview?.();
  };

  const isCurrentlyUploading = item.status === 'uploading' || item.status === 'processing';
  const canEditMetadata = !isUploading || item.status === 'pending' || item.status === 'error';

  // Get highlighting class based on metadata and selection
  const getHighlightClass = () => {
    const hasMetadata = item.metadata?.mentions?.length || item.metadata?.tags?.length || item.metadata?.folders?.length;
    const hasDetails = item.metadata?.description || item.metadata?.suggestedPrice;
    
    if (item.selected && hasMetadata) return "bg-green-100 border-green-300 dark:bg-green-950 dark:border-green-700";
    if (item.selected) return "bg-primary/10 border-primary";
    if (hasMetadata) return "bg-green-50 border-green-200 dark:bg-green-950/50 dark:border-green-800";
    if (hasDetails) return "bg-blue-50 border-blue-200 dark:bg-blue-950/50 dark:border-blue-800";
    return "hover:bg-muted/50";
  };

  const formatUploadSpeed = (bytesPerSecond: number): string => {
    if (!bytesPerSecond) return '';
    if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  const getFileExtension = () => {
    return '.' + (item.file.name.split('.').pop()?.toLowerCase() || '');
  };

  return (
    <>
      <Card className={`p-4 transition-colors ${getHighlightClass()}`}>
        <div className="space-y-3">
          {/* File Info Row */}
          <div 
            className="flex items-center gap-4 cursor-pointer" 
            onDoubleClick={handleDoubleClick}
            title="Double-click to preview"
          >
            {/* Selection checkbox - hide during upload */}
            {onToggleSelection && !isUploading && (
              <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={item.selected || false}
                  onCheckedChange={() => onToggleSelection(item.id)}
                  disabled={isCurrentlyUploading}
                />
              </div>
            )}
            
            <div className="text-muted-foreground">
              {getFileIcon(item.file)}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{item.file.name}</p>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <span>{formatFileSize(item.file.size)}</span>
                {/* Optimization info for images */}
                {item.optimizationInfo && (
                  <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded">
                    Optimized: {formatFileSize(item.optimizationInfo.originalSize)} → {formatFileSize(item.optimizationInfo.optimizedSize)} 
                    ({item.optimizationInfo.percentSaved}% saved)
                  </span>
                )}
                {/* Upload progress info */}
                {item.uploadedBytes && item.totalBytes && (
                  <span className="ml-2">
                    ({formatFileSize(item.uploadedBytes)} / {formatFileSize(item.totalBytes)})
                  </span>
                )}
              </div>
              {item.error && (
                <p className="text-sm text-destructive mt-1">{item.error}</p>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {/* File type badge */}
              <Badge variant="secondary" className="text-xs">
                {getFileExtension()}
              </Badge>
              
              {/* Progress bar (positioned to the right of file extension) */}
              {(item.status === 'uploading' || item.status === 'processing') && (
                <div className="flex flex-col items-end gap-1 min-w-[120px]">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{item.progress}%</span>
                    {item.uploadSpeed && (
                      <span className="text-primary">{formatUploadSpeed(item.uploadSpeed)}</span>
                    )}
                  </div>
                  <Progress value={item.progress} className="h-2 w-full" />
                  {item.status === 'processing' && (
                    <span className="text-xs text-orange-600 dark:text-orange-400">Processing...</span>
                  )}
                </div>
              )}
              
              {getStatusIcon(item.status)}
              
              {/* Action buttons for upload control */}
              {isCurrentlyUploading && onPause && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onPause(item.id)}
                >
                  <Pause className="w-4 h-4" />
                </Button>
              )}
              
              {item.status === 'paused' && onResume && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onResume(item.id)}
                >
                  <Play className="w-4 h-4" />
                </Button>
              )}
              
              {(item.status === 'uploading' || item.status === 'pending') && onCancel && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCancel(item.id)}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
              
              {item.status === 'completed' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onPreview?.()}
                  className="text-xs"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Preview
                </Button>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(item.id)}
                title={isCurrentlyUploading ? "Cancel upload" : "Remove from queue"}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Metadata Editing Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMentionsDialogOpen(true)}
              className="text-xs"
              disabled={!canEditMetadata}
            >
              <AtSign className="w-3 h-3 mr-1" />
              Mentions {item.metadata?.mentions && item.metadata.mentions.length > 0 && `(${item.metadata.mentions.length})`}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTagsDialogOpen(true)}
              className="text-xs"
              disabled={!canEditMetadata}
            >
              <Hash className="w-3 h-3 mr-1" />
              Tags {item.metadata?.tags && item.metadata.tags.length > 0 && `(${item.metadata.tags.length})`}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFoldersDialogOpen(true)}
              className="text-xs"
              disabled={!canEditMetadata}
            >
              <FolderOpen className="w-3 h-3 mr-1" />
              Folders {item.metadata?.folders && item.metadata.folders.length > 0 && `(${item.metadata.folders.length})`}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDescriptionDialogOpen(true)}
              className="text-xs"
              disabled={!canEditMetadata}
            >
              <FileText className="w-3 h-3 mr-1" />
              Description {item.metadata?.description && '✓'}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPriceDialogOpen(true)}
              className="text-xs"
              disabled={!canEditMetadata}
            >
              <DollarSign className="w-3 h-3 mr-1" />
              Price {item.metadata?.suggestedPrice && item.metadata.suggestedPrice > 0 && `($${item.metadata.suggestedPrice.toFixed(2)})`}
            </Button>
          </div>

          {/* Show current metadata values */}
          {item.metadata && (
            <div className="space-y-1 text-xs text-muted-foreground">
              {item.metadata.mentions && item.metadata.mentions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="font-medium">Mentions:</span>
                  {item.metadata.mentions.map(mention => (
                    <Badge key={mention} variant="secondary" className="text-xs">{mention}</Badge>
                  ))}
                </div>
              )}
              {item.metadata.tags && item.metadata.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="font-medium">Tags:</span>
                  {item.metadata.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              )}
              {item.metadata.description && (
                <div>
                  <span className="font-medium">Description:</span> {item.metadata.description.length > 60 ? `${item.metadata.description.substring(0, 60)}...` : item.metadata.description}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* All the metadata editing dialogs */}
      <MentionsDialog
        open={mentionsDialogOpen}
        onOpenChange={setMentionsDialogOpen}
        mentions={item.metadata?.mentions || []}
        onMentionsChange={(mentions) => handleMetadataUpdate('mentions', mentions)}
      />
      
      <TagsDialog
        open={tagsDialogOpen}
        onOpenChange={setTagsDialogOpen}
        tags={item.metadata?.tags || []}
        onTagsChange={(tags) => handleMetadataUpdate('tags', tags)}
      />
      
      <FolderSelectDialog
        open={foldersDialogOpen}
        onOpenChange={setFoldersDialogOpen}
        selectedFolders={item.metadata?.folders || []}
        onFoldersChange={(folders) => handleMetadataUpdate('folders', folders)}
      />
      
      <DescriptionDialog
        open={descriptionDialogOpen}
        onOpenChange={setDescriptionDialogOpen}
        description={item.metadata?.description || ''}
        onDescriptionChange={(description) => handleMetadataUpdate('description', description)}
      />
      
      <PriceDialog
        open={priceDialogOpen}
        onOpenChange={setPriceDialogOpen}
        price={item.metadata?.suggestedPrice || null}
        onPriceChange={(price) => handleMetadataUpdate('suggestedPrice', price)}
      />
    </>
  );
}