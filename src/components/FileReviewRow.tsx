import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileImage, FileVideo, FileAudio, X, AtSign, Hash, FolderOpen, FileText, DollarSign } from 'lucide-react';
import { UploadedFileWithMetadata } from '@/components/FileUploadRowWithMetadata';
import { MentionsDialog } from './MentionsDialog';
import { TagsDialog } from './TagsDialog';
import { FolderSelectDialog } from './FolderSelectDialog';
import { DescriptionDialog } from './DescriptionDialog';
import { PriceDialog } from './PriceDialog';

interface FileReviewRowProps {
  file: UploadedFileWithMetadata;
  onRemove: (id: string) => void;
  onMetadataChange?: (id: string, metadata: Partial<UploadedFileWithMetadata['metadata']>) => void;
  formatFileSize: (bytes: number) => string;
}

export function FileReviewRow({ file, onRemove, onMetadataChange, formatFileSize }: FileReviewRowProps) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  
  // Dialog states
  const [mentionsDialogOpen, setMentionsDialogOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [foldersDialogOpen, setFoldersDialogOpen] = useState(false);
  const [descriptionDialogOpen, setDescriptionDialogOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);

  const handleMetadataUpdate = (field: keyof UploadedFileWithMetadata['metadata'], value: any) => {
    if (onMetadataChange) {
      onMetadataChange(file.id, { [field]: value });
    }
  };

  useEffect(() => {
    const generateThumbnail = async () => {
      if (file.file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file.file);
        setThumbnail(url);
        return () => URL.revokeObjectURL(url);
      } else if (file.file.type.startsWith('video/')) {
        // Generate video thumbnail
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        video.onloadedmetadata = () => {
          canvas.width = 120;
          canvas.height = 80;
          video.currentTime = Math.min(2, video.duration / 2); // 2 seconds or middle
        };
        
        video.onseeked = () => {
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
            setThumbnail(thumbnailUrl);
          }
          URL.revokeObjectURL(video.src);
        };
        
        video.src = URL.createObjectURL(file.file);
        video.load();
      }
    };

    generateThumbnail();
  }, [file.file]);

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <FileImage className="w-6 h-6" />;
    if (fileType.startsWith('video/')) return <FileVideo className="w-6 h-6" />;
    if (fileType.startsWith('audio/')) return <FileAudio className="w-6 h-6" />;
    return <FileImage className="w-6 h-6" />;
  };

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center gap-4">
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
    </>
  );
}