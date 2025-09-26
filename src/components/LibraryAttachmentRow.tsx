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
    <div className={cn("relative mb-4 max-w-full", className)}>
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-thumbnail pt-10 pb-2">
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