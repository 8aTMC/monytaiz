import React, { useState, useEffect } from 'react';
import { useBlobUrl } from '@/hooks/useBlobUrl';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileImage, FileVideo, FileAudio, X, AtSign, Hash, FolderOpen, FileText, DollarSign, Eye } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { UploadedFileWithMetadata } from '@/components/FileUploadRowWithMetadata';
import { MentionsDialog } from './MentionsDialog';
import { TagsDialog } from './TagsDialog';
import { FolderSelectDialog } from './FolderSelectDialog';
import { DescriptionDialog } from './DescriptionDialog';
import { PriceDialog } from './PriceDialog';
import { FilePreviewDialog } from './FilePreviewDialog';

interface FileReviewRowProps {
  file: UploadedFileWithMetadata;
  files?: UploadedFileWithMetadata[];
  currentIndex?: number;
  onRemove: (id: string) => void;
  onMetadataChange?: (id: string, metadata: Partial<UploadedFileWithMetadata['metadata']>) => void;
  onSelectionChange?: (id: string, selected: boolean) => void;
  onNavigateToFile?: (index: number) => void;
  formatFileSize: (bytes: number) => string;
}

export function FileReviewRow({ file, files, currentIndex, onRemove, onMetadataChange, onSelectionChange, onNavigateToFile, formatFileSize }: FileReviewRowProps) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const { createBlobUrl, revokeBlobUrl } = useBlobUrl();
  
  // Dialog states
  const [mentionsDialogOpen, setMentionsDialogOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [foldersDialogOpen, setFoldersDialogOpen] = useState(false);
  const [descriptionDialogOpen, setDescriptionDialogOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  const handleDoubleClick = () => {
    console.log('Double-click detected on file:', file.file.name);
    setPreviewDialogOpen(true);
  };
  
  const handleMetadataUpdate = (field: keyof UploadedFileWithMetadata['metadata'], value: any) => {
    if (onMetadataChange) {
      onMetadataChange(file.id, { [field]: value });
    }
  };

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (file.file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setThumbnail(e.target.result as string);
        }
      };
      reader.onerror = () => setThumbnail(null);
      reader.readAsDataURL(file.file);
    } else if (file.file.type.startsWith('video/')) {
      let videoUrl: string | null = null;
      
      try {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          console.warn('Canvas context not available for thumbnail generation');
          return;
        }

        video.preload = 'metadata';
        video.muted = true;
        
        video.onloadedmetadata = () => {
          try {
            canvas.width = 120;
            canvas.height = 80;
            video.currentTime = Math.min(2, video.duration / 2); // 2 seconds or middle
          } catch (error) {
            console.warn('Failed to seek video for thumbnail:', error);
            cleanup?.();
          }
        };

        video.onseeked = () => {
          try {
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
              setThumbnail(thumbnailUrl);
            }
          } catch (error) {
            console.warn('Failed to generate video thumbnail:', error);
          } finally {
            cleanup?.();
          }
        };

        video.onerror = () => {
          console.warn('Video loading failed for thumbnail generation');
          cleanup?.();
        };

        videoUrl = createBlobUrl(file.file);
        video.src = videoUrl;

        cleanup = () => {
          video.pause();
          video.src = '';
          if (videoUrl) {
            revokeBlobUrl(videoUrl);
            videoUrl = null;
          }
          try {
            video.remove();
            canvas.remove();
          } catch (error) {
            // Ignore cleanup errors
          }
        };
      } catch (error) {
        console.warn('Failed to create video thumbnail:', error);
        setThumbnail(null);
      }
    }

    return cleanup;
  }, [file.file, createBlobUrl, revokeBlobUrl]);

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <FileImage className="w-6 h-6" />;
    if (fileType.startsWith('video/')) return <FileVideo className="w-6 h-6" />;
    if (fileType.startsWith('audio/')) return <FileAudio className="w-6 h-6" />;
    return <FileImage className="w-6 h-6" />;
  };

  // Determine card styling based on selection and metadata
  const hasMetadata = file.metadata.mentions.length > 0 || 
                     file.metadata.tags.length > 0 || 
                     file.metadata.folders.length > 0;
  const hasContentData = file.metadata.description || 
                        (file.metadata.suggestedPrice && file.metadata.suggestedPrice > 0);
  
  let cardClassName = "p-4 hover:bg-muted/50 transition-colors cursor-pointer relative";
  
  if (file.selected) {
    cardClassName = hasMetadata 
      ? "p-4 transition-colors cursor-pointer relative bg-green-100 border-green-300 hover:bg-green-100"
      : "p-4 transition-colors cursor-pointer relative bg-primary/10 border-primary hover:bg-primary/10";
  } else if (hasMetadata) {
    cardClassName = "p-4 transition-colors cursor-pointer relative bg-green-50 border-green-200 hover:bg-green-100";
  } else if (hasContentData) {
    cardClassName = "p-4 transition-colors cursor-pointer relative bg-blue-50 border-blue-200 hover:bg-blue-100";
  }

  return (
    <>
      <Card 
        className={cardClassName}
        onDoubleClick={handleDoubleClick}
        title="Double-click to preview"
      >
        <div className="flex items-center gap-4">
          {/* Selection Checkbox */}
          {onSelectionChange && (
            <div className="flex-shrink-0">
              <Checkbox
                checked={file.selected || false}
                onCheckedChange={(checked) => onSelectionChange(file.id, checked === true)}
                className="w-5 h-5"
              />
            </div>
          )}
          {/* Thumbnail */}
          <div className="flex-shrink-0 w-20 h-16 bg-muted rounded-lg overflow-hidden flex items-center justify-center">
            {thumbnail ? (
              <img 
                src={thumbnail} 
                alt={file.file.name}
                className="w-full h-full object-cover"
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDoubleClick}
                  className="text-xs"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Preview
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(file.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {/* Metadata Editing Buttons */}
            {onMetadataChange && (
              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMentionsDialogOpen(true)}
                  className="text-xs"
                >
                  <AtSign className="w-3 h-3 mr-1" />
                  Mentions {file.metadata.mentions.length > 0 && `(${file.metadata.mentions.length})`}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTagsDialogOpen(true)}
                  className="text-xs"
                >
                  <Hash className="w-3 h-3 mr-1" />
                  Tags {file.metadata.tags.length > 0 && `(${file.metadata.tags.length})`}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFoldersDialogOpen(true)}
                  className="text-xs"
                >
                  <FolderOpen className="w-3 h-3 mr-1" />
                  Folders {file.metadata.folders.length > 0 && `(${file.metadata.folders.length})`}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDescriptionDialogOpen(true)}
                  className="text-xs"
                >
                  <FileText className="w-3 h-3 mr-1" />
                  Description {file.metadata.description && '✓'}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPriceDialogOpen(true)}
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
        files={files?.map(f => f.file) || []}
        totalFiles={files?.length || 1}
        currentIndex={currentIndex || 0}
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
        getMetadataById={(fileId) => {
          const target = files?.find(f => f.id === fileId);
          if (!target) return null;
          return {
            mentions: target.metadata?.mentions || [],
            tags: target.metadata?.tags || [],
            folders: target.metadata?.folders || [],
            description: target.metadata?.description || '',
            suggestedPrice: target.metadata?.suggestedPrice || null,
          };
        }}
        updateMetadataById={onMetadataChange ? (fileId, changes) => {
          onMetadataChange(fileId, changes);
        } : undefined}
        selecting={!!onSelectionChange}
        selectedFiles={new Set(files?.filter(f => f.selected).map(f => f.id) || [])}
        onToggleSelection={onSelectionChange ? (targetId) => {
          const target = files?.find(f => f.id === targetId);
          onSelectionChange(targetId, !(target?.selected ?? false));
        } : undefined}
        fileId={file.id}
      />
    </>
  );
}