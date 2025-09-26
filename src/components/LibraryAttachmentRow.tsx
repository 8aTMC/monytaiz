import { MiniLibraryThumbnail } from '@/components/MiniLibraryThumbnail';
import { cn } from '@/lib/utils';

interface MediaItem {
  id: string;
  title: string;
  origin: 'upload' | 'story' | 'livestream' | 'message';
  storage_path: string;
  mime: string;
  type: 'image' | 'video' | 'audio' | 'gif';
  size_bytes: number;
  tags: string[];
  thumbnail_path?: string;
  tiny_placeholder?: string;
}

interface LibraryAttachmentRowProps {
  files: MediaItem[];
  onRemoveFile: (fileId: string) => void;
  onClearAll?: () => void;
  className?: string;
}

export const LibraryAttachmentRow = ({ files, onRemoveFile, onClearAll, className }: LibraryAttachmentRowProps) => {

  if (files.length === 0) return null;

  return (
    <div className={cn("relative mb-4 max-w-full", className)}>
      {onClearAll && (
        <button
          onClick={onClearAll}
          className="absolute top-14 left-3 z-10 bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs px-2 py-1 rounded-full transition-colors"
        >
          Clear
        </button>
      )}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-thumbnail pt-10 pb-2 pl-3">
        {files.map((file, index) => (
          <div key={file.id} className="flex-shrink-0">
            <MiniLibraryThumbnail
              file={file}
              fileIndex={index}
              onRemove={onRemoveFile}
            />
          </div>
        ))}
      </div>
    </div>
  );
};