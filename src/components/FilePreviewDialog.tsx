import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Download, AtSign, Hash, FolderOpen, FileText, DollarSign, Edit, Play, Pause, Volume2, VolumeX, Maximize, ChevronLeft, ChevronRight } from 'lucide-react';
import { VideoQualityBadge } from './VideoQualityBadge';
import { getVideoMetadataFromFile, VideoQualityInfo } from '@/lib/videoQuality';
import { CustomAudioPlayer } from '@/components/CustomAudioPlayer';
import { MentionsDialog } from './MentionsDialog';
import { TagsDialog } from './TagsDialog';
import { FolderSelectDialog } from './FolderSelectDialog';
import { DescriptionDialog } from './DescriptionDialog';
import { PriceDialog } from './PriceDialog';
import { EditTitleDialog } from './EditTitleDialog';

interface FilePreviewDialogProps {
  file: File;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  
  // Navigation props
  files?: File[];
  totalFiles?: number; // Backup detection method
  currentIndex?: number;
  onPrevious?: () => void;
  onNext?: () => void;
  // Metadata props
  mentions?: string[];
  tags?: string[];
  folders?: string[];
  description?: string;
  suggestedPrice?: number;
  title?: string;
  // Change handlers
  onMentionsChange?: (mentions: string[]) => void;
  onTagsChange?: (tags: string[]) => void;
  onFoldersChange?: (folders: string[]) => void;
  onDescriptionChange?: (description: string) => void;
  onPriceChange?: (price: number | null) => void;
  onTitleChange?: (title: string) => void;
}

