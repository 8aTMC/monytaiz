import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Image, Video, Music, FileIcon, ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';

interface FileInfo {
  file: File;
  id?: string;
}

interface FileComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingFile: FileInfo;
  newFile: FileInfo;
}

export const FileComparisonDialog = ({ 
  open, 
  onOpenChange, 
  existingFile, 
  newFile 
}: FileComparisonDialogProps) => {
  
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (file: File) => {
    return new Date(file.lastModified).toLocaleString();
  };

  const getFileIcon = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(extension)) {
      return <Image className="w-16 h-16 text-blue-500" />;
    }
    if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(extension)) {
      return <Video className="w-16 h-16 text-purple-500" />;
    }
    if (['mp3', 'wav', 'aac', 'ogg', 'flac', 'opus'].includes(extension)) {
      return <Music className="w-16 h-16 text-green-500" />;
    }
    if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(extension)) {
      return <FileText className="w-16 h-16 text-orange-500" />;
    }
    return <FileIcon className="w-16 h-16 text-muted-foreground" />;
  };

  const FilePreview = ({ file, title }: { file: File; title: string }) => {
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
    const [videoThumbnailUrl, setVideoThumbnailUrl] = useState<string | null>(null);
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(extension);
    const isVideo = ['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(extension);
    
    useEffect(() => {
      if (isImage) {
        const url = URL.createObjectURL(file);
        setThumbnailUrl(url);
        
        return () => {
          URL.revokeObjectURL(url);
        };
      } else if (isVideo) {
        // Generate video thumbnail
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        video.preload = 'metadata';
        video.currentTime = 1; // Seek to 1 second
        
        video.onloadedmetadata = () => {
          canvas.width = 300;
          canvas.height = 200;
          
          video.onseeked = () => {
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              canvas.toBlob((blob) => {
                if (blob) {
                  const url = URL.createObjectURL(blob);
                  setVideoThumbnailUrl(url);
                }
              }, 'image/jpeg', 0.8);
            }
          };
        };
        
        video.src = URL.createObjectURL(file);
        
        return () => {
          URL.revokeObjectURL(video.src);
          if (videoThumbnailUrl) {
            URL.revokeObjectURL(videoThumbnailUrl);
          }
        };
      }
    }, [file, isImage, isVideo, videoThumbnailUrl]);
    
    return (
      <div className="flex-1 p-6 border border-border rounded-lg bg-card">
        <h3 className="text-lg font-semibold mb-4 text-card-foreground">{title}</h3>
        
        {/* Preview Area */}
        <div className="mb-4 flex justify-center">
          <div className="w-[300px] h-[200px] rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden">
            {isImage && thumbnailUrl ? (
              <img 
                src={thumbnailUrl} 
                alt={file.name}
                className="max-w-full max-h-full object-contain"
                onError={() => setThumbnailUrl(null)}
              />
            ) : isVideo && videoThumbnailUrl ? (
              <div className="relative">
                <img 
                  src={videoThumbnailUrl} 
                  alt={file.name}
                  className="max-w-full max-h-full object-contain"
                  onError={() => setVideoThumbnailUrl(null)}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                    <Video className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            ) : (
              getFileIcon(file)
            )}
          </div>
        </div>
        
        {/* File Details */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-muted-foreground">File Name</label>
            <p className="text-sm font-mono break-all bg-muted p-2 rounded mt-1">{file.name}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Size</label>
              <Badge variant="secondary" className="mt-1">
                {formatFileSize(file.size)}
              </Badge>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Type</label>
              <Badge variant="outline" className="mt-1">
                {file.type || 'Unknown'}
              </Badge>
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-muted-foreground">Last Modified</label>
            <p className="text-sm text-muted-foreground mt-1">{formatDate(file)}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileIcon className="w-5 h-5 text-orange-500" />
            File Comparison - Duplicate Detected
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          <FilePreview file={existingFile.file} title="File in Queue" />
          <FilePreview file={newFile.file} title="File Being Uploaded" />
        </div>
        
        <div className="mt-6 p-4 bg-muted/30 rounded-lg">
          <p className="text-sm text-muted-foreground text-center">
            These files have the same name and size. Choose to ignore the new file or proceed with the upload to add both files to your library.
          </p>
        </div>

        <DialogFooter className="mt-6">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};