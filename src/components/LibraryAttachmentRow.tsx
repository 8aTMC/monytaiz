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
  className?: string;
}

export const LibraryAttachmentRow = ({ files, onRemoveFile, className }: LibraryAttachmentRowProps) => {

  if (files.length === 0) return null;

  return (
    <div className={cn("relative z-10 mb-3", className)}>
      <div className="bg-background/80 backdrop-blur-sm rounded-lg border border-border p-3 shadow-sm">
        <div className="text-xs text-muted-foreground mb-2 font-medium">
          {files.length} file{files.length !== 1 ? 's' : ''} attached
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30 py-1">
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
    </div>
  );
};