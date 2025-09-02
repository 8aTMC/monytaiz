import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import { FilePreviewDialog } from './FilePreviewDialog';
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
  getStatusIcon: (status: string) => React.ReactNode;
  formatFileSize: (bytes: number) => string;
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
  getStatusIcon,
  formatFileSize
}: EnhancedFileUploadRowProps) {
  // Dialog states
  const [mentionsDialogOpen, setMentionsDialogOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [foldersDialogOpen, setFoldersDialogOpen] = useState(false);
  const [descriptionDialogOpen, setDescriptionDialogOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

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
    setPreviewDialogOpen(true);
  };

  const isCurrentlyUploading = item.status === 'uploading';
  const canEditMetadata = !isUploading || item.status === 'pending' || item.status === 'error';

  return (
    <>
      <Card className="p-4 hover:bg-muted/50 transition-colors">
        <div className="space-y-3">
          {/* File Info Row */}
          <div 
            className="flex items-center gap-4 cursor-pointer" 
            onDoubleClick={handleDoubleClick}
          >
            <div className="text-muted-foreground">
              {getFileIcon(item.file)}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{item.file.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(item.file.size)}
                {item.uploadedBytes && item.totalBytes && (
                  <span className="ml-2">
                    ({formatFileSize(item.uploadedBytes)} / {formatFileSize(item.totalBytes)})
                  </span>
                )}
              </p>
              {item.error && (
                <p className="text-sm text-destructive mt-1">{item.error}</p>
              )}
            </div>
            
            <div className="flex items-center gap-2">
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
                  onClick={handleDoubleClick}
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
                disabled={isCurrentlyUploading}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Progress bar for uploading files */}
          {(item.status === 'uploading' || item.status === 'paused') && (
            <Progress value={item.progress} className="h-2" />
          )}

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

      {/* Preview dialog */}
      <FilePreviewDialog
        file={item.file}
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
      />
    </>
  );
}