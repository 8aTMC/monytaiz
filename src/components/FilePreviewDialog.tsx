import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Download, AtSign, Hash, FolderOpen, FileText, DollarSign, Edit, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { VideoQualityBadge } from './VideoQualityBadge';
import { getVideoMetadataFromFile, VideoQualityInfo } from '@/lib/videoQuality';
import { CustomAudioPlayer } from '@/components/CustomAudioPlayer';
import { EnhancedVideoPlayer } from '@/components/EnhancedVideoPlayer';
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
  // Selection props
  selecting?: boolean;
  selectedFiles?: Set<string>;
  onToggleSelection?: (fileId: string) => void;
  fileId?: string;
}

export const FilePreviewDialog = ({
  file,
  open,
  onOpenChange,
  files = [],
  totalFiles = 0,
  currentIndex = 0,
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
  onTitleChange,
  selecting = false,
  selectedFiles,
  onToggleSelection,
  fileId
}: FilePreviewDialogProps) => {
  // ===== ALL STATE HOOKS MUST BE AT THE TOP (React Rules of Hooks) =====
  
  // Internal navigation state - manages which file to display
  const [internalCurrentIndex, setInternalCurrentIndex] = useState(0);
  
  // Media state
  const [fileUrl, setFileUrl] = useState<string>('');
  const [videoQualityInfo, setVideoQualityInfo] = useState<VideoQualityInfo | null>(null);
  const [videoAspectRatio, setVideoAspectRatio] = useState<string>('16/9');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Dialog states
  const [mentionsDialogOpen, setMentionsDialogOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [foldersDialogOpen, setFoldersDialogOpen] = useState(false);
  const [descriptionDialogOpen, setDescriptionDialogOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [editTitleDialogOpen, setEditTitleDialogOpen] = useState(false);
  
  // Client-side mounting state
  const [isMounted, setIsMounted] = useState(false);
  
  // Prevent dialog closing during selection operations
  const [isSelectingFile, setIsSelectingFile] = useState(false);
  
  // ===== DERIVED STATE AND COMPUTED VALUES =====
  
  // Validate files array to prevent undefined navigation
  const safeFiles = Array.isArray(files) ? files : [];
  
  // Determine which file to display
  const displayFile = safeFiles.length > 0 ? safeFiles[internalCurrentIndex] : file;

  // ===== EFFECTS =====
  
  // Initialize internal index when dialog opens
  useEffect(() => {
    if (open && typeof currentIndex === 'number') {
      const clampedIndex = Math.max(0, Math.min(currentIndex, safeFiles.length - 1));
      console.log('FilePreviewDialog: Index changed', { 
        oldIndex: internalCurrentIndex, 
        newIndex: clampedIndex, 
        fileName: safeFiles[clampedIndex]?.name 
      });
      setInternalCurrentIndex(clampedIndex);
      // Clear URL immediately to prevent showing wrong content
      setFileUrl('');
    }
  }, [open, currentIndex, safeFiles.length]);
  
  // Initialize client-side mounting
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Derive navigation state from internal index
  const fileCount = safeFiles.length || totalFiles || 0;
  const shouldShowNavigation = fileCount > 1;
  const hasNext = internalCurrentIndex < fileCount - 1;
  const hasPrevious = internalCurrentIndex > 0;
  
  // Internal navigation handlers with loading states
  const handlePrevious = () => {
    if (hasPrevious && !isNavigating) {
      setIsNavigating(true);
      setInternalCurrentIndex(prev => prev - 1);
      setTimeout(() => setIsNavigating(false), 300);
    }
  };
  
  const handleNext = () => {
    if (hasNext && !isNavigating) {
      setIsNavigating(true);
      setInternalCurrentIndex(prev => prev + 1);
      setTimeout(() => setIsNavigating(false), 300);
    }
  };

  // Debug navigation values - only log when dialog opens
  useEffect(() => {
    if (open) {
      console.log('FilePreviewDialog Navigation Debug:', {
        fileCount,
        currentIndex: internalCurrentIndex,
        hasNext,
        hasPrevious,
        shouldShowNavigation,
        filesLength: safeFiles.length,
        totalFiles
      });
    }
  }, [open, fileCount, internalCurrentIndex, hasNext, hasPrevious, shouldShowNavigation, safeFiles.length, totalFiles]);

  useEffect(() => {
    // Cancel any pending operations
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Clear previous states immediately
    setFileUrl('');
    setVideoQualityInfo(null);
    setVideoAspectRatio('16/9');
    setIsLoadingUrl(false);
    
    if (!displayFile || !open) {
      return;
    }
    
    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    setIsLoadingUrl(true);
    
    console.log('FilePreviewDialog: Creating URL for file', { 
      name: displayFile.name, 
      index: internalCurrentIndex 
    });
    
    // Use timeout to ensure URL creation happens after state clearing
    setTimeout(() => {
      if (abortController.signal.aborted) return;
      
      const url = URL.createObjectURL(displayFile);
      
      if (abortController.signal.aborted) {
        URL.revokeObjectURL(url);
        return;
      }
      
      setFileUrl(url);
      setIsLoadingUrl(false);
      
      // Get video quality info and aspect ratio for video files
      if (getFileType() === 'video' && !abortController.signal.aborted) {
        getVideoMetadataFromFile(displayFile).then(qualityInfo => {
          if (abortController.signal.aborted) return;
          
          setVideoQualityInfo(qualityInfo);
          
          // Create a temporary video element to get dimensions
          const tempVideo = document.createElement('video');
          tempVideo.src = url;
          tempVideo.onloadedmetadata = () => {
            if (abortController.signal.aborted) {
              tempVideo.remove();
              return;
            }
            
            const width = tempVideo.videoWidth;
            const height = tempVideo.videoHeight;
            
            if (width && height) {
              // Calculate aspect ratio
              const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
              const divisor = gcd(width, height);
              const aspectW = width / divisor;
              const aspectH = height / divisor;
              setVideoAspectRatio(`${aspectW}/${aspectH}`);
            }
            
            // Clean up
            tempVideo.remove();
          };
        }).catch(error => {
          if (!abortController.signal.aborted) {
            console.error('Error getting video metadata:', error);
          }
        });
      }
    }, 50);
    
    return () => {
      abortController.abort();
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [displayFile, open, internalCurrentIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && hasPrevious) {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === 'ArrowRight' && hasNext) {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, hasPrevious, hasNext, onOpenChange]);

  const getFileType = () => {
    const extension = '.' + displayFile.name.split('.').pop()?.toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif'].includes(extension)) return 'image';
    if (['.mp4', '.mov', '.webm', '.mkv'].includes(extension)) return 'video';
    if (['.mp3', '.wav', '.aac', '.ogg', '.opus'].includes(extension)) return 'audio';
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

  const handleDownload = () => {
    if (fileUrl) {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = displayFile.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Determine container size based on video aspect ratio
  const getContainerDimensions = () => {
    if (fileType === 'video' && videoAspectRatio) {
      const [width, height] = videoAspectRatio.split('/').map(Number);
      const aspectValue = width / height;
      
      // Calculate available space based on modal size minus header and minimal padding
      const headerHeight = 100; // Approximate header height
      const modalMaxHeight = window.innerHeight * 0.95;
      const availableHeight = modalMaxHeight - headerHeight - 4; // 4px for minimal spacing
      
      // For vertical videos (aspect < 1), maximize available height
      if (aspectValue < 1) {
        const maxWidth = Math.min(window.innerWidth * 0.6, 700); // More width for vertical videos
        const calculatedHeight = maxWidth / aspectValue;
        const finalHeight = Math.min(calculatedHeight, availableHeight);
        const finalWidth = finalHeight * aspectValue;
        
        return {
          width: `${Math.min(finalWidth, maxWidth)}px`,
          height: `${finalHeight}px`,
          aspectRatio: videoAspectRatio
        };
      } 
      // For horizontal videos (aspect >= 1), use most of available space
      else {
        const maxWidth = Math.min(window.innerWidth * 0.9, 1300); // Use more width
        const calculatedHeight = maxWidth / aspectValue;
        const finalHeight = Math.min(calculatedHeight, availableHeight);
        const finalWidth = finalHeight * aspectValue;
        
        return {
          width: `${finalWidth}px`,
          height: `${finalHeight}px`,
          aspectRatio: videoAspectRatio
        };
      }
    }
    
    // Default for non-video content - use available space efficiently
    const headerHeight = 120;
    const modalMaxHeight = window.innerHeight * 0.95;
    const availableHeight = modalMaxHeight - headerHeight - 4;
    
    return {
      width: `${Math.min(window.innerWidth * 0.8, 1200)}px`,
      height: `${Math.min(availableHeight, 800)}px`, 
      aspectRatio: '16/9'
    };
  };

  const containerDimensions = getContainerDimensions();

  


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

  // ===== CONDITIONAL RENDERING GUARDS =====
  
  // Don't render if not mounted (prevents hydration issues)
  if (!isMounted) return null;
  
  // Don't render if dialog is closed
  if (!open) return null;
  
  // Don't render if no file to display
  if (!displayFile) return null;

  return (
    <>
      <style>{overlayStyles}</style>
      {ReactDOM.createPortal(
        <>
          {/* Custom overlay */}
          <div 
            className="media-overlay"
            onClick={(e) => {
              // Prevent closing during selection operations
              if (isSelectingFile) {
                e.preventDefault();
                e.stopPropagation();
                return;
              }
              onOpenChange(false);
            }}
          />
          
          {/* Dialog content */}
          <div 
            className="media-dialog border bg-background shadow-lg rounded-lg overflow-hidden flex flex-col relative"
            style={{
              width: 'fit-content',
              height: 'fit-content',
              maxWidth: '90vw',
              maxHeight: '95vh',
              minWidth: '400px'
            }}
            onClick={(e) => e.stopPropagation()}
          >

            {/* Navigation buttons */}
            {shouldShowNavigation && (
              <>
                {/* Left navigation button */}
                {hasPrevious && (
                  <Button
                    variant="secondary"
                    size="icon" 
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 z-50 shadow-lg"
                    onClick={handlePrevious}
                    disabled={isNavigating || isLoadingUrl}
                    aria-label="Previous file"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                )}
                
                {/* Right navigation button */}
                {hasNext && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 z-50 shadow-lg"
                    onClick={handleNext}
                    disabled={isNavigating || isLoadingUrl}
                    aria-label="Next file"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                )}
              </>
            )}
            {/* Header */}
            <div className="p-4 border-b">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold truncate">
                    {displayFile.name}
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
                  {shouldShowNavigation && (
                    <span className="text-sm text-muted-foreground ml-2">
                      {internalCurrentIndex + 1} of {fileCount}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {/* Selection checkbox */}
                  {selecting && onToggleSelection && fileId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setIsSelectingFile(true);
                        onToggleSelection(fileId);
                        // Reset flag after selection to allow normal dialog behavior
                        setTimeout(() => setIsSelectingFile(false), 100);
                      }}
                      className="p-1 h-8 w-8"
                      aria-label="Toggle selection"
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selectedFiles?.has(fileId) 
                          ? 'bg-primary border-primary text-primary-foreground' 
                          : 'border-muted-foreground bg-transparent'
                      }`}>
                        {selectedFiles?.has(fileId) && <Check className="w-3 h-3" />}
                      </div>
                    </Button>
                  )}
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
                    {formatFileSize(displayFile.size)}
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
            <div className="flex-1 overflow-hidden relative flex items-center justify-center">
              {isLoadingUrl || isNavigating ? (
                <div className="flex items-center justify-center text-muted-foreground bg-muted/20 rounded-xl" style={{
                  width: containerDimensions.width,
                  height: containerDimensions.height,
                }}>
                  <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p>{isNavigating ? 'Loading next file...' : 'Loading media...'}</p>
                  </div>
                </div>
              ) : (
                <div 
                  key={`${displayFile.name}-${internalCurrentIndex}`}
                  className="bg-muted/20 rounded-xl overflow-hidden relative"
                  style={{
                    width: containerDimensions.width,
                    height: containerDimensions.height,
                    aspectRatio: containerDimensions.aspectRatio,
                    pointerEvents: 'auto'
                  }}
                >

                  {fileType === 'image' && fileUrl && (
                    <div
                      className="w-full h-full rounded-xl bg-contain bg-no-repeat bg-center"
                      style={{
                        backgroundImage: `url("${fileUrl}")`,
                        backgroundSize: 'contain'
                      }}
                    />
                  )}
                  
                  {fileType === 'video' && fileUrl && (
                    <EnhancedVideoPlayer
                      key={`video-${displayFile.name}-${internalCurrentIndex}-${fileUrl.substring(0, 10)}`}
                      src={fileUrl}
                      aspectRatio={containerDimensions.aspectRatio}
                      className="w-full h-full rounded-xl"
                      onError={(error) => console.error('Video playback error:', error)}
                    />
                  )}
                  
                  {fileType === 'audio' && fileUrl && (
                    <div className="flex items-center justify-center w-full h-full">
                      <CustomAudioPlayer
                        key={`audio-${displayFile.name}-${internalCurrentIndex}-${fileUrl.substring(0, 10)}`}
                        src={fileUrl}
                        title={title || displayFile.name}
                      />
                    </div>
                  )}
                  
                  {fileType === 'document' && (
                    <div className="flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <div className="w-24 h-24 mx-auto mb-4 bg-muted rounded-lg flex items-center justify-center">
                          <span className="text-2xl font-bold text-muted-foreground">
                            {displayFile.name.split('.').pop()?.toUpperCase()}
                          </span>
                        </div>
                        <p>Document preview not available</p>
                        <p className="text-sm mt-2">File will be uploaded as-is</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
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