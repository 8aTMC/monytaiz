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
import { useBlobUrl } from '@/hooks/useBlobUrl';

interface FileWithId {
  id: string;
  file: File;
}

interface FilePreviewDialogProps {
  file: File;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  
  // Navigation props
  files?: (File | FileWithId)[];
  totalFiles?: number; // Backup detection method
  currentIndex?: number;
  onNavigate?: (index: number) => void;
  // Metadata props (legacy - fallback)
  mentions?: string[];
  tags?: string[];
  folders?: string[];
  description?: string;
  suggestedPrice?: number;
  title?: string;
  // Change handlers (legacy - fallback)
  onMentionsChange?: (mentions: string[]) => void;
  onTagsChange?: (tags: string[]) => void;
  onFoldersChange?: (folders: string[]) => void;
  onDescriptionChange?: (description: string) => void;
  onPriceChange?: (price: number | null) => void;
  onTitleChange?: (title: string) => void;
  // New index/ID-aware metadata handlers
  getMetadataById?: (fileId: string) => {
    mentions: string[];
    tags: string[];
    folders: string[];
    description: string;
    suggestedPrice: number | null;
  } | null;
  updateMetadataById?: (fileId: string, changes: Partial<{
    mentions: string[];
    tags: string[];
    folders: string[];
    description: string;
    suggestedPrice: number | null;
  }>) => void;
  getMetadataByIndex?: (index: number) => {
    mentions: string[];
    tags: string[];
    folders: string[];
    description: string;
    suggestedPrice: number | null;
  } | null;
  updateMetadataByIndex?: (index: number, changes: Partial<{
    mentions: string[];
    tags: string[];
    folders: string[];
    description: string;
    suggestedPrice: number | null;
  }>) => void;
  // Selection props
  selecting?: boolean;
  selectedFiles?: Set<string>;
  onToggleSelection?: (fileId: string) => void;
  fileId?: string;
  // External signal to re-sync local metadata when parent updates
  metadataVersion?: number | string;
}

