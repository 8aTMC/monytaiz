import { useRef, useCallback, useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Play, CheckCircle, AlertCircle, RefreshCw, Pause, Clock, Plus, CheckSquare, Square } from 'lucide-react';
import { useFileUpload } from '@/hooks/useFileUpload';
import { EnhancedFileUploadRow } from './EnhancedFileUploadRow';
import { BatchMetadataToolbar } from './BatchMetadataToolbar';
import { SelectionHeader } from './SelectionHeader';
import { FilePreviewDialog } from './FilePreviewDialog';
import { UnifiedDuplicateDialog } from './UnifiedDuplicateDialog';
import { UnsupportedFilesDialog } from './UnsupportedFilesDialog';
import { useBatchDuplicateDetection, DuplicateMatch, QueueDuplicate } from '@/hooks/useBatchDuplicateDetection';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { HEICWarningDialog } from './HEICWarningDialog';
import { logger } from '@/utils/logging';

// Individual dialog states for stacked dialogs

export const AdvancedFileUpload = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreFileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const { toast } = useToast();
  
  // Processing state to prevent multiple file selections during processing
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  
  // Centralized preview state
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  
  // Staged files state - files waiting for duplicate resolution
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  
  // Individual dialog states for stacked dialogs
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateFiles, setDuplicateFiles] = useState<{ id: string; name: string; size: number; type: string; existingFile: File; newFile: File }[]>([]);
  const [unsupportedDialogOpen, setUnsupportedDialogOpen] = useState(false);
  const [unsupportedFiles, setUnsupportedFiles] = useState<{ id: string; name: string; size: number; type: 'image' | 'video' | 'audio' | 'gif' | 'unknown'; file: File }[]>([]);
  const [heicWarningOpen, setHeicWarningOpen] = useState(false);
  const [heicFiles, setHeicFiles] = useState<string[]>([]);
  
  // Unified duplicate dialog state  
  const [unifiedDuplicateDialogOpen, setUnifiedDuplicateDialogOpen] = useState(false);
  const [allDuplicates, setAllDuplicates] = useState<DuplicateMatch[]>([]);
  const [duplicateCheckLoading, setDuplicateCheckLoading] = useState(false);
  const [isPurgingDuplicates, setIsPurgingDuplicates] = useState(false);
  const [pendingDialogFiles, setPendingDialogFiles] = useState<File[]>([]);
  
  const { checkAllDuplicates, checkDatabaseDuplicates, checkQueueDuplicates, addDuplicateTag } = useBatchDuplicateDetection();
  
  // Dialog callbacks for legacy stacked dialog system
  const showDuplicateDialog = useCallback((duplicates: { id: string; name: string; size: number; type: string; existingFile: File; newFile: File }[]) => {
    setDuplicateFiles(duplicates);
    setDuplicateDialogOpen(true);
  }, []);
  
  const showUnsupportedDialog = useCallback((unsupported: { id: string; name: string; size: number; type: 'image' | 'video' | 'audio' | 'gif' | 'unknown'; file: File }[]) => {
    setUnsupportedFiles(unsupported);
    setUnsupportedDialogOpen(true);
  }, []);
  
  const showHeicWarning = useCallback((fileNames: string[]) => {
    setHeicFiles(fileNames);
    setHeicWarningOpen(true);
  }, []);
  
  const {
    uploadQueue,
    isUploading,
    currentUploadIndex,
    addFiles,
    validateFilesOnly,
    startUpload,
    removeFile,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    clearQueue,
    pauseAllUploads,
    resumeAllUploads,
    cancelAllUploads,
    updateFileMetadata,
    toggleFileSelection,
    selectAllFiles,
    clearSelection,
    updateSelectedFilesMetadata,
    selectedFiles,
    hasSelection,
    allSelected
  } = useFileUpload();

// Stable files array using useMemo to prevent React reconciliation issues
const filesArray = useMemo(() => 
  uploadQueue.map(item => ({ id: item.id, file: item.file })), 
  [uploadQueue]
);

