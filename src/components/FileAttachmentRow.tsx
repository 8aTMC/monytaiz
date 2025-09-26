import { MiniFileThumbnail } from '@/components/MiniFileThumbnail';
import { cn } from '@/lib/utils';

interface FileAttachmentRowProps {
  files: File[];
  onRemoveFile: (index: number) => void;
  className?: string;
}

export const FileAttachmentRow = ({ files, onRemoveFile, className }: FileAttachmentRowProps) => {

  if (files.length === 0) return null;

  return (
    <div className={cn("relative mb-4 max-w-full", className)}>
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-thumbnail pt-3 pb-2">
        {files.map((file, index) => (
          <div key={`${file.name}-${index}`} className="flex-shrink-0">
            <MiniFileThumbnail
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