export const FilePreviewDialog = ({
  file,
  open,
  onOpenChange,
  files = [],
  totalFiles = 0,
  currentIndex = 0,
  onNavigate,
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
  getMetadataById,
  updateMetadataById,
  getMetadataByIndex,
  updateMetadataByIndex,
  selecting = false,
  selectedFiles,
  onToggleSelection,
  fileId,
  metadataVersion,
}: FilePreviewDialogProps) => {
  // ===== ALL STATE HOOKS MUST BE AT THE TOP (React Rules of Hooks) =====
  
  // Centralized blob URL management
  const { createBlobUrl, revokeBlobUrl, safeRevokeBlobUrl, revokeAllBlobUrls } = useBlobUrl();
  
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
  const displayFileData = safeFiles.length > 0 ? safeFiles[internalCurrentIndex] : null;
  const displayFile = displayFileData ? 
    ('file' in displayFileData ? displayFileData.file : displayFileData) : file;
  
  // Get current file ID for selection logic
  const currentFileId = displayFileData && 'id' in displayFileData ? displayFileData.id : fileId;
  const isSelected = !!(selectedFiles && currentFileId && selectedFiles.has(currentFileId));

  // Get current metadata using index/ID-aware handlers or fallback to props
  const getCurrentMetadata = () => {
    // Try ID-based metadata first
    if (getMetadataById && currentFileId) {
      const metadata = getMetadataById(currentFileId);
      if (metadata) return metadata;
    }
    
    // Try index-based metadata
    if (getMetadataByIndex && safeFiles.length > 0) {
      const metadata = getMetadataByIndex(internalCurrentIndex);
      if (metadata) return metadata;
    }
    
    // Fallback to props (legacy behavior)
    return {
      mentions,
      tags,
      folders,
      description,
      suggestedPrice
    };
  };

  // Reactive metadata state that updates with navigation and changes
  const [currentMetadata, setCurrentMetadata] = useState(() => getCurrentMetadata());

  // Create update handlers that route to appropriate updater
  const handleMetadataUpdate = (field: string, value: any) => {
    // Keep values as-is (price is in dollars)
    const newValue = value;

    // Optimistic local update for immediate UI feedback
    setCurrentMetadata(prev => ({
      ...prev,
      [field]: newValue
    }));

    // Propagate to parent (ID first, then index)
    if (updateMetadataById && currentFileId) {
      updateMetadataById(currentFileId, { [field]: newValue });
      return;
    }
    if (updateMetadataByIndex && safeFiles.length > 0) {
      updateMetadataByIndex(internalCurrentIndex, { [field]: newValue });
      return;
    }

    // Legacy handlers
    switch (field) {
      case 'mentions':
        onMentionsChange?.(newValue);
        break;
      case 'tags':
        onTagsChange?.(newValue);
        break;
      case 'folders':
        onFoldersChange?.(newValue);
        break;
      case 'description':
        onDescriptionChange?.(newValue);
        break;
      case 'suggestedPrice':
        onPriceChange?.(newValue);
        break;
    }
  };
  // ===== EFFECTS =====
  
  // Initialize internal index when dialog opens
  useEffect(() => {
    if (open && typeof currentIndex === 'number') {
      const clampedIndex = Math.max(0, Math.min(currentIndex, safeFiles.length - 1));
      console.log('FilePreviewDialog: Index changed', { 
        oldIndex: internalCurrentIndex, 
        newIndex: clampedIndex, 
        fileName: displayFileData ? 
          ('file' in displayFileData ? displayFileData.file.name : displayFileData.name) : 'unknown'
      });
      setInternalCurrentIndex(clampedIndex);
      // Clear URL immediately to prevent showing wrong content
      setFileUrl('');
    }
  }, [open, currentIndex, safeFiles.length]);

  // Reset metadata dialog states when navigating to prevent carryover
  useEffect(() => {
    // Close all metadata dialogs when index changes to prevent stale data
    setMentionsDialogOpen(false);
    setTagsDialogOpen(false);
    setFoldersDialogOpen(false);
    setDescriptionDialogOpen(false);
    setPriceDialogOpen(false);
    setEditTitleDialogOpen(false);
  }, [internalCurrentIndex]);

// Update metadata state when navigation occurs or external metadata changes
useEffect(() => {
  setCurrentMetadata(getCurrentMetadata());
}, [internalCurrentIndex, currentFileId, mentions, tags, folders, description, suggestedPrice, metadataVersion]);
  
// Also sync metadata when external props change (for parent updates)
useEffect(() => {
  if (open) {
    const latestMetadata = getCurrentMetadata();
    setCurrentMetadata(latestMetadata);
  }
}, [open, mentions, tags, folders, description, suggestedPrice, metadataVersion]);
  
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
      const newIndex = internalCurrentIndex - 1;
      // Notify parent first to keep indices in sync
      if (onNavigate) onNavigate(newIndex);
      setInternalCurrentIndex(newIndex);
      setTimeout(() => setIsNavigating(false), 300);
    }
  };
  
  const handleNext = () => {
    if (hasNext && !isNavigating) {
      setIsNavigating(true);
      const newIndex = internalCurrentIndex + 1;
      // Notify parent first to keep indices in sync
      if (onNavigate) onNavigate(newIndex);
      setInternalCurrentIndex(newIndex);
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
    setVideoQualityInfo(null);
    setVideoAspectRatio('16/9');
    setIsLoadingUrl(false);
    // Ensure consumers release old src before we revoke in cleanup
    setFileUrl('');
    
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
    
    // Create URL with centralized blob management
    const url = createBlobUrl(displayFile);
    
    if (abortController.signal.aborted) {
      safeRevokeBlobUrl(url);
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
        const tempUrl = createBlobUrl(displayFile);
        tempVideo.preload = 'metadata';
        tempVideo.src = tempUrl;
        tempVideo.onloadedmetadata = () => {
          if (abortController.signal.aborted) {
            tempVideo.src = '';
            safeRevokeBlobUrl(tempUrl);
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
          tempVideo.src = '';
          safeRevokeBlobUrl(tempUrl);
          tempVideo.remove();
        };
      }).catch(error => {
        if (!abortController.signal.aborted) {
          console.error('Error getting video metadata:', error);
        }
      });
    }
    
    return () => {
      abortController.abort();
      // Clear src before revoking to avoid race with media decoding
      setFileUrl('');
      // Use safe revoke to prevent net::ERR_FILE_NOT_FOUND
      safeRevokeBlobUrl(url);
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
      
      // Calculate available space based on modal size minus header, toolbar, and controls
      const headerHeight = 120; // Header with navigation and file info
      const toolbarHeight = 100; // Metadata editing toolbar at bottom
      const controlsHeight = 60; // Video player controls
      const modalMaxHeight = window.innerHeight * 0.95;
      const availableHeight = modalMaxHeight - headerHeight - toolbarHeight - controlsHeight;
      
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
                  {selecting && onToggleSelection && currentFileId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setIsSelectingFile(true);
                        onToggleSelection(currentFileId);
                        // Reset flag after selection to allow normal dialog behavior
                        setTimeout(() => setIsSelectingFile(false), 100);
                      }}
                      className="p-1 h-8 w-8"
                      aria-label="Toggle selection"
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selectedFiles?.has(currentFileId) 
                          ? 'bg-primary border-primary text-primary-foreground' 
                          : 'border-muted-foreground bg-transparent'
                      }`}>
                        {selectedFiles?.has(currentFileId) && <Check className="w-3 h-3" />}
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
                {(onMentionsChange || updateMetadataById || updateMetadataByIndex) && (
                  <Button
                    variant={currentMetadata.mentions.length > 0 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMentionsDialogOpen(true)}
                    className="text-xs"
                  >
                     <AtSign className="w-3 h-3 mr-1" />
                    Mentions {currentMetadata.mentions.length > 0 && `(${currentMetadata.mentions.length})`}
                  </Button>
                )}
                
                {(onTagsChange || updateMetadataById || updateMetadataByIndex) && (
                  <Button
                    variant={currentMetadata.tags.length > 0 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTagsDialogOpen(true)}
                    className="text-xs"
                  >
                     <Hash className="w-3 h-3 mr-1" />
                    Tags {currentMetadata.tags.length > 0 && `(${currentMetadata.tags.length})`}
                  </Button>
                )}
                
                {(onFoldersChange || updateMetadataById || updateMetadataByIndex) && (
                  <Button
                    variant={currentMetadata.folders.length > 0 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFoldersDialogOpen(true)}
                    className="text-xs"
                  >
                    <FolderOpen className="w-3 h-3 mr-1" />
                    Folders
                  </Button>
                )}
                
                {(onDescriptionChange || updateMetadataById || updateMetadataByIndex) && (
                  <Button
                    variant={currentMetadata.description && currentMetadata.description.length > 0 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDescriptionDialogOpen(true)}
                    className="text-xs"
                  >
                     <FileText className="w-3 h-3 mr-1" />
                    Description {currentMetadata.description && currentMetadata.description.length > 0 && '✓'}
                  </Button>
                )}
                
                {(onPriceChange || updateMetadataById || updateMetadataByIndex) && (
                  <Button
                    variant={currentMetadata.suggestedPrice && currentMetadata.suggestedPrice > 0 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPriceDialogOpen(true)}
                    className="text-xs"
                  >
                     <DollarSign className="w-3 h-3 mr-1" />
                    Price {currentMetadata.suggestedPrice && currentMetadata.suggestedPrice > 0 && `($${currentMetadata.suggestedPrice.toFixed(2)})`}
                  </Button>
                )}
              </div>

              {/* Show current metadata values */}
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {currentMetadata.mentions.length > 0 && (
                  <div>
                    <span className="font-medium">Mentions:</span> {currentMetadata.mentions.join(', ')}
                  </div>
                )}
                {currentMetadata.tags.length > 0 && (
                  <div>
                    <span className="font-medium">Tags:</span> {currentMetadata.tags.join(', ')}
                  </div>
                )}
                {currentMetadata.description && (
                  <div>
                    <span className="font-medium">Description:</span> {currentMetadata.description.length > 60 ? `${currentMetadata.description.substring(0, 60)}...` : currentMetadata.description}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Metadata Dialogs */}
          {(onMentionsChange || updateMetadataById || updateMetadataByIndex) && (
            <MentionsDialog
              key={`mentions-${internalCurrentIndex}`}
              open={mentionsDialogOpen}
              onOpenChange={setMentionsDialogOpen}
              mentions={currentMetadata.mentions}
              onMentionsChange={(mentions) => handleMetadataUpdate('mentions', mentions)}
            />
          )}

          {(onTagsChange || updateMetadataById || updateMetadataByIndex) && (
            <TagsDialog
              key={`tags-${internalCurrentIndex}`}
              open={tagsDialogOpen}
              onOpenChange={setTagsDialogOpen}
              tags={currentMetadata.tags}
              onTagsChange={(tags) => handleMetadataUpdate('tags', tags)}
            />
          )}

          {(onFoldersChange || updateMetadataById || updateMetadataByIndex) && (
            <FolderSelectDialog
              key={`folders-${internalCurrentIndex}`}
              open={foldersDialogOpen}
              onOpenChange={setFoldersDialogOpen}
              selectedFolders={currentMetadata.folders}
              onFoldersChange={(folders) => handleMetadataUpdate('folders', folders)}
            />
          )}

          {(onDescriptionChange || updateMetadataById || updateMetadataByIndex) && (
            <DescriptionDialog
              key={`description-${internalCurrentIndex}`}
              open={descriptionDialogOpen}
              onOpenChange={setDescriptionDialogOpen}
              description={currentMetadata.description}
              onDescriptionChange={(description) => handleMetadataUpdate('description', description)}
            />
          )}

          {(onPriceChange || updateMetadataById || updateMetadataByIndex) && (
            <PriceDialog
              key={`price-${internalCurrentIndex}`}
              open={priceDialogOpen}
              onOpenChange={setPriceDialogOpen}
              price={currentMetadata.suggestedPrice || undefined}
              onPriceChange={(price) => handleMetadataUpdate('suggestedPrice', price ?? null)}
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