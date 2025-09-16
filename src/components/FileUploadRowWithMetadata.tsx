import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileImage, 
  FileVideo, 
  FileAudio, 
  X, 
  CheckCircle, 
  AtSign, 
  Hash, 
  FolderOpen, 
  FileText, 
  DollarSign,
  Eye
} from 'lucide-react';
import { MentionsDialog } from './MentionsDialog';
import { TagsDialog } from './TagsDialog';
import { FolderSelectDialog } from './FolderSelectDialog';
import { DescriptionDialog } from './DescriptionDialog';
import { PriceDialog } from './PriceDialog';
import { SimpleMediaPreviewAsync } from './SimpleMediaPreviewAsync';
import { SimpleMediaItem } from '@/hooks/useSimpleMedia';

export interface UploadedFileWithMetadata {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'validation_error' | 'paused' | 'cancelled';
  error?: string;
  selected?: boolean;
  metadata: {
    mentions: string[];
    tags: string[];
    folders: string[];
    description: string;
    suggestedPrice: number | null;
  };
}

interface FileUploadRowWithMetadataProps {
  uploadedFile: UploadedFileWithMetadata;
  onRemove: (id: string) => void;
  onMetadataChange: (id: string, metadata: Partial<UploadedFileWithMetadata['metadata']>) => void;
  disabled?: boolean;
  formatFileSize: (bytes: number) => string;
}

