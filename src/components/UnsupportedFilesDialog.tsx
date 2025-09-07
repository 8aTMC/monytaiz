import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Image, Video, Music, FileIcon, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';

interface UnsupportedFile {
  id: string;
  name: string;
  size: number;
  type: 'image' | 'video' | 'audio' | 'unknown';
  file: File;
}

interface UnsupportedFilesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unsupportedFiles: UnsupportedFile[];
  onConfirm: (filesToIgnore: string[]) => void;
}

const getConversionUrl = (type: 'image' | 'video' | 'audio' | 'unknown'): string => {
  switch (type) {
    case 'image':
      return 'https://www.freeconvert.com/image-converter';
    case 'video':
      return 'https://www.freeconvert.com/video-converter';
    case 'audio':
      return 'https://www.freeconvert.com/audio-converter';
    default:
      return 'https://www.freeconvert.com/';
  }
};

export const UnsupportedFilesDialog = ({ 
  open, 
  onOpenChange, 
  unsupportedFiles, 
  onConfirm 
}: UnsupportedFilesDialogProps) => {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isConfirmedClose, setIsConfirmedClose] = useState(false);
  
  // Initialize with all files selected by default and reset when unsupportedFiles changes
  useEffect(() => {
    if (unsupportedFiles.length > 0) {
      setSelectedFiles(new Set(unsupportedFiles.map(f => f.id)));
    }
  }, [unsupportedFiles]);
  
  const handleSelectAll = () => {
    if (selectedFiles.size === unsupportedFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(unsupportedFiles.map(f => f.id)));
    }
  };
  
  const handleFileToggle = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };
  
  const handleConfirm = () => {
    setIsConfirmedClose(true);
    onConfirm(Array.from(selectedFiles));
    setSelectedFiles(new Set());
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isConfirmedClose) {
      // Auto-ignore selected files when dialog closes without confirmation
      onConfirm(Array.from(selectedFiles));
      setSelectedFiles(new Set());
    }
    setIsConfirmedClose(false);
    onOpenChange(newOpen);
  };

  const handleConvertClick = (file: UnsupportedFile, event: React.MouseEvent) => {
    event.stopPropagation();
    const url = getConversionUrl(file.type);
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  
  const getFileIcon = (file: UnsupportedFile) => {
    switch (file.type) {
      case 'image':
        return <Image className="w-8 h-8 text-blue-500" />;
      case 'video':
        return <Video className="w-8 h-8 text-purple-500" />;
      case 'audio':
        return <Music className="w-8 h-8 text-green-500" />;
      default:
        return <FileIcon className="w-8 h-8 text-muted-foreground" />;
    }
  };

  const FileThumbnail = ({ file }: { file: UnsupportedFile }) => {
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
    const isImage = file.type === 'image';
    
    useEffect(() => {
      if (isImage && file.file) {
        const url = URL.createObjectURL(file.file);
        setThumbnailUrl(url);
        
        return () => {
          URL.revokeObjectURL(url);
        };
      }
    }, [file.file, isImage]);
    
    if (isImage && thumbnailUrl) {
      return (
        <div className="w-8 h-8 rounded overflow-hidden bg-muted flex-shrink-0">
          <img 
            src={thumbnailUrl} 
            alt={file.name}
            className="w-full h-full object-cover"
            onError={() => setThumbnailUrl(null)}
          />
        </div>
      );
    }
    
    return getFileIcon(file);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTypeLabel = (type: 'image' | 'video' | 'audio' | 'unknown') => {
    switch (type) {
      case 'image': return 'Image';
      case 'video': return 'Video';
      case 'audio': return 'Audio';
      default: return 'Unknown';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileIcon className="w-5 h-5 text-orange-500" />
            Unsupported File Types Detected
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between mt-2">
            <p className="text-sm text-muted-foreground">
              Found {unsupportedFiles.length} unsupported file{unsupportedFiles.length > 1 ? 's' : ''}. Selected files will be ignored, unselected files can be converted:
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSelectAll}
              className="text-xs"
            >
              {selectedFiles.size === unsupportedFiles.length ? 'Unselect All' : 'Select All'}
            </Button>
          </div>
          
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-2">
              {unsupportedFiles.map((file) => (
                <div 
                  key={file.id} 
                  className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-shrink-0">
                    <FileThumbnail file={file} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {formatFileSize(file.size)}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {getTypeLabel(file.type)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleConvertClick(file, e)}
                      className="text-xs gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Convert
                    </Button>
                  </div>
                  <div className="flex-shrink-0">
                    <Checkbox
                      checked={selectedFiles.has(file.id)}
                      onCheckedChange={() => handleFileToggle(file.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Supported file types:</strong>
              <br />• Images: JPG, JPEG, PNG, WebP, GIF, HEIC, HEIF
              <br />• Videos: MP4, MOV, WebM, MKV  
              <br />• Audio: MP3, WAV, AAC, OGG, Opus
              <br /><br />
              <em>If the conversion site cannot convert your file, please browse the internet for a specific converter for your file type.</em>
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => { setIsConfirmedClose(true); onOpenChange(false); }} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="flex-1">
            Ignore Selected Files ({selectedFiles.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};