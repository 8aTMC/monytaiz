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
    <div className={cn("relative h-12", className)}>
      <div className="flex gap-2 overflow-x-auto h-12 py-1 px-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30">
        {files.map((file, index) => (
          <MiniLibraryThumbnail
            key={file.id}
            file={file}
            fileIndex={index}
            onRemove={onRemoveFile}
          />
        ))}
      </div>
    </div>
  );
};