export const FilePreviewDialog = ({
  file,
  open,
  onOpenChange,
  files,
  totalFiles,
  currentIndex,
  onPrevious,
  onNext,
  mentions = [],
  tags = [],
  folders = [],
  description = '',
  suggestedPrice = 0,
  title,
  onMentionsChange,
  onTagsChange,
  onFoldersChange,
  onDescriptionChange,
  onPriceChange,
  onTitleChange
}: FilePreviewDialogProps) => {
  const [fileUrl, setFileUrl] = useState<string>('');
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoQualityInfo, setVideoQualityInfo] = useState<VideoQualityInfo | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Determine if we should show navigation
  const shouldShowNavigation = (files && files.length > 1) || (totalFiles && totalFiles > 1);
  const fileCount = files?.length || totalFiles || 0;

  // Dialog states
  const [mentionsDialogOpen, setMentionsDialogOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [foldersDialogOpen, setFoldersDialogOpen] = useState(false);
  const [descriptionDialogOpen, setDescriptionDialogOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [editTitleDialogOpen, setEditTitleDialogOpen] = useState(false);

  // Early return after hooks are declared
  if (!open || !file) return null;

  // Debug navigation values
  console.log('FilePreviewDialog Navigation Debug:', {
    files: files?.length,
    totalFiles,
    currentIndex,
    shouldShowNavigation,
    fileCount,
    hasPrevious: onPrevious,
    hasNext: onNext
  });

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setFileUrl(url);
      
      // Get video quality info for video files
      if (getFileType() === 'video') {
        getVideoMetadataFromFile(file).then(setVideoQualityInfo);
      }
      
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && onPrevious) {
        e.preventDefault();
        onPrevious();
      } else if (e.key === 'ArrowRight' && onNext) {
        e.preventDefault();
        onNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onPrevious, onNext, onOpenChange]);

  const getFileType = () => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(extension)) return 'image';
    if (['.mp4', '.mov', '.webm', '.avi', '.mkv'].includes(extension)) return 'video';
    if (['.mp3', '.wav', '.aac', '.ogg'].includes(extension)) return 'audio';
    return 'document';
  };

  const fileType = getFileType();

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * videoDuration;
    
    videoRef.current.currentTime = newTime;
    setVideoCurrentTime(newTime);
  };

  const handleDownload = () => {
    if (fileUrl) {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Determine container size (using same logic as library viewer)
  const containerWidth = '900px';
  const containerHeight = '506px';
  const aspectRatio = '16/9';

  


  // Add styles for the modal overlay (same as library viewer)
  const overlayStyles = `
    .media-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.8);
      z-index: 9998;
      backdrop-filter: blur(4px);
    }
    .media-dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 9999;
    }
  `;

  return (
    <>
      <style>{overlayStyles}</style>
      {ReactDOM.createPortal(
        <>
          {/* Custom overlay */}
          <div 
            className="media-overlay"
            onClick={() => onOpenChange(false)}
          />
          
          {/* Dialog content */}
          <div 
            className="media-dialog border bg-background shadow-lg rounded-lg overflow-hidden flex flex-col relative"
            style={{
              width: 'fit-content',
              height: 'fit-content',
              maxWidth: '90vw',
              maxHeight: '90vh',
              minWidth: '400px'
            }}
            onClick={(e) => e.stopPropagation()}
          >

            {/* Navigation buttons */}
            {shouldShowNavigation && (
              <>
                {/* Left navigation button - BRIGHT AND VISIBLE */}
                <Button
                  variant="secondary"
                  size="icon" 
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 z-50 shadow-lg"
                  disabled={currentIndex == null || currentIndex <= 0}
                  onClick={onPrevious}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                
                {/* Right navigation button */}
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 z-50 shadow-lg"
                  disabled={currentIndex == null || currentIndex >= fileCount - 1}
                  onClick={onNext}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}
            {/* Header */}
            <div className="p-4 border-b">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold truncate">
                    {title || file.name}
                  </h2>
                  {onTitleChange && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditTitleDialogOpen(true)}
                      className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                      aria-label="Edit title"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  )}
                  {/* File counter */}
                  {shouldShowNavigation && currentIndex !== undefined && (
                    <span className="text-sm text-muted-foreground ml-2">
                      {currentIndex + 1} of {fileCount}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              {/* File Info Tags */}
              <div className="flex gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span className="font-medium">Type:</span>
                  <span className="capitalize bg-muted px-2 py-1 rounded text-xs">
                    {fileType}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium">Size:</span>
                  <span className="bg-muted px-2 py-1 rounded text-xs">
                    {formatFileSize(file.size)}
                  </span>
                </div>
                {videoQualityInfo && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Quality:</span>
                    <VideoQualityBadge qualityInfo={videoQualityInfo} />
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto relative">
              {/* Media Display */}
              <div className="p-4">
                <div 
                  className="flex items-center justify-center bg-muted/20 rounded-lg overflow-hidden relative"
                  style={{
                    width: containerWidth,
                    height: containerHeight,
                    aspectRatio: aspectRatio,
                    pointerEvents: 'auto'
                  }}
                >

                  {fileType === 'image' && fileUrl && (
                    <img
                      src={fileUrl}
                      alt={title || file.name}
                      className="w-full h-full object-contain"
                    />
                  )}
                  
                  {fileType === 'video' && fileUrl && (
                    <div className="relative w-full h-full">
                      <video
                        ref={videoRef}
                        src={fileUrl}
                        className="w-full h-full object-contain"
                        controls={false}
                        muted={isVideoMuted}
                        onPlay={() => setIsVideoPlaying(true)}
                        onPause={() => setIsVideoPlaying(false)}
                        onTimeUpdate={() => {
                          if (videoRef.current) {
                            setVideoCurrentTime(videoRef.current.currentTime);
                          }
                        }}
                        onLoadedMetadata={() => {
                          if (videoRef.current) {
                            setVideoDuration(videoRef.current.duration);
                          }
                        }}
                      />
                      
                      {/* Custom Video Controls Overlay */}
                      <div className="absolute bottom-16 left-4 flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            if (videoRef.current) {
                              if (isVideoPlaying) {
                                videoRef.current.pause();
                              } else {
                                videoRef.current.play();
                              }
                            }
                          }}
                        >
                          {isVideoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </Button>
                        
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            if (videoRef.current) {
                              videoRef.current.muted = !isVideoMuted;
                              setIsVideoMuted(!isVideoMuted);
                            }
                          }}
                        >
                          {isVideoMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </Button>
                        
                        {/* Quality badge */}
                        {videoQualityInfo && (
                          <VideoQualityBadge 
                            qualityInfo={videoQualityInfo}
                            showResolution={true}
                            width={videoRef.current?.videoWidth}
                            height={videoRef.current?.videoHeight}
                          />
                        )}
                      </div>
                      
                      {/* Fullscreen Button */}
                      <div className="absolute bottom-16 right-4">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            if (videoRef.current && videoRef.current.requestFullscreen) {
                              videoRef.current.requestFullscreen();
                            }
                          }}
                        >
                          <Maximize className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Video Progress Bar */}
                      <div className="absolute bottom-4 left-4 right-4 bg-black/50 rounded-lg p-3">
                        <div className="flex items-center gap-3 text-white text-sm">
                          <span className="text-xs font-mono">{formatTime(videoCurrentTime)}</span>
                          
                          {/* Seek Bar */}
                          <div 
                            className="flex-1 h-2 bg-white/30 rounded-full cursor-pointer relative"
                            onClick={handleSeek}
                          >
                            <div 
                              className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: `${videoDuration ? (videoCurrentTime / videoDuration) * 100 : 0}%` }}
                            />
                            {/* Seek handle */}
                            <div 
                              className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full shadow-lg transition-all"
                              style={{ left: `${videoDuration ? (videoCurrentTime / videoDuration) * 100 : 0}%`, marginLeft: '-8px' }}
                            />
                          </div>
                          
                          <span className="text-xs font-mono">{formatTime(videoDuration)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {fileType === 'audio' && fileUrl && (
                    <div className="flex items-center justify-center w-full h-full">
                      <CustomAudioPlayer
                        src={fileUrl}
                        title={title || file.name}
                      />
                    </div>
                  )}
                  
                  {fileType === 'document' && (
                    <div className="flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <div className="w-24 h-24 mx-auto mb-4 bg-muted rounded-lg flex items-center justify-center">
                          <span className="text-2xl font-bold text-muted-foreground">
                            {file.name.split('.').pop()?.toUpperCase()}
                          </span>
                        </div>
                        <p>Document preview not available</p>
                        <p className="text-sm mt-2">File will be uploaded as-is</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Metadata Editing Menu Bar */}
            <div className="p-4 border-t bg-background">
              <div className="flex flex-wrap gap-2">
                {onMentionsChange && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMentionsDialogOpen(true)}
                    className="text-xs"
                  >
                    <AtSign className="w-3 h-3 mr-1" />
                    Mentions {mentions.length > 0 && `(${mentions.length})`}
                  </Button>
                )}
                
                {onTagsChange && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTagsDialogOpen(true)}
                    className="text-xs"
                  >
                    <Hash className="w-3 h-3 mr-1" />
                    Tags {tags.length > 0 && `(${tags.length})`}
                  </Button>
                )}
                
                {onFoldersChange && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFoldersDialogOpen(true)}
                    className="text-xs"
                  >
                    <FolderOpen className="w-3 h-3 mr-1" />
                    Folders
                  </Button>
                )}
                
                {onDescriptionChange && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDescriptionDialogOpen(true)}
                    className="text-xs"
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    Description {description && description.length > 0 && '✓'}
                  </Button>
                )}
                
                {onPriceChange && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPriceDialogOpen(true)}
                    className="text-xs"
                  >
                    <DollarSign className="w-3 h-3 mr-1" />
                    Price {suggestedPrice > 0 && `($${(suggestedPrice / 100).toFixed(2)})`}
                  </Button>
                )}
              </div>

              {/* Show current metadata values */}
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {mentions.length > 0 && (
                  <div>
                    <span className="font-medium">Mentions:</span> {mentions.join(', ')}
                  </div>
                )}
                {tags.length > 0 && (
                  <div>
                    <span className="font-medium">Tags:</span> {tags.join(', ')}
                  </div>
                )}
                {description && (
                  <div>
                    <span className="font-medium">Description:</span> {description.length > 60 ? `${description.substring(0, 60)}...` : description}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Metadata Dialogs */}
          {onMentionsChange && (
            <MentionsDialog
              open={mentionsDialogOpen}
              onOpenChange={setMentionsDialogOpen}
              mentions={mentions}
              onMentionsChange={onMentionsChange}
            />
          )}

          {onTagsChange && (
            <TagsDialog
              open={tagsDialogOpen}
              onOpenChange={setTagsDialogOpen}
              tags={tags}
              onTagsChange={onTagsChange}
            />
          )}

          {onFoldersChange && (
            <FolderSelectDialog
              open={foldersDialogOpen}
              onOpenChange={setFoldersDialogOpen}
              selectedFolders={folders}
              onFoldersChange={onFoldersChange}
            />
          )}

          {onDescriptionChange && (
            <DescriptionDialog
              open={descriptionDialogOpen}
              onOpenChange={setDescriptionDialogOpen}
              description={description}
              onDescriptionChange={onDescriptionChange}
            />
          )}

          {onPriceChange && (
            <PriceDialog
              open={priceDialogOpen}
              onOpenChange={setPriceDialogOpen}
              price={suggestedPrice ? suggestedPrice / 100 : undefined}
              onPriceChange={onPriceChange}
            />
          )}

          {onTitleChange && (
            <EditTitleDialog
              open={editTitleDialogOpen}
              onOpenChange={setEditTitleDialogOpen}
              title={title || file.name}
              onTitleChange={onTitleChange}
            />
          )}
        </>,
        document.body
      )}
    </>
  );
};