// External version string to trigger re-syncs when metadata changes
const metadataVersion = useMemo(() => {
  return uploadQueue
    .map(item => [
      item.id,
      item.metadata?.description || '',
      (item.metadata?.tags || []).join(','),
      (item.metadata?.mentions || []).join(','),
      (item.metadata?.folders || []).join(','),
      item.metadata?.suggestedPrice ?? ''
    ].join('|'))
    .join('||');
}, [uploadQueue]);

  // Check if file is HEIC/HEIF
  const isHeicFile = useCallback((file: File): boolean => {
    return /\.(heic|heif)$/i.test(file.name) || 
           file.type === 'image/heic' || 
           file.type === 'image/heif';
  }, []);

  // Process files and handle validation using staged files approach
  const processFiles = useCallback(async (files: File[]) => {
    if (isProcessingFiles || isCheckingDuplicates) return;
    
    setIsProcessingFiles(true);
    setIsCheckingDuplicates(true);
    
    try {
      console.log(`Processing ${files.length} new files`);
      
      // Filter supported files first
      const supportedFiles = files.filter(file => {
        try {
          const extension = '.' + file.name.split('.').pop()?.toLowerCase();
          const allowedVideoExts = ['.mp4', '.mov', '.webm', '.mkv'];
          const allowedImageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif'];
          const allowedAudioExts = ['.mp3', '.wav', '.aac', '.ogg', '.opus'];
          return allowedVideoExts.includes(extension) || allowedImageExts.includes(extension) || allowedAudioExts.includes(extension);
        } catch {
          return false;
        }
      });

      // Stage the files (don't add to queue yet)
      setStagedFiles(supportedFiles);
      
      // Build staged items for duplicate detection only
      const stagedItems = supportedFiles.map((file, index) => ({
        file,
        id: `staged-${Date.now()}-${index}`,
        progress: 0,
        status: 'pending' as const,
        uploadedBytes: 0,
        totalBytes: file.size,
        selected: false,
        needsConversion: false,
        metadata: {
          mentions: [],
          tags: [],
          folders: [],
          description: '',
          suggestedPrice: null,
        },
      }));

      console.log(`Staged ${stagedItems.length} files for duplicate detection`);

      // Check for database duplicates FIRST
      const databaseDuplicates = await checkDatabaseDuplicates(stagedItems, (current, total) => {
        logger.debug(`DB duplicate check progress: ${current}/${total}`);
      });
      
      // Then check for queue duplicates: staged items vs existing queue
      const queueDuplicates: QueueDuplicate[] = [];
      for (const stagedItem of stagedItems) {
        for (const existingItem of uploadQueue.filter(q => ['pending', 'error', 'cancelled', 'completed', 'uploading', 'paused'].includes(q.status))) {
          if (stagedItem.file.name === existingItem.file.name && 
              stagedItem.file.size === existingItem.file.size) {
            queueDuplicates.push({
              queueFile: stagedItem, // The new file being added
              duplicateFile: existingItem, // The existing queue item
              sourceType: 'queue'
            });
            break; // Only need one match per staged file
          }
        }
      }
      
      logger.group('🔎 Duplicate detection summary', () => {
        logger.debug('Queue duplicates', queueDuplicates.map(d => ({
          newName: d.queueFile.file.name,
          newSize: d.queueFile.file.size,
          existingQueueId: d.duplicateFile.id,
          existingName: d.duplicateFile.file.name,
        })));
        logger.debug('DB duplicates', databaseDuplicates.map(d => ({
          newName: d.queueFile.file.name,
          newSize: d.queueFile.file.size,
          existingId: d.existingFile.id,
          existingName: d.existingFile.original_filename,
          existingSize: d.existingFile.original_size_bytes,
        })));
      });
      
      // Merge duplicates without collapsing types — show both DB and Queue duplicates for the same file
      const mergedDuplicates: DuplicateMatch[] = [
        ...databaseDuplicates,
        ...queueDuplicates,
      ];

      logger.debug('Total duplicates', { db: databaseDuplicates.length, queue: queueDuplicates.length, combined: mergedDuplicates.length });

      // Clear loading state
      setIsCheckingDuplicates(false);
      setIsProcessingFiles(false);
      
      // Show duplicate dialog if duplicates found, otherwise continue with validation
      if (mergedDuplicates.length > 0) {
        setAllDuplicates(mergedDuplicates);
        setUnifiedDuplicateDialogOpen(true);
      } else {
        // No duplicates - proceed with adding files and checking for other issues
        const validationResults = validateFilesOnly(supportedFiles);
        
        // Add files to queue since no duplicates
        addFiles(supportedFiles, showDuplicateDialog, showUnsupportedDialog, true);
        
        // Show remaining validation issues
        if (validationResults?.unsupportedFiles?.length > 0) {
          showUnsupportedDialog(validationResults.unsupportedFiles);
        } else {
          // Check for HEIC files as final step
          const heicFileNames = supportedFiles.filter(isHeicFile).map(f => f.name);
          if (heicFileNames.length > 0) {
            showHeicWarning(heicFileNames);
          }
        }
        
        // Clear staged files
        setStagedFiles([]);
      }
      
    } catch (error) {
      console.error('Error during file processing:', error);
      setIsCheckingDuplicates(false);
      setIsProcessingFiles(false);
      setStagedFiles([]);
      toast({
        title: "Error",
        description: "Failed to process files. Please try again.",
        variant: "destructive"
      });
    }
  }, [isProcessingFiles, isCheckingDuplicates, uploadQueue, checkDatabaseDuplicates, validateFilesOnly, addFiles, showDuplicateDialog, showUnsupportedDialog, showHeicWarning, isHeicFile, toast]);

  // Dialog handlers for legacy stacked dialogs  
  const handleDuplicateConfirm = useCallback((filesToIgnore: string[]) => {
    // Add files that weren't ignored from duplicates
    const validFiles = duplicateFiles
      .filter(item => !filesToIgnore.includes(item.name))
      .map(item => item.newFile);
    
    if (validFiles.length > 0) {
      addFiles(validFiles);
    }
    setDuplicateDialogOpen(false);
  }, [duplicateFiles, addFiles]);

  const handleUnsupportedConfirm = useCallback(() => {
    setUnsupportedDialogOpen(false);
  }, []);

  // Modified file handlers to use queue system
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    processFiles(Array.from(files));
    event.target.value = '';
  }, [processFiles]);

  const handleAddMoreFiles = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    processFiles(Array.from(files));
    event.target.value = '';
  }, [processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files) {
      processFiles(Array.from(files));
    }
  }, [processFiles]);

  // Centralized preview functions with validation
  const openPreview = useCallback((index: number) => {
    if (index >= 0 && index < uploadQueue.length) {
      setPreviewIndex(index);
      setPreviewOpen(true);
    }
  }, [uploadQueue.length]);

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    setPreviewIndex(null);
  }, []);

  const handlePrevious = useCallback(() => {
    setPreviewIndex(prev => {
      if (prev !== null && prev > 0) {
        return prev - 1;
      }
      return prev;
    });
  }, []);

  const handleNext = useCallback(() => {
    setPreviewIndex(prev => {
      if (prev !== null && prev < uploadQueue.length - 1) {
        return prev + 1;
      }
      return prev;
    });
  }, [uploadQueue.length]);

  // Close preview if the currently viewed file is uploaded/removed
  useEffect(() => {
    if (previewIndex !== null) {
      const currentFile = uploadQueue[previewIndex];
      
      // Close preview if file is completed or no longer exists
      if (!currentFile || currentFile.status === 'completed') {
        setPreviewOpen(false);
        setPreviewIndex(null);
      }
      
      // Adjust preview index if queue length changed
      else if (previewIndex >= uploadQueue.length) {
        const newIndex = Math.max(0, uploadQueue.length - 1);
        if (uploadQueue.length > 0) {
          setPreviewIndex(newIndex);
        } else {
          setPreviewOpen(false);
          setPreviewIndex(null);
        }
      }
    }
  }, [uploadQueue, previewIndex]);

  // Handle page navigation/reload - cancel uploads but preserve completed ones
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasUploading = uploadQueue.some(item => 
        item.status === 'uploading' || item.status === 'processing'
      );
      
      if (hasUploading) {
        e.preventDefault();
        e.returnValue = 'Uploads in progress will be cancelled. Are you sure?';
        return 'Uploads in progress will be cancelled. Are you sure?';
      }
    };

    const handleUnload = () => {
      // Cancel any ongoing uploads
      cancelAllUploads();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, [uploadQueue, cancelAllUploads]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!previewOpen) return;
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closePreview();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [previewOpen, handlePrevious, handleNext, closePreview]);

  // Handle metadata updates for previewed file
  const handlePreviewMetadataUpdate = useCallback((field: string, value: any) => {
    if (previewIndex !== null) {
      const currentItem = uploadQueue[previewIndex];
      if (currentItem) {
        const currentMetadata = currentItem.metadata || {
          mentions: [],
          tags: [],
          folders: [],
          description: '',
          suggestedPrice: null,
        };
        updateFileMetadata(currentItem.id, { ...currentMetadata, [field]: value });
      }
    }
  }, [previewIndex, uploadQueue, updateFileMetadata]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'uploading':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-orange-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  // Handle start upload - duplicates already checked during file processing
  const handleStartUpload = () => {
    if (uploadQueue.length === 0) {
      toast({
        title: "No files to upload",
        description: "Please add files to the queue before starting upload.",
        variant: "default",
      });
      return;
    }
    
    const pendingFiles = uploadQueue.filter(item => item.status === 'pending');
    if (pendingFiles.length === 0) {
      toast({
        title: "No pending files",
        description: "All files have already been uploaded or processed.",
        variant: "default",
      });
      return;
    }
    
    startUpload(true); // Skip duplicate check since we already did it during file processing
  };

  // Handle purging selected duplicates from staged files
  const handlePurgeSelected = (duplicateIds: string[]) => {
    console.log('Purging selected duplicates:', duplicateIds);
    
    // Filter staged files to remove ones being purged
    const duplicateFileIds = new Set(duplicateIds);
    const duplicateFileMap = new Map<string, File>();
    
    // Map duplicate IDs to their actual files
    allDuplicates.forEach(duplicate => {
      duplicateFileMap.set(duplicate.queueFile.id, duplicate.queueFile.file);
    });
    
    // Keep files that are NOT in the duplicateIds
    const keptFiles = stagedFiles.filter(file => {
      // Find the corresponding duplicate for this file
      const matchingDuplicate = allDuplicates.find(d => 
        d.queueFile.file.name === file.name && d.queueFile.file.size === file.size
      );
      
      return !matchingDuplicate || !duplicateFileIds.has(matchingDuplicate.queueFile.id);
    });
    
    console.log(`Keeping ${keptFiles.length} out of ${stagedFiles.length} staged files after purging ${duplicateIds.length} duplicates`);
    
    // Always re-scan kept files for BOTH library and queue duplicates before proceeding
    if (keptFiles.length > 0) {
      (async () => {
        // Rebuild staged items for detection
        const keptStagedItems = keptFiles.map((file, index) => ({
          file,
          id: `kept-staged-${Date.now()}-${index}`,
          progress: 0,
          status: 'pending' as const,
          uploadedBytes: 0,
          totalBytes: file.size,
          selected: false,
          needsConversion: false,
          metadata: {
            mentions: [],
            tags: [],
            folders: [],
            description: '',
            suggestedPrice: null,
          },
        }));

        // Queue duplicates: kept staged vs existing queue
        const recheckQueueDuplicates: QueueDuplicate[] = [];
        for (const stagedItem of keptStagedItems) {
          for (const existingItem of uploadQueue.filter(q => ['pending', 'error', 'cancelled', 'completed', 'uploading', 'paused'].includes(q.status))) {
            if (stagedItem.file.name === existingItem.file.name && 
                stagedItem.file.size === existingItem.file.size) {
              recheckQueueDuplicates.push({
                queueFile: stagedItem,
                duplicateFile: existingItem,
                sourceType: 'queue'
              });
              break;
            }
          }
        }

        // Database duplicates: force check every time
        const recheckDbDuplicates = await checkDatabaseDuplicates(keptStagedItems, (current, total) => {
          logger.debug(`DB recheck progress (post-purge): ${current}/${total}`);
        });

        if (recheckDbDuplicates.length > 0 || recheckQueueDuplicates.length > 0) {
          setAllDuplicates([
            ...recheckDbDuplicates,
            ...recheckQueueDuplicates,
          ]);
          // Reopen dialog to handle remaining duplicates
          setUnifiedDuplicateDialogOpen(true);
          return;
        }

        // No remaining duplicates; close dialog and continue
        setUnifiedDuplicateDialogOpen(false);
        setAllDuplicates([]);

        showNextDialogInSequence(keptFiles, { skipDuplicateDialog: true });
        setStagedFiles([]);
      })();
      return;
    }

    // No kept files; just close dialog
    setUnifiedDuplicateDialogOpen(false);
    setAllDuplicates([]);
    setStagedFiles([]);
  };

  // Handle keeping both versions with duplicate tag
  const handleKeepBoth = () => {
    console.log('Keeping both versions of duplicates');
    
    // Add all staged files to queue
    addFiles(stagedFiles, showDuplicateDialog, showUnsupportedDialog, true);
    
    // Wait for files to be added, then add duplicate tags
    setTimeout(() => {
      allDuplicates.forEach((duplicate, index) => {
        // Find the actual queue item by name and size
        const queueItem = uploadQueue.find(item => 
          item.file.name === duplicate.queueFile.file.name && 
          item.file.size === duplicate.queueFile.file.size
        );
        
        if (queueItem) {
          const currentMetadata = queueItem.metadata || {
            mentions: [],
            tags: [],
            folders: [],
            description: '',
            suggestedPrice: null,
          };
          const updatedTags = addDuplicateTag(currentMetadata.tags, index + 1);
          updateFileMetadata(queueItem.id, { ...currentMetadata, tags: updatedTags });
        }
      });
    }, 100);
    
    setUnifiedDuplicateDialogOpen(false);
    setAllDuplicates([]);
    
    // Continue with validation dialogs
    showNextDialogInSequence(stagedFiles, { skipDuplicateDialog: true });
    
    setStagedFiles([]);
    
    // Start upload
    setTimeout(() => startUpload(true), 200);
  };

  // Handle canceling upload
  const handleCancelUpload = () => {
    console.log('Canceling upload, clearing staged files');
    setUnifiedDuplicateDialogOpen(false);
    setAllDuplicates([]);
    setStagedFiles([]);
  };

  // Show next dialog in the sequence after duplicates are resolved
  const showNextDialogInSequence = useCallback((files: File[], options: { skipDuplicateDialog?: boolean } = {}) => {
    console.log(`Showing next dialog for ${files.length} files, skipDuplicateDialog: ${options.skipDuplicateDialog}`);
    
    // Add files to queue first if not already added
    if (files.length > 0) {
      addFiles(files, showDuplicateDialog, showUnsupportedDialog, true);
    }
    
    // Use validation-only function to prevent re-adding files to queue
    const validationResults = validateFilesOnly(files);
    
    if (!options.skipDuplicateDialog && validationResults?.duplicateFiles?.length > 0) {
      showDuplicateDialog(validationResults.duplicateFiles);
    } else if (validationResults?.unsupportedFiles?.length > 0) {
      showUnsupportedDialog(validationResults.unsupportedFiles);
    } else {
      // Check for HEIC files as final step
      const heicFileNames = files.filter(isHeicFile).map(f => f.name);
      if (heicFileNames.length > 0) {
        showHeicWarning(heicFileNames);
      }
    }
  }, [validateFilesOnly, addFiles, showDuplicateDialog, showUnsupportedDialog, showHeicWarning, isHeicFile]);

  // Effect to handle post-purge actions when upload queue updates
  useEffect(() => {
    if (isPurgingDuplicates && pendingDialogFiles.length > 0) {
      // Queue has been updated, now we can safely proceed
      setIsPurgingDuplicates(false);
      
      // Show next dialog in sequence
      showNextDialogInSequence(pendingDialogFiles);
      setPendingDialogFiles([]);
      
      // Start upload with remaining files
      setTimeout(() => startUpload(true), 100);
    }
  }, [uploadQueue, isPurgingDuplicates, pendingDialogFiles, showNextDialogInSequence, startUpload]);

  // Effect to capture viewport element when ScrollArea mounts
  useLayoutEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      viewportRef.current = viewport as HTMLElement;
    }
  }, [uploadQueue.length]);

  // Wrapper for removeFile that preserves scroll position
  const handleRemoveFile = useCallback((fileId: string) => {
    // Capture current scroll position from cached viewport element
    const viewport = viewportRef.current;
    const scrollTop = viewport?.scrollTop || 0;
    const scrollHeight = viewport?.scrollHeight || 0;
    
    // Remove the file
    removeFile(fileId);
    
    // Use multiple restoration attempts with different timing
    const restoreScrollPosition = (attempts = 0) => {
      if (attempts > 3) return; // Max 3 attempts
      
      setTimeout(() => {
        const currentViewport = viewportRef.current;
        if (currentViewport && currentViewport.scrollHeight > 0) {
          // Adjust scroll position if list became shorter
          const maxScroll = Math.max(0, currentViewport.scrollHeight - currentViewport.clientHeight);
          const targetScroll = Math.min(scrollTop, maxScroll);
          currentViewport.scrollTop = targetScroll;
        } else {
          // Retry if viewport not ready
          restoreScrollPosition(attempts + 1);
        }
      }, attempts === 0 ? 0 : 16 * (attempts + 1)); // 0ms, 32ms, 48ms, 64ms
    };
    
    restoreScrollPosition();
  }, [removeFile]);

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'uploading': return 'Uploading';
      case 'completed': return 'Completed';
      case 'error': return 'Error';
      case 'paused': return 'Paused';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  return (
    <Card className="w-full h-[calc(100vh-140px)] relative">
      <CardContent className="p-6 h-full flex flex-col">
        {/* Top Controls Row */}
        {uploadQueue.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Badge variant="secondary">
                {uploadQueue.filter(i => i.status === 'completed').length}/{uploadQueue.length} complete
              </Badge>
              {uploadQueue.filter(i => i.status === 'error').length > 0 && (
                <Badge variant="destructive">
                  {uploadQueue.filter(i => i.status === 'error').length} errors
                </Badge>
              )}
              
               {/* Select All Controls - hide during upload */}
              {!isUploading && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={allSelected ? clearSelection : selectAllFiles}
                  className="flex items-center gap-2 h-8"
                >
                  {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  {allSelected ? 'Deselect All' : 'Select All'}
                </Button>
              )}
              
              <span className="text-sm text-muted-foreground">
                {selectedFiles.length > 0 ? (
                  <span className="font-medium text-foreground">
                    {selectedFiles.length} of {uploadQueue.length} selected
                  </span>
                ) : (
                  `${uploadQueue.length} file${uploadQueue.length !== 1 ? 's' : ''}`
                )}
              </span>
              
              {selectedFiles.length > 0 && !isUploading && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="text-muted-foreground hover:text-foreground h-8"
                >
                  Clear Selection
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isUploading ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={pauseAllUploads}
                  >
                    <Pause className="w-4 h-4 mr-2" />
                    Pause All
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={cancelAllUploads}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel All
                  </Button>
                </>
              ) : uploadQueue.some(item => item.status === 'paused') ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resumeAllUploads}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Resume All
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={cancelAllUploads}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel All
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearQueue}
                    disabled={uploadQueue.filter(i => i.status === 'completed').length === 0}
                  >
                    Clear Completed
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleStartUpload}
                    disabled={uploadQueue.filter(i => i.status === 'pending' || i.status === 'error').length === 0}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Upload
                  </Button>
                </>
              )}
            </div>
          </div>
        )}


        {/* Batch Metadata Toolbar - Only when files are selected */}
        {hasSelection && (
          <BatchMetadataToolbar
            selectedCount={selectedFiles.length}
            onClearSelection={clearSelection}
            onUpdateMetadata={updateSelectedFilesMetadata}
          />
        )}

        {/* Upload Status */}
        {isUploading && uploadQueue.length > 0 && (
          <div className="bg-muted/20 border border-border rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Uploading files...</span>
              <span className="text-sm text-muted-foreground">
                {Math.min(currentUploadIndex + 1, uploadQueue.length)} of {uploadQueue.length}
              </span>
            </div>
            <Progress 
              value={uploadQueue.length > 0 ? (Math.min(currentUploadIndex + 1, uploadQueue.length) / uploadQueue.length) * 100 : 0} 
              className="h-2"
            />
          </div>
        )}

        {/* Loading overlay for duplicate checking */}
        {isCheckingDuplicates && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-card border rounded-lg p-6 shadow-lg">
              <div className="flex items-center space-x-3">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium">Checking for duplicates...</span>
              </div>
            </div>
          </div>
        )}

        {/* Upload Area - Only show when no files selected */}
        {uploadQueue.length === 0 && (
          <div 
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors flex-1 flex flex-col justify-center",
              "border-muted-foreground/25 hover:border-muted-foreground/50",
              "bg-muted/10 hover:bg-muted/20"
            )}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Drag & drop files here, or click to browse</h3>
            <p className="text-muted-foreground mb-4">
              Supports images, videos, and audio files
            </p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 h-10 w-auto min-w-0"
            >
              Select Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
          accept=".jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.mp4,.mov,.webm,.mkv,.mp3,.wav,.aac,.ogg,.opus"
            />
          </div>
        )}

        {/* Add More Files Button - Hide during upload */}
        {uploadQueue.length > 0 && uploadQueue.length < 100 && !isUploading && (
          <div className="flex justify-center mb-4">
            <Button
              variant="outline"
              onClick={() => addMoreFileInputRef.current?.click()}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add More Files
            </Button>
          </div>
        )}

        {/* Upload Queue - Takes remaining height */}
        {uploadQueue.length > 0 && (
          <div className="flex-1 flex flex-col min-h-0">
            <ScrollArea ref={scrollAreaRef} className="flex-1">
              <div className="space-y-2">
                {uploadQueue.map((item, index) => (
                  <EnhancedFileUploadRow
                    key={item.id}
                    item={item}
                    index={index}
                    currentUploadIndex={currentUploadIndex}
                    isUploading={isUploading}
                    onRemove={handleRemoveFile}
                    onPause={pauseUpload}
                    onResume={resumeUpload}
                    onCancel={cancelUpload}
                    onMetadataChange={updateFileMetadata}
                    onToggleSelection={toggleFileSelection}
                    getStatusIcon={getStatusIcon}
                    formatFileSize={formatFileSize}
                    onPreview={() => openPreview(index)}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Hidden inputs for file selection */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept=".jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.mp4,.mov,.webm,.mkv,.mp3,.wav,.aac,.ogg,.opus"
        />
        <input
          ref={addMoreFileInputRef}
          type="file"
          multiple
          onChange={handleAddMoreFiles}
          className="hidden"
          accept=".jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.mp4,.mov,.webm,.mkv,.mp3,.wav,.aac,.ogg,.opus"
        />

      </CardContent>

      <FilePreviewDialog
        file={previewIndex !== null ? uploadQueue[previewIndex]?.file : null}
        open={previewOpen}
        onOpenChange={closePreview}
        // Navigation props 
        files={filesArray}
        totalFiles={uploadQueue.length}
        currentIndex={previewIndex ?? undefined}
        onNavigate={(idx) => setPreviewIndex(idx)}
        metadataVersion={metadataVersion}
        getMetadataByIndex={(index) => {
          const item = uploadQueue[index];
          if (!item) return null;
          return {
            mentions: item.metadata?.mentions || [],
            tags: item.metadata?.tags || [],
            folders: item.metadata?.folders || [],
            description: item.metadata?.description || '',
            suggestedPrice: item.metadata?.suggestedPrice || null,
          };
        }}
        updateMetadataByIndex={(index, changes) => {
          const item = uploadQueue[index];
          if (!item) return;
          const currentMetadata = item.metadata || {
            mentions: [],
            tags: [],
            folders: [],
            description: '',
            suggestedPrice: null,
          };
          updateFileMetadata(item.id, { ...currentMetadata, ...changes });
        }}
        selecting={true}
        selectedFiles={new Set(uploadQueue.filter(item => item.selected).map(item => item.id))}
        onToggleSelection={toggleFileSelection}
        fileId={previewIndex !== null ? uploadQueue[previewIndex]?.id : undefined}
      />

      {/* Individual Stacked Dialogs */}
      <UnsupportedFilesDialog
        open={unsupportedDialogOpen}
        onOpenChange={setUnsupportedDialogOpen}
        unsupportedFiles={unsupportedFiles}
        onConfirm={handleUnsupportedConfirm}
      />
      
      <HEICWarningDialog
        open={heicWarningOpen}
        onOpenChange={setHeicWarningOpen}
        fileNames={heicFiles}
      />
      
      {/* Unified duplicate dialog */}
      <UnifiedDuplicateDialog
        open={unifiedDuplicateDialogOpen}
        onOpenChange={setUnifiedDuplicateDialogOpen}
        duplicates={allDuplicates}
        onPurgeSelected={handlePurgeSelected}
        onKeepBoth={handleKeepBoth}
        onCancel={handleCancelUpload}
      />


    </Card>
  );
};
