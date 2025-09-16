import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Image, Video, Music, FileIcon, ArrowLeft, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { usePersistentMediaCache } from '@/hooks/usePersistentMediaCache';

interface FileInfo {
  file: File;
  id?: string;
}

interface DatabaseFileInfo {
  id: string;
  original_filename: string;
  title?: string;
  original_size_bytes: number;
  optimized_size_bytes?: number;
  mime_type: string;
  created_at: string;
  processing_status: string;
  thumbnail_path?: string;
  processed_path?: string;
}

interface FileComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingFile: FileInfo | DatabaseFileInfo;
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

  const formatDatabaseDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getFileIcon = (filename: string, mimeType?: string) => {
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    const type = mimeType || '';
    
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(extension) || type.startsWith('image/')) {
      return <Image className="w-16 h-16 text-blue-500" />;
    }
    if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(extension) || type.startsWith('video/')) {
      return <Video className="w-16 h-16 text-purple-500" />;
    }
    if (['mp3', 'wav', 'aac', 'ogg', 'flac', 'opus'].includes(extension) || type.startsWith('audio/')) {
      return <Music className="w-16 h-16 text-green-500" />;
    }
    if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(extension) || type.includes('text') || type.includes('document')) {
      return <FileText className="w-16 h-16 text-orange-500" />;
    }
    return <FileIcon className="w-16 h-16 text-muted-foreground" />;
  };

  const DatabaseFilePreview = ({ dbFile, title }: { dbFile: DatabaseFileInfo; title: string }) => {
    const [secureImageUrl, setSecureImageUrl] = useState<string | null>(null);
    const [imageLoading, setImageLoading] = useState(false);
    const [imageError, setImageError] = useState(false);
    const { getSecureMediaUrl } = usePersistentMediaCache();
    
    const extension = dbFile.original_filename.split('.').pop()?.toLowerCase() || '';
    const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(extension) || dbFile.mime_type.startsWith('image/');
    
    // Load secure image URL with fallback logic
    useEffect(() => {
      if (!isImage) return;
      
      const loadSecureUrl = async () => {
        setImageLoading(true);
        setImageError(false);
        
        try {
          // Try thumbnail_path first
          if (dbFile.thumbnail_path) {
            const thumbnailUrl = await getSecureMediaUrl(dbFile.thumbnail_path, { width: 512, height: 512, quality: 85 });
            if (thumbnailUrl) {
              setSecureImageUrl(thumbnailUrl);
              setImageLoading(false);
              return;
            }
          }
          
          // Fall back to processed_path
          if (dbFile.processed_path) {
            const processedUrl = await getSecureMediaUrl(dbFile.processed_path, { width: 512, height: 512, quality: 85 });
            if (processedUrl) {
              setSecureImageUrl(processedUrl);
              setImageLoading(false);
              return;
            }
          }
          
          // No valid URL found
          setImageError(true);
        } catch (error) {
          console.error('Failed to load secure image URL:', error);
          setImageError(true);
        } finally {
          setImageLoading(false);
        }
      };
      
      loadSecureUrl();
    }, [dbFile.thumbnail_path, dbFile.processed_path, isImage, getSecureMediaUrl]);
    
    return (
      <div className="flex-1 p-6 border border-border rounded-lg bg-card">
        <h3 className="text-lg font-semibold mb-4 text-card-foreground">{title}</h3>
        
        {/* Preview Area */}
        <div className="mb-4 flex justify-center">
          <div className="w-[300px] h-[200px] rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden">
            {isImage && imageLoading ? (
              <div className="flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : isImage && secureImageUrl && !imageError ? (
              <img 
                src={secureImageUrl} 
                alt={dbFile.original_filename}
                className="max-w-full max-h-full object-contain"
                onError={() => setImageError(true)}
                onLoad={() => setImageError(false)}
              />
            ) : (
              <div className="flex items-center justify-center">
                {getFileIcon(dbFile.original_filename, dbFile.mime_type)}
              </div>
            )}
          </div>
        </div>
        
        {/* File Details */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-muted-foreground">File Name</label>
            <p className="text-sm font-mono break-all bg-muted p-2 rounded mt-1">{dbFile.title || dbFile.original_filename}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Size</label>
              <div className="flex flex-col gap-1 mt-1">
                {dbFile.optimized_size_bytes ? (
                  <>
                    <Badge variant="secondary">
                      {formatFileSize(dbFile.optimized_size_bytes)} (WebP)
                    </Badge>
                    {dbFile.optimized_size_bytes !== dbFile.original_size_bytes && (
                      <Badge variant="outline" className="text-xs">
                        Original: {formatFileSize(dbFile.original_size_bytes)}
                      </Badge>
                    )}
                  </>
                ) : (
                  <Badge variant="secondary">
                    {formatFileSize(dbFile.original_size_bytes)}
                  </Badge>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Type</label>
              <Badge variant="outline" className="mt-1">
                {dbFile.mime_type || 'Unknown'}
              </Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Created</label>
              <p className="text-sm text-muted-foreground mt-1">{formatDatabaseDate(dbFile.created_at)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <Badge variant="outline" className="mt-1">
                {dbFile.processing_status}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const FilePreview = ({ file, title }: { file: File; title: string }) => {
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
    const [videoThumbnailUrl, setVideoThumbnailUrl] = useState<string | null>(null);
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(extension);
    const isVideo = ['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(extension);
    
    useEffect(() => {
      if (isImage) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            setThumbnailUrl(e.target.result as string);
          }
        };
        reader.onerror = () => {
          setThumbnailUrl(null);
        };
        reader.readAsDataURL(file);
      } else if (isVideo) {
        // Generate video thumbnail
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        video.preload = 'metadata';
        video.currentTime = 1; // Seek to 1 second
        
        const timeout = setTimeout(() => {
          setVideoThumbnailUrl(null);
        }, 10000); // 10 second timeout
        
        video.onloadedmetadata = () => {
          video.onseeked = () => {
            if (ctx && video.videoWidth && video.videoHeight) {
              // Calculate thumbnail dimensions based on video aspect ratio
              const videoAspect = video.videoWidth / video.videoHeight;
              let thumbWidth, thumbHeight;
              
              if (videoAspect > 1) {
                // Horizontal video
                thumbWidth = 300;
                thumbHeight = 200;
              } else if (videoAspect < 1) {
                // Vertical video
                thumbWidth = 200;
                thumbHeight = 300;
              } else {
                // Square video
                thumbWidth = 250;
                thumbHeight = 250;
              }
              
              canvas.width = thumbWidth;
              canvas.height = thumbHeight;
              
              ctx.drawImage(video, 0, 0, thumbWidth, thumbHeight);
              try {
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                setVideoThumbnailUrl(dataUrl);
              } catch (e) {
                console.warn('Failed to create video thumbnail data URL', e);
                setVideoThumbnailUrl(null);
              }
            }
            clearTimeout(timeout);
          };
        };
        
        video.onerror = () => {
          clearTimeout(timeout);
          setVideoThumbnailUrl(null);
        };
        
        const videoUrl = URL.createObjectURL(file);
        video.src = videoUrl;
        
        return () => {
          clearTimeout(timeout);
          video.src = '';
          try { 
            URL.revokeObjectURL(videoUrl); 
          } catch (e) {
            // Ignore revocation errors
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
              getFileIcon(file.name, file.type)
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
          {'file' in existingFile ? (
            <FilePreview file={existingFile.file} title="File in Queue" />
          ) : (
            <DatabaseFilePreview dbFile={existingFile} title="Existing File in Library" />
          )}
          <FilePreview file={newFile.file} title="File Being Uploaded" />
        </div>
        
        <div className="mt-2 p-4 bg-muted/30 rounded-lg">
          <p className="text-sm text-muted-foreground text-center">
            These files have the same name and size. Choose to ignore the new file or proceed with the upload to add both files to your library.
          </p>
        </div>

        <DialogFooter className="mt-2">
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