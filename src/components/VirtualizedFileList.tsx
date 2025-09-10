import React, { memo, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { UploadedFileWithMetadata } from '@/components/FileUploadRowWithMetadata';
import { OptimizedFileReviewRow } from './OptimizedFileReviewRow';
import { ScrollArea } from '@/components/ui/scroll-area';

interface VirtualizedFileListProps {
  files: UploadedFileWithMetadata[];
  onRemove: (id: string) => void;
  onMetadataChange?: (id: string, metadata: Partial<UploadedFileWithMetadata['metadata']>) => void;
  onSelectionChange?: (id: string, selected: boolean) => void;
  formatFileSize: (bytes: number) => string;
  height?: number;
}

const ITEM_HEIGHT = 150; // Increased height to prevent content overlap

interface ListItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    files: UploadedFileWithMetadata[];
    onRemove: (id: string) => void;
    onMetadataChange?: (id: string, metadata: Partial<UploadedFileWithMetadata['metadata']>) => void;
    onSelectionChange?: (id: string, selected: boolean) => void;
    formatFileSize: (bytes: number) => string;
  };
}

const ListItem = memo(({ index, style, data }: ListItemProps) => {
  const { files, onRemove, onMetadataChange, onSelectionChange, formatFileSize } = data;
  const file = files[index];
  
  if (!file) return null;

  return (
    <div style={style} className="px-1 py-1">
      <OptimizedFileReviewRow
        file={file}
        files={files}
        currentIndex={index}
        onRemove={onRemove}
        onMetadataChange={onMetadataChange}
        onSelectionChange={onSelectionChange}
        formatFileSize={formatFileSize}
      />
    </div>
  );
});

ListItem.displayName = 'ListItem';

export const VirtualizedFileList = memo(({ 
  files, 
  onRemove, 
  onMetadataChange, 
  onSelectionChange, 
  formatFileSize,
  height = 400 
}: VirtualizedFileListProps) => {
  // Memoize the data object to prevent List re-renders
  const itemData = useMemo(() => ({
    files,
    onRemove,
    onMetadataChange,
    onSelectionChange,
    formatFileSize
  }), [files, onRemove, onMetadataChange, onSelectionChange, formatFileSize]);

  // Use the height passed from parent - no dynamic calculation
  const containerHeight = Math.min(height, files.length * ITEM_HEIGHT + 20);
  const shouldVirtualize = files.length > 10; // Only virtualize for larger lists

  if (!shouldVirtualize) {
    // For small lists, render directly without virtualization
    return (
      <div 
        className="w-full bg-card rounded-lg border border-border overflow-hidden"
        style={{ height: containerHeight }}
      >
        <ScrollArea className="h-full">
          <div className="space-y-2 bg-card">
            {files.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No files to display
              </div>
            ) : (
              files.map((file, index) => (
                <OptimizedFileReviewRow
                  key={file.id}
                  file={file}
                  files={files}
                  currentIndex={index}
                  onRemove={onRemove}
                  onMetadataChange={onMetadataChange}
                  onSelectionChange={onSelectionChange}
                  formatFileSize={formatFileSize}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div 
      className="w-full bg-background border border-border rounded-lg overflow-hidden"
      style={{ height: containerHeight }}
    >
      <List
        height={containerHeight}
        itemCount={files.length}
        itemSize={ITEM_HEIGHT}
        itemData={itemData}
        overscanCount={5} // Render 5 extra items for smoother scrolling
        style={{
          backgroundColor: 'hsl(var(--card))',
          color: 'hsl(var(--card-foreground))',
          width: '100%'
        }}
      >
        {ListItem}
      </List>
    </div>
  );
});

VirtualizedFileList.displayName = 'VirtualizedFileList';