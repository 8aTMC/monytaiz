import { useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Download, Lock, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MessageFile {
  id: string;
  type: string;
  name: string;
  url?: string;
  preview?: string;
  size: number;
  locked: boolean;
  price?: number;
}

interface MessageFilesPackProps {
  files: MessageFile[];
  onUnlock?: (files: MessageFile[]) => void;
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const MessageFilesPack = ({ files, onUnlock }: MessageFilesPackProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Group files by type
  const groupedFiles = files.reduce((acc, file) => {
    if (!acc[file.type]) acc[file.type] = [];
    acc[file.type].push(file);
    return acc;
  }, {} as Record<string, MessageFile[]>);

  // Create viewable groups (images and videos together, others separate)
  const mediaFiles = [
    ...(groupedFiles.images || []),
    ...(groupedFiles.videos || [])
  ];
  const audioFiles = groupedFiles.audio || [];
  const documentFiles = groupedFiles.documents || [];

  const allViewableGroups = [];
  
  // Add media pack if exists
  if (mediaFiles.length > 0) {
    allViewableGroups.push({
      type: 'media',
      files: mediaFiles,
      title: `${groupedFiles.images?.length || 0} Photo${(groupedFiles.images?.length || 0) !== 1 ? 's' : ''} ${
        groupedFiles.videos?.length ? `& ${groupedFiles.videos.length} Video${groupedFiles.videos.length !== 1 ? 's' : ''}` : ''
      }`.trim()
    });
  }

  const isLocked = files.some(f => f.locked);
  const totalPrice = files.reduce((sum, f) => sum + (f.price || 0), 0);

  // If locked, show unlock interface
  if (isLocked) {
    return (
      <Card className="w-80 bg-muted/50 border-dashed">
        <CardContent className="p-6 text-center">
          <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold mb-2">Locked Content</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {files.length} file{files.length !== 1 ? 's' : ''} • {formatFileSize(files.reduce((sum, f) => sum + f.size, 0))}
          </p>
          <div className="text-2xl font-bold mb-4">${totalPrice.toFixed(2)}</div>
          <Button 
            className="w-full mb-2"
            onClick={() => onUnlock?.(files)}
          >
            UNLOCK FOR ${totalPrice.toFixed(2)}
          </Button>
          <p className="text-xs text-muted-foreground">
            You have 1 hour to unlock this special content
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3 max-w-sm">
      {/* Media Pack (Images/Videos) */}
      {mediaFiles.length > 0 && (
        <Card className="overflow-hidden">
          <div className="relative">
            {/* Media Content */}
            <div className="aspect-square bg-muted flex items-center justify-center relative">
              {mediaFiles[currentIndex]?.type === 'images' ? (
                <img 
                  src={mediaFiles[currentIndex]?.url || mediaFiles[currentIndex]?.preview} 
                  alt={mediaFiles[currentIndex]?.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-black flex items-center justify-center">
                  <Button variant="ghost" size="icon" className="text-white">
                    <Play className="h-8 w-8" />
                  </Button>
                </div>
              )}
              
              {/* Navigation Controls */}
              {mediaFiles.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
                    onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                    disabled={currentIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
                    onClick={() => setCurrentIndex(Math.min(mediaFiles.length - 1, currentIndex + 1))}
                    disabled={currentIndex === mediaFiles.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              
              {/* Counter */}
              {mediaFiles.length > 1 && (
                <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
                  {currentIndex + 1}/{mediaFiles.length}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Audio Files */}
      {audioFiles.map((file) => (
        <Card key={file.id} className="p-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
              <Volume2 className="h-5 w-5 text-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
            </div>
            <Button variant="ghost" size="icon">
              <Play className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Audio Progress Bar */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">0:38</span>
            <div className="flex-1 h-1 bg-muted rounded-full">
              <div className="h-full w-1/3 bg-green-500 rounded-full" />
            </div>
            <span className="text-xs text-muted-foreground">12:49</span>
          </div>
        </Card>
      ))}

      {/* Document Files */}
      {documentFiles.map((file) => (
        <Card key={file.id} className="p-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/10 rounded-full flex items-center justify-center">
              <Download className="h-5 w-5 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
            </div>
            <Button variant="ghost" size="icon">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};