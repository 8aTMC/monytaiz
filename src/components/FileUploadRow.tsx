import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Folder, Hash, StickyNote, DollarSign, User, Clock } from 'lucide-react';
import { FileUploadThumbnail } from './FileUploadThumbnail';
import { CreatorTagDialog } from './CreatorTagDialog';
import { FolderSelectDialog } from './FolderSelectDialog';
import { TagsDialog } from './TagsDialog';
import { NotesDialog } from './NotesDialog';
import { PriceDialog } from './PriceDialog';
import { FilePreviewDialog } from './FilePreviewDialog';
import { cn } from '@/lib/utils';
import type { FileUploadItem } from '@/hooks/useFileUpload';

interface FileUploadRowProps {
  item: FileUploadItem;
  index: number;
  currentUploadIndex: number;
  isUploading: boolean;
  onRemove: (id: string) => void;
  getStatusIcon: (status: string) => React.ReactNode;
  formatFileSize: (bytes: number) => string;
}

export const FileUploadRow = ({
  item,
  index,
  currentUploadIndex,
  isUploading,
  onRemove,
  getStatusIcon,
  formatFileSize,
}: FileUploadRowProps) => {
  const [showCreatorDialog, setShowCreatorDialog] = useState(false);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [showTagsDialog, setShowTagsDialog] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  
  const [creators, setCreators] = useState<Array<{id: string, name: string, url: string}>>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('all-files');
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [suggestedPrice, setSuggestedPrice] = useState<number | null>(null);

  const handleDoubleClick = () => {
    setShowPreviewDialog(true);
  };

  const uploaderInfo = {
    name: 'Current User', // This would come from auth context
    timestamp: new Date().toLocaleString()
  };

  return (
    <>
      <div 
        key={item.id}
        className={cn(
          "flex items-start gap-3 p-4 rounded-lg border transition-all hover:bg-muted/20 cursor-pointer",
          index === currentUploadIndex && isUploading && "bg-blue-50 border-blue-200"
        )}
        onDoubleClick={handleDoubleClick}
      >
        {/* Thumbnail */}
        <FileUploadThumbnail file={item.file} className="w-16 h-16 flex-shrink-0" />
        
        {/* File Info and Controls */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* File Name and Status */}
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate pr-2">
                {item.file.name}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <span>{formatFileSize(item.file.size)}</span>
                <span className="capitalize">{item.status}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(item.status)}
              {item.status === 'pending' && !isUploading && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item.id);
                  }}
                  className="h-6 w-6 p-0"
                >
                  ×
                </Button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowCreatorDialog(true);
              }}
              className="h-8"
            >
              <Users className="w-3 h-3 mr-1" />
              Tag Creator
              {creators.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 text-xs">
                  {creators.length}
                </Badge>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowFolderDialog(true);
              }}
              className="h-8"
            >
              <Folder className="w-3 h-3 mr-1" />
              Folder
              {selectedFolder !== 'all-files' && (
                <Badge variant="secondary" className="ml-1 h-4 text-xs">
                  1
                </Badge>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowTagsDialog(true);
              }}
              className="h-8"
            >
              <Hash className="w-3 h-3 mr-1" />
              Tags
              {tags.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 text-xs">
                  {tags.length}
                </Badge>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowNotesDialog(true);
              }}
              className="h-8"
            >
              <StickyNote className="w-3 h-3 mr-1" />
              Notes
              {notes && (
                <Badge variant="secondary" className="ml-1 h-4 text-xs">
                  •
                </Badge>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowPriceDialog(true);
              }}
              className="h-8"
            >
              <DollarSign className="w-3 h-3 mr-1" />
              Price
              {suggestedPrice && (
                <Badge variant="secondary" className="ml-1 h-4 text-xs">
                  ${suggestedPrice}
                </Badge>
              )}
            </Button>
          </div>

          {/* Uploader Info */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="w-3 h-3" />
            <span>Uploaded by {uploaderInfo.name}</span>
            <Clock className="w-3 h-3 ml-2" />
            <span>{uploaderInfo.timestamp}</span>
          </div>

          {/* Progress Bar */}
          {(item.status === 'uploading' || item.status === 'completed') && (
            <div className="mt-2">
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            </div>
          )}
          
          {/* Error Message */}
          {item.error && (
            <p className="text-xs text-destructive mt-1">{item.error}</p>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <CreatorTagDialog
        open={showCreatorDialog}
        onOpenChange={setShowCreatorDialog}
        creators={creators}
        onCreatorsChange={setCreators}
      />
      
      <FolderSelectDialog
        open={showFolderDialog}
        onOpenChange={setShowFolderDialog}
        selectedFolder={selectedFolder}
        onFolderChange={setSelectedFolder}
      />
      
      <TagsDialog
        open={showTagsDialog}
        onOpenChange={setShowTagsDialog}
        tags={tags}
        onTagsChange={setTags}
      />
      
      <NotesDialog
        open={showNotesDialog}
        onOpenChange={setShowNotesDialog}
        notes={notes}
        onNotesChange={setNotes}
      />
      
      <PriceDialog
        open={showPriceDialog}
        onOpenChange={setShowPriceDialog}
        price={suggestedPrice}
        onPriceChange={setSuggestedPrice}
      />
      
      <FilePreviewDialog
        open={showPreviewDialog}
        onOpenChange={setShowPreviewDialog}
        file={item.file}
      />
    </>
  );
};