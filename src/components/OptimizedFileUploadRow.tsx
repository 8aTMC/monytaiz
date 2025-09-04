import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, Folder, Hash, StickyNote, DollarSign, User, Clock, Trash2, RefreshCw, ArrowRight } from 'lucide-react';
import { FileUploadThumbnail } from './FileUploadThumbnail';
import { CreatorTagDialog } from './CreatorTagDialog';
import { FolderSelectDialog } from './FolderSelectDialog';
import { TagsDialog } from './TagsDialog';
import { NotesDialog } from './NotesDialog';
import { PriceDialog } from './PriceDialog';
import { FilePreviewDialog } from './FilePreviewDialog';
import { cn } from '@/lib/utils';
import type { OptimizedUploadItem } from '@/hooks/useOptimizedUpload';

interface OptimizedFileUploadRowProps {
  item: OptimizedUploadItem;
  index: number;
  currentUploadIndex: number;
  isUploading: boolean;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  getStatusIcon: (status: string) => React.ReactNode;
  formatFileSize: (bytes: number) => string;
  files?: OptimizedUploadItem[];
  currentIndex?: number;
  onPrevious?: () => void;
  onNext?: () => void;
}

export const OptimizedFileUploadRow = ({
  item,
  index,
  currentUploadIndex,
  isUploading,
  onRemove,
  onRetry,
  getStatusIcon,
  formatFileSize,
  files,
  currentIndex,
  onPrevious,
  onNext,
}: OptimizedFileUploadRowProps) => {
  const [showCreatorDialog, setShowCreatorDialog] = useState(false);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [showTagsDialog, setShowTagsDialog] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  
  const [creators, setCreators] = useState<Array<{id: string, name: string, url: string}>>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [suggestedPrice, setSuggestedPrice] = useState<number | null>(null);

  const { user } = useAuth();

  const handleDoubleClick = () => {
    setShowPreviewDialog(true);
  };

  const uploaderInfo = {
    name: user?.user_metadata?.display_name || user?.email || 'Anonymous User',
    timestamp: new Date().toLocaleString()
  };

  const getProcessedSize = () => {
    if (!item.processed) return null;
    
    // Calculate estimated processed size based on compression ratios
    const originalSize = item.originalFile.size;
    let processedSize = originalSize;
    
    if (item.processed.metadata.format === 'webp') {
      // WebP typically 25-50% smaller than original
      processedSize = Math.round(originalSize * 0.6);
    } else if (item.processed.metadata.format === 'mp4') {
      // H.264 compression varies but typically 40-70% of original
      processedSize = Math.round(originalSize * 0.55);
    }
    
    return processedSize;
  };

  const getSizeComparison = () => {
    const processedSize = getProcessedSize();
    if (!processedSize) return null;
    
    const originalSize = item.originalFile.size;
    const savings = Math.round(((originalSize - processedSize) / originalSize) * 100);
    
    return { processedSize, savings };
  };

  const sizeComparison = getSizeComparison();

  return (
    <>
      <div 
        className={cn(
          "flex flex-col gap-3 p-4 rounded-lg border transition-all hover:bg-muted/20 cursor-pointer",
          index === currentUploadIndex && isUploading && "bg-blue-50 border-blue-200"
        )}
        onDoubleClick={handleDoubleClick}
      >
        {/* Top Row: Thumbnail, File Info, Status */}
        <div className="flex items-start gap-3">
          {/* Thumbnail */}
          <FileUploadThumbnail file={item.originalFile} className="w-16 h-16 flex-shrink-0" />
          
          {/* File Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium truncate pr-2">
                {item.originalFile.name}
              </p>
              <div className="flex items-center gap-2">
                {getStatusIcon(item.status)}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item.id);
                  }}
                  disabled={item.status === 'uploading_original' || item.status === 'uploading_processed'}
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  title="Remove file"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Size Information with Comparison */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <span>{formatFileSize(item.originalFile.size)}</span>
              {sizeComparison && (
                <>
                  <ArrowRight className="w-3 h-3" />
                  <span className="text-green-600 font-medium">
                    {formatFileSize(sizeComparison.processedSize)}
                  </span>
                  <Badge variant="secondary" className="text-xs text-green-600">
                    -{sizeComparison.savings}%
                  </Badge>
                </>
              )}
              <span className="capitalize">{item.status.replace('_', ' ')}</span>
            </div>

            {/* Status Badges */}
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                {item.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Badge>
              {item.processed && (
                <Badge variant="secondary" className="text-xs">
                  Processed ({item.processed.metadata.format})
                </Badge>
              )}
              {item.retryable && (
                <Badge variant="outline" className="text-xs text-yellow-600">
                  Needs optimization
                </Badge>
              )}
            </div>

            {/* Progress Bar */}
            {item.progress > 0 && item.status !== 'complete' && (
              <div className="mb-2">
                <Progress value={item.progress} className="h-1" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{item.progress}% complete</span>
                  {index === currentUploadIndex && isUploading && (
                    <span className="text-blue-600">Processing...</span>
                  )}
                </div>
              </div>
            )}

            {/* Error Message */}
            {item.error && (
              <p className="text-xs text-destructive mb-2">{item.error}</p>
            )}
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap gap-2">
          {item.status === 'needs_retry' && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRetry(item.id);
              }}
              className="h-8"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Optimize Now
            </Button>
          )}

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
            {selectedFolders.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 text-xs">
                {selectedFolders.length}
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
        selectedFolders={selectedFolders}
        onFoldersChange={setSelectedFolders}
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
        file={item.originalFile}
        files={files?.map(f => f.originalFile)}
        currentIndex={currentIndex}
      />
    </>
  );
};