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

const ITEM_HEIGHT = 180; // Approximate height of each file row

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
    <div style={style} className="px-2 py-1">
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
  height = 600 
}: VirtualizedFileListProps) => {
  // Memoize the data object to prevent List re-renders
  const itemData = useMemo(() => ({
    files,
    onRemove,
    onMetadataChange,
    onSelectionChange,
    formatFileSize
  }), [files, onRemove, onMetadataChange, onSelectionChange, formatFileSize]);

  // Calculate optimal height based on content
  const calculatedHeight = Math.min(height, files.length * ITEM_HEIGHT);
  const shouldVirtualize = files.length > 10; // Only virtualize for larger lists

  if (!shouldVirtualize) {
  // For small lists, render directly without virtualization
  return (
    <ScrollArea className="h-full min-h-[200px] max-h-[600px]">
      <div className="space-y-2 p-2">
        {files.map((file, index) => (
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
        ))}
      </div>
    </ScrollArea>
  );
  }

  return (
    <div className="w-full bg-background border border-border rounded-lg">
      <List
        height={calculatedHeight}
        itemCount={files.length}
        itemSize={ITEM_HEIGHT}
        itemData={itemData}
        overscanCount={5} // Render 5 extra items for smoother scrolling
        className="scrollbar-thin p-2"
        style={{
          backgroundColor: 'hsl(var(--background))',
          color: 'hsl(var(--foreground))'
        }}
      >
        {ListItem}
      </List>
    </div>
  );
});

VirtualizedFileList.displayName = 'VirtualizedFileList';