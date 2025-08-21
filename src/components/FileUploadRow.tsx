import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Folder, Hash, StickyNote, DollarSign, User, Clock, Pause, Play, Trash2 } from 'lucide-react';
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
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onCancel?: (id: string) => void;
  getStatusIcon: (status: string) => React.ReactNode;
  formatFileSize: (bytes: number) => string;
}

export const FileUploadRow = ({
  item,
  index,
  currentUploadIndex,
  isUploading,
  onRemove,
  onPause,
  onResume,
  onCancel,
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

  const { user } = useAuth();

  const handleDoubleClick = () => {
    setShowPreviewDialog(true);
  };

  const formatUploadProgress = (uploadedBytes: number, totalBytes: number) => {
    const uploaded = formatFileSize(uploadedBytes);
    const total = formatFileSize(totalBytes);
    return `${uploaded} / ${total}`;
  };

  const uploaderInfo = {
    name: user?.user_metadata?.display_name || user?.email || 'Anonymous User',
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
              
              {/* Upload control buttons */}
              {(item.status === 'uploading' || item.status === 'paused') && (
                <>
                  {item.isPaused ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onResume?.(item.id);
                      }}
                      className="h-6 w-6 p-0"
                      title="Resume upload"
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPause?.(item.id);
                      }}
                      className="h-6 w-6 p-0"
                      title="Pause upload"
                    >
                      <Pause className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancel?.(item.id);
                    }}
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    title="Cancel upload"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
              
              {item.status === 'pending' && !isUploading && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item.id);
                  }}
                  className="h-6 w-6 p-0"
                  title="Remove from queue"
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
          {(item.status === 'uploading' || item.status === 'completed' || item.status === 'paused') && (
            <div className="mt-2">
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    item.status === 'paused' ? 'bg-orange-500' : 'bg-primary'
                  )}
                  style={{ width: `${item.progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>
                  {item.progress}% complete
                  {item.uploadedBytes && item.totalBytes && (
                    <span className="ml-2">({formatUploadProgress(item.uploadedBytes, item.totalBytes)})</span>
                  )}
                </span>
                {item.status === 'uploading' && index === currentUploadIndex && (
                  <span className="text-blue-600">Uploading...</span>
                )}
                {item.status === 'paused' && (
                  <span className="text-orange-600">Paused</span>
                )}
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