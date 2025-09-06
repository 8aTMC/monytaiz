import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Image, Video, Music, FileIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DuplicateFile {
  name: string;
  size: number;
  type: string;
}

interface DuplicateFilesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateFiles: DuplicateFile[];
  onConfirm: () => void;
}

export const DuplicateFilesDialog = ({ 
  open, 
  onOpenChange, 
  duplicateFiles, 
  onConfirm 
}: DuplicateFilesDialogProps) => {
  const getFileIcon = (file: DuplicateFile) => {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(extension)) {
      return <Image className="w-8 h-8 text-blue-500" />;
    }
    if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(extension)) {
      return <Video className="w-8 h-8 text-purple-500" />;
    }
    if (['mp3', 'wav', 'aac', 'ogg', 'flac', 'opus'].includes(extension)) {
      return <Music className="w-8 h-8 text-green-500" />;
    }
    if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(extension)) {
      return <FileText className="w-8 h-8 text-orange-500" />;
    }
    return <FileIcon className="w-8 h-8 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileIcon className="w-5 h-5 text-orange-500" />
            Duplicate Files Excluded
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The following {duplicateFiles.length} file{duplicateFiles.length > 1 ? 's' : ''} were excluded because they already exist in your upload queue:
          </p>
          
          <ScrollArea className="max-h-[300px] pr-4">
            <div className="space-y-3">
              {duplicateFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                  <div className="flex-shrink-0">
                    {getFileIcon(file)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {formatFileSize(file.size)}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {file.type}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button onClick={onConfirm} className="w-full">
            OK, Got It
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};