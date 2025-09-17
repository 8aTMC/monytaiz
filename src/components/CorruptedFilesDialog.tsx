import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Video, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CorruptedFile {
  id: string;
  name: string;
  size: number;
  file: File;
  error: string;
  errorType?: 'corruption' | 'format' | 'timeout' | 'metadata';
}

interface CorruptedFilesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  corruptedFiles: CorruptedFile[];
  onRemoveFiles: (fileIds: string[]) => void;
  onRemoveAll: () => void;
}

export const CorruptedFilesDialog = ({ 
  open, 
  onOpenChange, 
  corruptedFiles, 
  onRemoveFiles,
  onRemoveAll
}: CorruptedFilesDialogProps) => {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getErrorTypeLabel = (errorType?: string) => {
    switch (errorType) {
      case 'corruption': return 'Corrupted';
      case 'format': return 'Format Error';
      case 'timeout': return 'Timeout';
      case 'metadata': return 'Metadata Error';
      default: return 'Error';
    }
  };

  const getErrorTypeColor = (errorType?: string) => {
    switch (errorType) {
      case 'corruption': return 'destructive';
      case 'format': return 'secondary';
      case 'timeout': return 'outline';
      case 'metadata': return 'outline';
      default: return 'destructive';
    }
  };

  const handleRemoveFile = (fileId: string) => {
    onRemoveFiles([fileId]);
  };

  const handleRemoveAllCorrupted = () => {
    onRemoveAll();
    onOpenChange(false);
  };

  const handleKeepFiles = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Corrupted Files Detected
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="mt-2">
            <p className="text-sm text-muted-foreground">
              Found {corruptedFiles.length} corrupted file{corruptedFiles.length > 1 ? 's' : ''} that cannot be uploaded. 
              These files appear to be damaged or have invalid data.
            </p>
          </div>
          
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-2">
              {corruptedFiles.map((file) => (
                <div 
                  key={file.id} 
                  className="flex items-start gap-3 p-3 rounded-lg border bg-destructive/10 border-destructive/20"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <Video className="w-8 h-8 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {formatFileSize(file.size)}
                      </Badge>
                      <Badge 
                        variant={getErrorTypeColor(file.errorType) as any} 
                        className="text-xs"
                      >
                        {getErrorTypeLabel(file.errorType)}
                      </Badge>
                    </div>
                    <p className="text-xs text-destructive mt-1">{file.error}</p>
                  </div>
                  <div className="flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveFile(file.id)}
                      className="text-xs gap-1 border-destructive/20 hover:bg-destructive/20"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Common causes of corrupted files:</strong>
              <br />• Incomplete downloads from the internet
              <br />• Hardware issues during file transfer
              <br />• Interrupted recording or encoding
              <br />• File system corruption
              <br /><br />
              <strong>Recommendations:</strong>
              <br />• Try re-downloading or re-exporting the file
              <br />• Use video repair tools if the file is important
              <br />• Check your device's storage health
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleKeepFiles}
            className="flex-1"
          >
            Keep in Queue
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleRemoveAllCorrupted}
            className="flex-1"
          >
            Remove All Corrupted Files
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};