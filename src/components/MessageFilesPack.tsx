import { useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Download, Lock, Volume2, Image, Video, Music, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { FullScreenMediaViewer } from '@/components/FullScreenMediaViewer';
import { PPVUnlockDialog } from '@/components/PPVUnlockDialog';

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
  messageId?: string;
  sellerId?: string;
  buyerId?: string;
  isDownloadAllowed?: boolean;
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const MessageFilesPack = ({ 
  files, 
  onUnlock, 
  messageId, 
  sellerId, 
  buyerId,
  isDownloadAllowed = false 
}: MessageFilesPackProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  
  // Group files by type and normalize to plural types
  const groupedFiles = files.reduce((acc, file) => {
    // Normalize singular types to plural
    let pluralType = file.type;
    if (file.type === 'image') pluralType = 'images';
    else if (file.type === 'video') pluralType = 'videos';  
    else if (file.type === 'document') pluralType = 'documents';
    // audio stays as audio
    
    if (!acc[pluralType]) acc[pluralType] = [];
    acc[pluralType].push(file);
    return acc;
  }, {} as Record<string, MessageFile[]>);

  // Create ordered array: images first, then videos, then audio, then documents
  const orderedFiles = [
    ...(groupedFiles.images || []),
    ...(groupedFiles.videos || []),
    ...(groupedFiles.audio || []),
    ...(groupedFiles.documents || [])
  ];

  const imageFiles = groupedFiles.images || [];
  const videoFiles = groupedFiles.videos || [];
  const audioFiles = groupedFiles.audio || [];
  const documentFiles = groupedFiles.documents || [];
  
  const currentFile = orderedFiles[currentIndex];
  
  // Get type-specific counter display
  const getTypeCounters = () => {
    const currentFileType = currentFile?.type;
    
    if (currentFileType === 'images') {
      const currentImageIndex = imageFiles.findIndex(f => f.id === currentFile.id) + 1;
      return {
        current: `${currentImageIndex}/${imageFiles.length}`,
        currentIcon: Image,
        others: [
          { count: videoFiles.length, icon: Video },
          { count: audioFiles.length, icon: Music }
        ].filter(item => item.count > 0)
      };
    } else if (currentFileType === 'videos') {
      const currentVideoIndex = videoFiles.findIndex(f => f.id === currentFile.id) + 1;
      return {
        current: `${currentVideoIndex}/${videoFiles.length}`,
        currentIcon: Video,
        others: [
          { count: imageFiles.length, icon: Image },
          { count: audioFiles.length, icon: Music }
        ].filter(item => item.count > 0)
      };
    } else if (currentFileType === 'audio') {
      const currentAudioIndex = audioFiles.findIndex(f => f.id === currentFile.id) + 1;
      return {
        current: `${currentAudioIndex}/${audioFiles.length}`,
        currentIcon: Music,
        others: [
          { count: imageFiles.length, icon: Image },
          { count: videoFiles.length, icon: Video }
        ].filter(item => item.count > 0)
      };
    }
    
    return null;
  };

  const typeCounters = getTypeCounters();

  // Filter media files (images and videos)
  const mediaFiles = [...imageFiles, ...videoFiles];
  
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

  const handleUnlockComplete = () => {
    // Refresh the message or update the files state
    // This will be handled by the parent component
    setShowUnlockDialog(false);
  };

  const handleMediaClick = () => {
    if (!isLocked) {
      setShowFullScreen(true);
    }
  };

  // If locked, show unlock interface with beautiful blur effect
  if (isLocked) {
    return (
      <>
        <Card className="w-80 bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-dashed border-2 border-purple-500/50">
          <CardContent className="p-6 text-center relative overflow-hidden">
            {/* Blurred preview background */}
            <div className="absolute inset-0 opacity-20">
              {currentFile && currentFile.type === 'images' && (
                <div 
                  className="w-full h-full bg-cover bg-center filter blur-xl scale-110"
                  style={{ 
                    backgroundImage: `url(${currentFile.url || currentFile.preview})` 
                  }}
                />
              )}
            </div>
            
            <div className="relative z-10">
              <Lock className="h-12 w-12 mx-auto mb-4 text-purple-400" />
              <h3 className="font-semibold mb-2">Premium Content</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {files.length} file{files.length !== 1 ? 's' : ''} • {formatFileSize(files.reduce((sum, f) => sum + f.size, 0))}
              </p>
              
              {/* File type preview */}
              <div className="flex justify-center gap-2 mb-4">
                {imageFiles.length > 0 && (
                  <Badge variant="outline" className="border-purple-400 text-purple-300">
                    {imageFiles.length} <Image className="h-3 w-3 ml-1" />
                  </Badge>
                )}
                {videoFiles.length > 0 && (
                  <Badge variant="outline" className="border-blue-400 text-blue-300">
                    {videoFiles.length} <Video className="h-3 w-3 ml-1" />
                  </Badge>
                )}
                {audioFiles.length > 0 && (
                  <Badge variant="outline" className="border-green-400 text-green-300">
                    {audioFiles.length} <Music className="h-3 w-3 ml-1" />
                  </Badge>
                )}
              </div>
              
              <div className="text-3xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                ${totalPrice.toFixed(2)}
              </div>
              <Button 
                className="w-full mb-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                onClick={() => setShowUnlockDialog(true)}
              >
                UNLOCK FOR ${totalPrice.toFixed(2)}
              </Button>
              <p className="text-xs text-muted-foreground">
                Premium content • Instant access after payment
              </p>
            </div>
          </CardContent>
        </Card>

        {showUnlockDialog && messageId && sellerId && buyerId && (
          <PPVUnlockDialog
            isOpen={showUnlockDialog}
            onClose={() => setShowUnlockDialog(false)}
            onUnlockComplete={handleUnlockComplete}
            files={files}
            messageId={messageId}
            sellerId={sellerId}
            buyerId={buyerId}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="space-y-3 max-w-sm">
        {/* Main Media Pack */}
        {orderedFiles.length > 0 && (
          <Card className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" onClick={handleMediaClick}>
            <div className="relative">
              {/* Media Content */}
              <div className="aspect-square bg-muted flex items-center justify-center relative">
                {currentFile?.type === 'images' ? (
                  <img 
                    src={currentFile?.url || currentFile?.preview} 
                    alt={currentFile?.name}
                    className="w-full h-full object-cover"
                  />
                ) : currentFile?.type === 'videos' ? (
                  <div className="w-full h-full bg-black flex items-center justify-center relative">
                    {currentFile.preview && (
                      <img 
                        src={currentFile.preview}
                        alt={currentFile.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Button variant="ghost" size="icon" className="text-white bg-black/50 hover:bg-black/70">
                        <Play className="h-8 w-8" />
                      </Button>
                    </div>
                  </div>
                ) : currentFile?.type === 'audio' ? (
                  <div className="w-full h-full bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center">
                    <div className="text-center text-white">
                      <Music className="h-12 w-12 mx-auto mb-2" />
                      <p className="text-sm font-medium truncate px-4">{currentFile.name}</p>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                    <div className="text-center text-white">
                      <FileText className="h-12 w-12 mx-auto mb-2" />
                      <p className="text-sm font-medium truncate px-4">{currentFile?.name}</p>
                    </div>
                  </div>
                )}
                
                {/* Navigation Controls */}
                {orderedFiles.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentIndex(Math.max(0, currentIndex - 1));
                      }}
                      disabled={currentIndex === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentIndex(Math.min(orderedFiles.length - 1, currentIndex + 1));
                      }}
                      disabled={currentIndex === orderedFiles.length - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}
                
                {/* Smart Counter with type indicators */}
                {typeCounters && (
                  <div className="absolute top-2 right-2 flex items-center gap-2">
                    <Badge variant="secondary" className="bg-black/60 text-white border-0">
                      <typeCounters.currentIcon className="h-3 w-3 mr-1" />
                      {typeCounters.current}
                    </Badge>
                    
                    {typeCounters.others.map((other, index) => (
                      <Badge key={index} variant="outline" className="bg-black/40 text-white/70 border-white/30">
                        <other.icon className="h-3 w-3 mr-1" />
                        {other.count}
                      </Badge>
                    ))}
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

      </div>

      {/* Full Screen Viewer */}
      <FullScreenMediaViewer
        isOpen={showFullScreen}
        onClose={() => setShowFullScreen(false)}
        files={orderedFiles}
        initialIndex={currentIndex}
        isDownloadAllowed={isDownloadAllowed}
        showTypeCounters={true}
      />
    </>
  );
};