export function FileUploadRowWithMetadata({
  uploadedFile,
  onRemove,
  onMetadataChange,
  disabled = false,
  formatFileSize
}: FileUploadRowWithMetadataProps) {
  // Dialog states
  const [mentionsDialogOpen, setMentionsDialogOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [foldersDialogOpen, setFoldersDialogOpen] = useState(false);
  const [descriptionDialogOpen, setDescriptionDialogOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  // Helper to detect HEIC files by extension when MIME type is unreliable
  const isHeicFile = (file: File) => {
    const isHeic = /\.(heic|heif)$/i.test(file.name) || 
           file.type === 'image/heic' || 
           file.type === 'image/heif';
    console.log(`HEIC detection for ${file.name}: ${isHeic}, file.type: ${file.type}`);
    return isHeic;
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/') || isHeicFile(file)) return <FileImage className="w-6 h-6" />;
    if (file.type.startsWith('video/')) return <FileVideo className="w-6 h-6" />;
    if (file.type.startsWith('audio/')) return <FileAudio className="w-6 h-6" />;
    return <FileImage className="w-6 h-6" />;
  };

  const handleMetadataUpdate = (field: keyof UploadedFileWithMetadata['metadata'], value: any) => {
    onMetadataChange(uploadedFile.id, { [field]: value });
  };

  // Create a mock media item for preview with data URL to avoid blob URL issues
  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');
  
  React.useEffect(() => {
    if (uploadedFile.status === 'completed' && !previewDataUrl) {
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewDataUrl(reader.result as string);
      };
      reader.onerror = () => {
        console.warn('Failed to create preview data URL');
      };
      reader.readAsDataURL(uploadedFile.file);
    }
  }, [uploadedFile.status, uploadedFile.file, previewDataUrl]);

  const mockMediaItem = uploadedFile.status === 'completed' && previewDataUrl ? {
    id: uploadedFile.id,
    creator_id: '',
    original_filename: uploadedFile.file.name,
    title: uploadedFile.file.name,
    description: uploadedFile.metadata.description,
    tags: uploadedFile.metadata.tags,
    mentions: uploadedFile.metadata.mentions,
    suggested_price_cents: uploadedFile.metadata.suggestedPrice ? Math.round(uploadedFile.metadata.suggestedPrice * 100) : 0,
    original_path: '',
    processed_path: previewDataUrl,
    mime_type: uploadedFile.file.type,
    media_type: (() => {
      const isImage = uploadedFile.file.type.startsWith('image/') || isHeicFile(uploadedFile.file);
      const mediaType = isImage ? 'image' : 
                       uploadedFile.file.type.startsWith('video/') ? 'video' : 'audio';
      console.log(`Media type for ${uploadedFile.file.name}: ${mediaType}, isImage: ${isImage}`);
      return mediaType;
    })() as 'image' | 'video' | 'audio',
    original_size_bytes: uploadedFile.file.size,
    processing_status: 'processed' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } : null;

  const mockGetFullUrlAsync = async (item: SimpleMediaItem) => {
    return previewDataUrl;
  };

  return (
    <>
      <Card className="p-4">
        <div className="space-y-3">
          {/* File Info Row */}
          <div className="flex items-center gap-4">
            <div className="text-muted-foreground">
              {getFileIcon(uploadedFile.file)}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{uploadedFile.file.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(uploadedFile.file.size)}
              </p>
              {uploadedFile.error && (
                <p className="text-sm text-destructive mt-1">{uploadedFile.error}</p>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {uploadedFile.status === 'uploading' && (
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              )}
              {uploadedFile.status === 'completed' && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewDialogOpen(true)}
                    className="text-xs"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Preview
                  </Button>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </>
              )}
              {uploadedFile.status === 'error' && (
                <X className="w-5 h-5 text-destructive" />
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(uploadedFile.id)}
                disabled={disabled}
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
              disabled={disabled}
            >
              <AtSign className="w-3 h-3 mr-1" />
              Mentions {uploadedFile.metadata.mentions.length > 0 && `(${uploadedFile.metadata.mentions.length})`}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTagsDialogOpen(true)}
              className="text-xs"
              disabled={disabled}
            >
              <Hash className="w-3 h-3 mr-1" />
              Tags {uploadedFile.metadata.tags.length > 0 && `(${uploadedFile.metadata.tags.length})`}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFoldersDialogOpen(true)}
              className="text-xs"
              disabled={disabled}
            >
              <FolderOpen className="w-3 h-3 mr-1" />
              Folders {uploadedFile.metadata.folders.length > 0 && `(${uploadedFile.metadata.folders.length})`}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDescriptionDialogOpen(true)}
              className="text-xs"
              disabled={disabled}
            >
              <FileText className="w-3 h-3 mr-1" />
              Description {uploadedFile.metadata.description && '✓'}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPriceDialogOpen(true)}
              className="text-xs"
              disabled={disabled}
            >
              <DollarSign className="w-3 h-3 mr-1" />
              Price {uploadedFile.metadata.suggestedPrice && uploadedFile.metadata.suggestedPrice > 0 && `($${uploadedFile.metadata.suggestedPrice.toFixed(2)})`}
            </Button>
          </div>

          {/* Show current metadata values */}
          <div className="space-y-1 text-xs text-muted-foreground">
            {uploadedFile.metadata.mentions.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <span className="font-medium">Mentions:</span>
                {uploadedFile.metadata.mentions.map(mention => (
                  <Badge key={mention} variant="secondary" className="text-xs">{mention}</Badge>
                ))}
              </div>
            )}
            {uploadedFile.metadata.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <span className="font-medium">Tags:</span>
                {uploadedFile.metadata.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
            )}
            {uploadedFile.metadata.description && (
              <div>
                <span className="font-medium">Description:</span> {uploadedFile.metadata.description.length > 60 ? `${uploadedFile.metadata.description.substring(0, 60)}...` : uploadedFile.metadata.description}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* All the metadata editing dialogs */}
      <MentionsDialog
        open={mentionsDialogOpen}
        onOpenChange={setMentionsDialogOpen}
        mentions={uploadedFile.metadata.mentions}
        onMentionsChange={(mentions) => handleMetadataUpdate('mentions', mentions)}
      />
      
      <TagsDialog
        open={tagsDialogOpen}
        onOpenChange={setTagsDialogOpen}
        tags={uploadedFile.metadata.tags}
        onTagsChange={(tags) => handleMetadataUpdate('tags', tags)}
      />
      
      <FolderSelectDialog
        open={foldersDialogOpen}
        onOpenChange={setFoldersDialogOpen}
        selectedFolders={uploadedFile.metadata.folders}
        onFoldersChange={(folders) => handleMetadataUpdate('folders', folders)}
      />
      
      <DescriptionDialog
        open={descriptionDialogOpen}
        onOpenChange={setDescriptionDialogOpen}
        description={uploadedFile.metadata.description}
        onDescriptionChange={(description) => handleMetadataUpdate('description', description)}
      />
      
      <PriceDialog
        open={priceDialogOpen}
        onOpenChange={setPriceDialogOpen}
        price={uploadedFile.metadata.suggestedPrice}
        onPriceChange={(price) => handleMetadataUpdate('suggestedPrice', price)}
      />

      {/* Preview dialog for completed files */}
      {mockMediaItem && (
        <SimpleMediaPreviewAsync
          item={mockMediaItem}
          isOpen={previewDialogOpen}
          onClose={() => setPreviewDialogOpen(false)}
          getFullUrlAsync={mockGetFullUrlAsync}
          updateMediaMetadata={async () => {}} // Mock function for upload component
          addToFolders={async () => {}} // Mock function for upload component
        />
      )}
    </>
  );
}