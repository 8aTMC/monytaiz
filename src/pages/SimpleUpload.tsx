import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSimpleUpload } from '@/hooks/useSimpleUpload';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, Zap, TrendingDown, Clock, Trash2, Plus, CheckSquare, Square } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FileUploadRowWithMetadata, UploadedFileWithMetadata } from '@/components/FileUploadRowWithMetadata';
import { DetailedUploadProgressBar } from '@/components/DetailedUploadProgressBar';
import { VideoValidationError } from '@/components/VideoValidationError';
import { VirtualizedFileList } from '@/components/VirtualizedFileList';

import { BatchMetadataToolbar } from '@/components/BatchMetadataToolbar';
import { DuplicateFilesDialog } from '@/components/DuplicateFilesDialog';
import { UnsupportedFilesDialog } from '@/components/UnsupportedFilesDialog';
import { CorruptedFilesDialog } from '@/components/CorruptedFilesDialog';
import { StorageQuotaProgressBar, STORAGE_LIMIT_BYTES } from '@/components/StorageQuotaProgressBar';
import { ExceedsLimitDialog, FileWithStatus } from '@/components/ExceedsLimitDialog';
import { PreUploadDuplicateDialog } from '@/components/PreUploadDuplicateDialog';
import { useToast } from '@/hooks/use-toast';
import { SelectedFilesProvider } from '@/contexts/SelectedFilesContext';
import { useBatchDuplicateDetection, DuplicateMatch } from '@/hooks/useBatchDuplicateDetection';
import { logger } from '@/utils/logging';

export default function SimpleUpload() {
  const navigate = useNavigate();
  const { 
    uploading, 
    uploadFile, 
    uploadProgress, 
    uploadMultipleWithControls,
    fileStates,
    isPaused,
    pauseAllUploads,
    resumeAllUploads,
    cancelAllUploads,
    cancelFileUpload,
    pauseFileUpload,
    resumeFileUpload
  } = useSimpleUpload();
  const { checkAllDuplicates } = useBatchDuplicateDetection();
  const { toast } = useToast();
  const [files, setFiles] = useState<(UploadedFileWithMetadata & { 
    compressionRatio?: number; 
    processedSize?: number; 
    qualityInfo?: any;
    uploadProgress?: number;
    uploadMessage?: string;
    uploadPhase?: string;
  })[]>([]);
  const [currentUploadProgress, setCurrentUploadProgress] = useState(0);
  const [currentUploadingFile, setCurrentUploadingFile] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateFiles, setDuplicateFiles] = useState<{ id: string; name: string; size: number; type: string; existingFile: File; newFile: File }[]>([]);
  const [databaseDuplicateDialogOpen, setDatabaseDuplicateDialogOpen] = useState(false);
  const [databaseDuplicates, setDatabaseDuplicates] = useState<DuplicateMatch[]>([]);
  const [exceedsLimitDialogOpen, setExceedsLimitDialogOpen] = useState(false);
  const [filesAnalysis, setFilesAnalysis] = useState<FileWithStatus[]>([]);
  const [unsupportedDialogOpen, setUnsupportedDialogOpen] = useState(false);
  const [unsupportedFiles, setUnsupportedFiles] = useState<{ id: string; name: string; size: number; type: 'image' | 'video' | 'audio' | 'gif' | 'unknown'; file: File }[]>([]);
  const [corruptedDialogOpen, setCorruptedDialogOpen] = useState(false);
  const [corruptedFiles, setCorruptedFiles] = useState<{ id: string; name: string; size: number; file: File; error: string; errorType?: 'corruption' | 'format' | 'timeout' | 'metadata' }[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [duplicateProgress, setDuplicateProgress] = useState({ current: 0, total: 1, step: '' });
  const [selectionMode, setSelectionMode] = useState(false);
  const addMoreFileInputRef = useRef<HTMLInputElement>(null);
  
  // Selection state management
  const selectedFiles = files.filter(f => f.selected);
  const hasSelection = selectedFiles.length > 0;
  const allSelected = files.length > 0 && selectedFiles.length === files.length;

  // Calculate total file size for storage quota
  const totalFilesSize = files.reduce((acc, file) => acc + file.file.size, 0);

  // Track anchor for range selection
  const anchorIndexRef = useRef<number | null>(null);

  // Selection functions
  const toggleFileSelection = useCallback((fileId: string, selected: boolean, options?: { range?: boolean; index?: number }) => {
    logger.debug(`[UploadAction] ToggleSelection`, { fileId, selected, range: !!options?.range, index: options?.index });
    setFiles(prev => {
      if (options?.range && anchorIndexRef.current !== null && options.index !== undefined) {
        const startIndex = Math.min(anchorIndexRef.current, options.index);
        const endIndex = Math.max(anchorIndexRef.current, options.index);
        const updatedFiles = prev.map((file, idx) => (idx >= startIndex && idx <= endIndex) ? { ...file, selected: true } : file);
        anchorIndexRef.current = options.index;
        return updatedFiles;
      } else {
        const fileIndex = options?.index ?? prev.findIndex(f => f.id === fileId);
        if (fileIndex !== -1) anchorIndexRef.current = fileIndex;
        return prev.map(f => f.id === fileId ? { ...f, selected } : f);
      }
    });
  }, []);

  const selectAllFiles = useCallback(() => {
    logger.debug(`[UploadAction] SelectAll clicked`, { total: files.length });
    setSelectionMode(true);
    setFiles(prev => prev.map(f => ({ ...f, selected: true })));
  }, [files.length]);

  const clearSelection = useCallback(() => {
    logger.debug(`[UploadAction] ClearSelection clicked`);
    setFiles(prev => prev.map(f => ({ ...f, selected: false })));
    // Exit selection mode when all files are deselected
    setSelectionMode(false);
  }, []);

  const updateSelectedFilesMetadata = useCallback((metadata: Partial<UploadedFileWithMetadata['metadata']>) => {
    setFiles(prev => prev.map(f => {
      if (!f.selected) return f;
      
      // Merge metadata for selected files - combine arrays for mentions, tags, folders
      const updatedMetadata = { ...f.metadata };
      
      if (metadata.mentions) {
        const existingMentions = new Set(f.metadata.mentions);
        metadata.mentions.forEach(mention => existingMentions.add(mention));
        updatedMetadata.mentions = Array.from(existingMentions);
      }
      
      if (metadata.tags) {
        const existingTags = new Set(f.metadata.tags);
        metadata.tags.forEach(tag => existingTags.add(tag));
        updatedMetadata.tags = Array.from(existingTags);
      }
      
      if (metadata.folders) {
        const existingFolders = new Set(f.metadata.folders);
        metadata.folders.forEach(folder => existingFolders.add(folder));
        updatedMetadata.folders = Array.from(existingFolders);
      }
      
      return { ...f, metadata: updatedMetadata };
    }));
    
    toast({
      title: "Batch changes applied",
      description: `Metadata updated for ${selectedFiles.length} files (selection preserved)`,
      variant: "default",
    });
  }, [selectedFiles.length, toast]);

  const reorderFiles = useCallback((dragIndex: number, hoverIndex: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      const draggedFile = newFiles[dragIndex];
      
      // Remove the dragged file and insert it at the new position
      newFiles.splice(dragIndex, 1);
      newFiles.splice(hoverIndex, 0, draggedFile);
      
      return newFiles;
    });
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    logger.debug(`[UploadDebug] onDrop received`, { count: acceptedFiles.length });
    
    // Separate supported and unsupported files
    const supportedFiles: File[] = [];
    const unsupportedFiles: { id: string; name: string; size: number; type: 'image' | 'video' | 'audio' | 'gif' | 'unknown'; file: File }[] = [];
    
    acceptedFiles.forEach((file, index) => {
      // debug: processing each file
      // logger.debug(`[UploadDebug] Processing file`, { name: file.name, type: file.type });
      
      // Check file extension
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      const supportedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.mp4', '.mov', '.webm', '.mkv', '.mp3', '.wav', '.aac', '.ogg', '.opus'];
      
      // logger.debug(`[UploadDebug] Extension`, { extension, supported: supportedExtensions.includes(extension) });
      
      if (supportedExtensions.includes(extension)) {
        supportedFiles.push(file);
      } else {
        // Determine file type for conversion suggestions
        let fileType: 'image' | 'video' | 'audio' | 'gif' | 'unknown' = 'unknown';
        if (extension === '.gif') {
          fileType = 'gif';
        } else if (file.type.startsWith('image/') || ['.avif', '.tiff', '.tif', '.bmp', '.svg', '.ico'].includes(extension)) {
          fileType = 'image';
        } else if (file.type.startsWith('video/') || ['.avi', '.wmv', '.flv', '.3gp', '.m4v'].includes(extension)) {
          fileType = 'video';
        } else if (file.type.startsWith('audio/') || ['.flac', '.wma', '.m4a', '.amr'].includes(extension)) {
          fileType = 'audio';
        }
        
        logger.info(`[UploadAction] Unsupported file detected`, { name: file.name, fileType });
        
        unsupportedFiles.push({
          id: `unsupported-${Date.now()}-${index}`,
          name: file.name,
          size: file.size,
          type: fileType,
          file: file
        });
      }
    });

    // logger.debug(`[UploadDebug] Supported vs Unsupported`, { supported: supportedFiles.length, unsupported: unsupportedFiles.length });

    // Show unsupported files dialog if any
    if (unsupportedFiles.length > 0) {
      logger.info(`[UploadAction] Unsupported files dialog opened`, { count: unsupportedFiles.length });
      setUnsupportedFiles(unsupportedFiles);
      setUnsupportedDialogOpen(true);
    }

    // Show corrupted files dialog if any
    if (corruptedFiles.length > 0) {
      logger.info(`[UploadAction] Corrupted files dialog opened`, { count: corruptedFiles.length });
      setCorruptedFiles(corruptedFiles);
      setCorruptedDialogOpen(true);
    }

    // Add supported files and check for database duplicates
    if (supportedFiles.length > 0) {
      const newFiles = supportedFiles.map(file => ({
        file,
        id: crypto.randomUUID(),
        status: 'pending' as const,
        metadata: {
          mentions: [],
          tags: [],
          folders: [],
          description: '',
          suggestedPrice: null,
        }
      }));

      // Check for database duplicates
      const uploadQueue = newFiles.map(f => ({
        id: f.id,
        file: f.file,
        status: f.status,
        progress: 0,
        metadata: f.metadata
      }));

      try {
        setIsCheckingDuplicates(true);
        setDuplicateProgress({ current: 0, total: 1, step: 'Initializing...' });
        
        const duplicates = await checkAllDuplicates(uploadQueue, (current, total, step) => {
          setDuplicateProgress({ current, total, step });
        });
        
        if (duplicates.length > 0) {
          logger.info(`[UploadAction] Database duplicates found`, { count: duplicates.length });
          setDatabaseDuplicates(duplicates);
          setDatabaseDuplicateDialogOpen(true);
          // Store files for later processing
          setFiles(prev => [...prev, ...newFiles]);
        } else {
          setFiles(prev => [...prev, ...newFiles]);
          setReviewMode(true);
        }
      } catch (error) {
        logger.error('[UploadError] Database duplicate check failed', error);
        // Continue with upload if duplicate check fails
        setFiles(prev => [...prev, ...newFiles]);
        setReviewMode(true);
      } finally {
        setIsCheckingDuplicates(false);
      }
    }
  }, []);

  const addMoreFiles = useCallback(async (acceptedFiles: File[]) => {
    logger.info(`[UploadAction] AddMoreFiles invoked`, { count: acceptedFiles.length });
    
    // Separate supported and unsupported files first
    const supportedFiles: File[] = [];
    const unsupportedFiles: { id: string; name: string; size: number; type: 'image' | 'video' | 'audio' | 'gif' | 'unknown'; file: File }[] = [];
    
    acceptedFiles.forEach((file, index) => {
      // logger.debug(`[UploadDebug] Processing file (addMore)`, { name: file.name, type: file.type });
      
      // Check file extension
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      const supportedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.mp4', '.mov', '.webm', '.mkv', '.mp3', '.wav', '.aac', '.ogg', '.opus'];
      
      // logger.debug(`[UploadDebug] Extension (addMore)`, { extension, supported: supportedExtensions.includes(extension) });
      
      if (supportedExtensions.includes(extension)) {
        supportedFiles.push(file);
      } else {
        // Determine file type for conversion suggestions
        let fileType: 'image' | 'video' | 'audio' | 'gif' | 'unknown' = 'unknown';
        if (extension === '.gif') {
          fileType = 'gif';
        } else if (file.type.startsWith('image/') || ['.avif', '.tiff', '.tif', '.bmp', '.svg', '.ico'].includes(extension)) {
          fileType = 'image';
        } else if (file.type.startsWith('video/') || ['.avi', '.wmv', '.flv', '.3gp', '.m4v'].includes(extension)) {
          fileType = 'video';
        } else if (file.type.startsWith('audio/') || ['.flac', '.wma', '.m4a', '.amr'].includes(extension)) {
          fileType = 'audio';
        }
        
        logger.info(`[UploadAction] Unsupported file detected (addMore)`, { name: file.name, fileType });
        
        unsupportedFiles.push({
          id: `unsupported-${Date.now()}-${index}`,
          name: file.name,
          size: file.size,
          type: fileType,
          file: file
        });
      }
    });

    // logger.debug(`[UploadDebug] Supported vs Unsupported (addMore)`, { supported: supportedFiles.length, unsupported: unsupportedFiles.length });

    // Show unsupported files dialog if any
    if (unsupportedFiles.length > 0) {
      logger.info(`[UploadAction] Unsupported files dialog opened (addMore)`, { count: unsupportedFiles.length });
      setUnsupportedFiles(unsupportedFiles);
      setUnsupportedDialogOpen(true);
    }

    // Show corrupted files dialog if any
    if (corruptedFiles.length > 0) {
      logger.info(`[UploadAction] Corrupted files dialog opened (addMore)`, { count: corruptedFiles.length });
      setCorruptedFiles(corruptedFiles);
      setCorruptedDialogOpen(true);
    }

    // Check for duplicates among supported files
    const queueDuplicates: { id: string; name: string; size: number; type: string; existingFile: File; newFile: File }[] = [];
    const uniqueFiles: File[] = [];

    supportedFiles.forEach(newFile => {
      const existingFileItem = files.find(fileItem => 
        fileItem.file.name === newFile.name && fileItem.file.size === newFile.size
      );

      if (existingFileItem) {
        queueDuplicates.push({
          id: `${newFile.name}-${newFile.size}-${newFile.lastModified}`,
          name: newFile.name,
          size: newFile.size,
          type: newFile.type,
          existingFile: existingFileItem.file,
          newFile: newFile
        });
      } else {
        uniqueFiles.push(newFile);
      }
    });

    // Always check for database duplicates for unique files, regardless of queue duplicates
    if (uniqueFiles.length > 0) {
      const newFiles = uniqueFiles.map(file => ({
        file,
        id: crypto.randomUUID(),
        status: 'pending' as const,
        metadata: {
          mentions: [],
          tags: [],
          folders: [],
          description: '',
          suggestedPrice: null,
        }
      }));

      // Prepare staged queue for DB duplicate detection
      const uploadQueue = newFiles.map(f => ({
        id: f.id,
        file: f.file,
        status: f.status,
        progress: 0,
        metadata: f.metadata
      }));

      try {
        setIsCheckingDuplicates(true);
        setDuplicateProgress({ current: 0, total: 1, step: 'Initializing...' });

        const duplicates = await checkAllDuplicates(uploadQueue, (current, total, step) => {
          setDuplicateProgress({ current, total, step });
        });

        if (duplicates.length > 0) {
          logger.info(`[UploadAction] Database duplicates found (addMore)`, { count: duplicates.length });
          setDatabaseDuplicates(duplicates);
          setDatabaseDuplicateDialogOpen(true);
          // Add staged files so the dialog actions can manage them
          setFiles(prev => [...prev, ...newFiles]);
        } else {
          setFiles(prev => [...prev, ...newFiles]);
          toast({
            title: "Files added",
            description: `${uniqueFiles.length} file${uniqueFiles.length === 1 ? '' : 's'} added to upload queue`,
          });
        }
      } catch (error) {
        logger.error('[UploadError] Database duplicate check failed (addMoreFiles)', error);
        // Continue with upload if duplicate check fails
        setFiles(prev => [...prev, ...newFiles]);
        toast({
          title: "Files added",
          description: `${uniqueFiles.length} file${uniqueFiles.length === 1 ? '' : 's'} added to upload queue`,
        });
      } finally {
        setIsCheckingDuplicates(false);
      }
    }

    // Show queue duplicates dialog if any duplicates found
    if (queueDuplicates.length > 0) {
      setDuplicateFiles(queueDuplicates);
      setDuplicateDialogOpen(true);
    }
  }, [files, toast]);

  const handleAddMoreFiles = useCallback(() => {
    logger.debug(`[UploadAction] AddMoreFiles button clicked`);
    addMoreFileInputRef.current?.click();
  }, []);

  const handleAddMoreFilesChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      addMoreFiles(Array.from(files));
      // Reset input value to allow selecting the same files again
      event.target.value = '';
    }
  }, [addMoreFiles]);

  const validateStorageLimit = useCallback(() => {
    if (totalFilesSize <= STORAGE_LIMIT_BYTES) {
      return { canProceed: true, analysis: [] };
    }

    // Analyze which files can fit
    const analysis: FileWithStatus[] = [];
    let currentSize = 0;

    for (const file of files) {
      const canUpload = (currentSize + file.file.size) <= STORAGE_LIMIT_BYTES;
      analysis.push({
        id: file.id,
        file: file.file,
        name: file.file.name,
        size: file.file.size,
        canUpload
      });
      
      if (canUpload) {
        currentSize += file.file.size;
      }
    }

    return { canProceed: false, analysis };
  }, [files, totalFilesSize]);

  const startUpload = useCallback(async () => {
    logger.info(`[UploadAction] StartUpload clicked`, { total: files.length, pending: files.filter(f => f.status === 'pending').length });
    // Check storage limit before proceeding
    const { canProceed, analysis } = validateStorageLimit();
    if (!canProceed) {
      setFilesAnalysis(analysis);
      setExceedsLimitDialogOpen(true);
      return;
    }

    // Stay in review mode but start uploading - don't navigate away
    const filesToUpload = files.filter(f => f.status === 'pending');
    
    // Update all pending files to uploading status
    setFiles(prev => prev.map(f => 
      f.status === 'pending' ? { ...f, status: 'uploading' as const } : f
    ));
    
    // Prepare files for upload with controls
    const uploadFiles = filesToUpload.map(f => ({
      file: f.file,
      id: f.id,
      metadata: f.metadata
    }));
    
    // Upload files with progress callbacks
    await uploadMultipleWithControls(
      uploadFiles,
      (fileId, progress) => {
        // Update file progress in real-time
        setFiles(prev => prev.map(f => 
          f.id === fileId 
            ? { 
                ...f, 
                uploadProgress: progress.progress,
                uploadMessage: progress.message,
                uploadPhase: progress.phase
              }
            : f
        ));
      },
      (fileId, result) => {
        // File completed successfully - remove from queue
        setFiles(prev => {
          const updatedFiles = prev.filter(f => f.id !== fileId);
          
          // Navigate to library when all uploads complete and no files remain
          if (updatedFiles.length === 0) {
            setTimeout(() => navigate('/library'), 1000);
          }
          
          return updatedFiles;
        });
      },
      (fileId, error) => {
        // Handle upload error
        setFiles(prev => prev.map(f => 
          f.id === fileId 
            ? { ...f, status: 'error' as const, uploadMessage: error }
            : f
        ));
        
        toast({
          title: "Upload failed",
          description: error,
          variant: "destructive"
        });
      }
    );
  }, [files, validateStorageLimit, uploadMultipleWithControls, navigate, toast]);

  const clearUpload = useCallback(() => {
    logger.info(`[UploadAction] ClearUpload clicked`);
    setFiles([]);
    setReviewMode(false);
    setCurrentUploadProgress(0);
    setCurrentUploadingFile(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    // Remove accept parameter to let all files through to our validation logic
    disabled: uploading || reviewMode
  });

  const removeFile = (id: string) => {
    logger.info(`[UploadAction] RemoveFile clicked`, { fileId: id });
    setFiles(prev => {
      const newFiles = prev.filter(f => f.id !== id);
      if (newFiles.length === 0) setReviewMode(false);
      return newFiles;
    });
  };

  const handleMetadataChange = (fileId: string, metadata: Partial<UploadedFileWithMetadata['metadata']>) => {
    logger.debug(`[UploadAction] MetadataChange`, { fileId, keys: Object.keys(metadata) });
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, metadata: { ...f.metadata, ...metadata } } : f));
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatSizeComparison = (originalSize: number, processedSize?: number, compressionRatio?: number) => {
    if (!processedSize || !compressionRatio || compressionRatio === 0) {
      return formatFileSize(originalSize);
    }
    
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground line-through">{formatFileSize(originalSize)}</span>
        <span className="text-primary font-medium">{formatFileSize(processedSize)}</span>
        <span className="text-emerald-600 font-medium flex items-center gap-1">
          <Zap className="w-3 h-3" />
          {compressionRatio}%
        </span>
      </div>
    );
  };

  const completedFiles = files.filter(f => f.status === 'completed').length;
  const hasCompletedFiles = completedFiles > 0;

  // Database duplicate handlers
  const handlePurgeSelectedDuplicates = (duplicateIds: string[]) => {
    logger.info(`[UploadAction] PurgeSelectedDuplicates`, { count: duplicateIds.length });
    setFiles(prev => prev.filter(f => !duplicateIds.includes(f.id)));
    setDatabaseDuplicates([]);
    setDatabaseDuplicateDialogOpen(false);
    
    // Check if any files remain to enter review mode
    const remainingFiles = files.filter(f => !duplicateIds.includes(f.id));
    if (remainingFiles.length > 0) {
      setReviewMode(true);
    }
  };

  const handleKeepBothDuplicates = () => {
    logger.info(`[UploadAction] KeepBothDuplicates clicked`);
    console.log(`📝 Keeping both versions - adding duplicate tags`);
    // Add duplicate tags to help identify files
    setFiles(prev => prev.map(f => {
      const duplicate = databaseDuplicates.find(d => d.queueFile.id === f.id);
      if (duplicate) {
        const duplicateTag = `duplicate-${Date.now()}`;
        return {
          ...f,
          metadata: {
            ...f.metadata,
            tags: [...f.metadata.tags, duplicateTag]
          }
        };
      }
      return f;
    }));
    
    setDatabaseDuplicates([]);
    setDatabaseDuplicateDialogOpen(false);
    setReviewMode(true);
    
    toast({
      title: "Files kept",
      description: "All files kept with duplicate tags added for identification",
    });
  };

  const handleCancelDuplicateUpload = () => {
    logger.error(`[UploadAction] CancelDuplicateUpload clicked`);
    // Remove all files that were being checked for duplicates
    const duplicateFileIds = databaseDuplicates.map(d => d.queueFile.id);
    setFiles(prev => prev.filter(f => !duplicateFileIds.includes(f.id)));
    
    setDatabaseDuplicates([]);
    setDatabaseDuplicateDialogOpen(false);
    
    toast({
      title: "Upload canceled",
      description: "No files were added to the upload queue",
    });
  };

  return (
    <SelectedFilesProvider>
      <Layout>
        <div className="flex flex-col h-full overflow-hidden">
          {/* Fixed Header Section */}
          <div className="flex-none bg-background border-b border-border">
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    {uploading ? 'Uploading Files' : reviewMode ? 'Review Files' : 'Upload Media'}
                  </h1>
                  <p className="text-muted-foreground">
                    {uploading 
                      ? isPaused ? 'Upload paused - use controls to resume or cancel'
                                 : 'Files are being uploaded to your library...'
                      : reviewMode 
                        ? 'Review your selected files before uploading. You can edit metadata and remove files.'
                        : 'Ultra-fast direct uploads. Files are immediately available in your library.'
                    }
                  </p>
                </div>

                {/* Upload Controls - Show during upload */}
                {uploading && (
                  <div className="flex items-center gap-3">
                    {/* Compact upload counter */}
                    <span className="text-sm text-muted-foreground font-medium">
                      {files.filter(f => f.status === 'completed').length} out of {files.length} files uploaded. {files.filter(f => f.status === 'pending' || f.status === 'uploading').length} files remaining
                    </span>
                    {isPaused ? (
                      <Button 
                        onClick={resumeAllUploads}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        Resume All
                      </Button>
                    ) : (
                      <Button 
                        onClick={pauseAllUploads}
                        variant="secondary"
                      >
                        Pause All
                      </Button>
                    )}
                    <Button 
                      onClick={() => {
                        cancelAllUploads();
                        clearUpload();
                      }}
                      variant="destructive"
                    >
                      Cancel All
                    </Button>
                  </div>
                )}

              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 justify-between">
                {/* Left Side - Select All Controls (Review Mode Only) */}
                <div className="flex items-center gap-3">
                  {hasCompletedFiles && !reviewMode && !uploading && (
                    <Button onClick={() => navigate('/library')}>
                      View Library ({completedFiles})
                    </Button>
                  )}
                  
                  {/* Select All Controls - Show in review mode when not uploading */}
                  {reviewMode && files.length > 0 && !uploading && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={allSelected ? clearSelection : selectAllFiles}
                        className="flex items-center gap-2 h-8"
                      >
                        {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        {allSelected ? 'Deselect All' : 'Select All'}
                      </Button>
                      
                      <span className="text-sm text-muted-foreground">
                        {selectedFiles.length > 0 ? (
                          <span className="font-medium text-foreground">
                            {selectedFiles.length} of {files.length} selected
                          </span>
                        ) : (
                          `${files.length} file${files.length !== 1 ? 's' : ''}`
                        )}
                      </span>
                      
                      {selectedFiles.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearSelection}
                          className="text-muted-foreground hover:text-foreground h-8"
                        >
                          Clear Selection
                        </Button>
                      )}
                    </>
                  )}
                </div>
                
                {/* Right Side - Action Buttons */}
                <div className="flex items-center gap-3">
                  
                  {/* Review Controls - Show in review mode when not uploading */}
                  {reviewMode && files.length > 0 && !uploading && (
                    <>
                      <Button 
                        variant="outline" 
                        onClick={clearUpload}
                        className="flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Clear Upload
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={handleAddMoreFiles}
                        className="flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add More Files
                      </Button>
                      <Button 
                        onClick={startUpload}
                        className="flex items-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        Start Upload ({files.length} files)
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Storage Quota Progress Bar - Show in review mode but hide during upload */}
              {reviewMode && files.length > 0 && !uploading && (
                <StorageQuotaProgressBar 
                  totalSizeBytes={totalFilesSize}
                  className="mt-4"
                />
              )}
              
              {/* Batch Metadata Toolbar - Show when files are selected in review mode */}
              {reviewMode && !uploading && hasSelection && (
                <div className="mt-4">
                  <BatchMetadataToolbar
                    selectedCount={selectedFiles.length}
                    onClearSelection={clearSelection}
                    onUpdateMetadata={updateSelectedFilesMetadata}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-hidden">
            <div className="container mx-auto px-4 py-4 h-full overflow-y-auto">
              {/* Upload Area - Hide in review mode */}
              {!reviewMode && (
                <Card className="mb-6">
                  <div
                    {...getRootProps()}
                    className={`
                      p-8 border-2 border-dashed rounded-lg transition-colors cursor-pointer
                      ${isDragActive 
                        ? 'border-primary bg-primary/5' 
                        : 'border-muted-foreground/25 hover:border-primary/50'
                      }
                      ${uploading || isCheckingDuplicates ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
                    `}
                  >
                    <input {...getInputProps()} />
                    <div className="text-center">
                      <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      {isDragActive ? (
                        <p className="text-lg font-medium text-primary">Drop files here...</p>
                      ) : (
                        <>
                          <p className="text-lg font-medium text-foreground mb-2">
                            Drag & drop files here, or click to browse
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Supports images, videos, and audio files
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              {/* Duplicate Check Loading Overlay */}
              {isCheckingDuplicates && (
                <Card className="mb-6 border-primary/20 bg-primary/5">
                  <div className="p-8 text-center">
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
                      <span className="text-lg font-medium text-primary">Checking for duplicates...</span>
                    </div>
                    
                    <Progress 
                      value={(duplicateProgress.current / duplicateProgress.total) * 100} 
                      className="w-full max-w-md mx-auto mb-2"
                    />
                    
                    <p className="text-sm text-muted-foreground">
                      {duplicateProgress.step || 'Processing files...'}
                    </p>
                  </div>
                </Card>
              )}

              {/* Review Mode - File List Only */}
              {reviewMode && files.length > 0 && (
                <div className="h-full flex flex-col animate-in fade-in-0 duration-300">
                  <div className="flex-1 min-h-0">
                    <VirtualizedFileList
                      files={files}
                      onRemove={removeFile}
                      onMetadataChange={handleMetadataChange}
                      onSelectionChange={toggleFileSelection}
                      onReorder={reorderFiles}
                      formatFileSize={formatFileSize}
                      height={500}
                      selectionMode={selectionMode}
                      onEnterSelectionMode={() => setSelectionMode(true)}
                    />
                  </div>
                </div>
              )}


              {/* Hidden file input for adding more files */}
              <input
                ref={addMoreFileInputRef}
                type="file"
                multiple
                onChange={handleAddMoreFilesChange}
                className="hidden"
              />

              {/* Unsupported Files Dialog */}
              <UnsupportedFilesDialog
                open={unsupportedDialogOpen}
                onOpenChange={setUnsupportedDialogOpen}
                unsupportedFiles={unsupportedFiles}
                onConfirm={() => {
                  // logger.debug(`Closing unsupported files dialog`);
                  setUnsupportedDialogOpen(false);
                  setUnsupportedFiles([]);
                }}
              />

              {/* Corrupted Files Dialog */}
              <CorruptedFilesDialog
                open={corruptedDialogOpen}
                onOpenChange={setCorruptedDialogOpen}
                corruptedFiles={corruptedFiles}
                onRemoveFiles={(fileIds: string[]) => {
                  // Remove corrupted files from upload queue
                  setFiles(prev => prev.filter(f => !fileIds.includes(f.id)));
                  logger.info(`[UploadAction] Removed corrupted files`, { count: fileIds.length });
                }}
                onRemoveAll={() => {
                  // Remove all corrupted files from upload queue
                  const corruptedFileIds = corruptedFiles.map(f => f.id);
                  setFiles(prev => prev.filter(f => !corruptedFileIds.includes(f.id)));
                  setCorruptedFiles([]);
                  logger.info(`[UploadAction] Removed all corrupted files`, { count: corruptedFileIds.length });
                }}
              />

              {/* Duplicate Files Dialog */}
              <DuplicateFilesDialog
                open={duplicateDialogOpen}
                onOpenChange={setDuplicateDialogOpen}
                duplicateFiles={duplicateFiles}
                onConfirm={(filesToIgnore: string[]) => {
                  // Remove ignored duplicates from the duplicates list
                  setDuplicateFiles(prev => prev.filter(dup => !filesToIgnore.includes(dup.id)));
                  setDuplicateDialogOpen(false);
                }}
              />

              {/* Database Duplicate Files Dialog */}
              <PreUploadDuplicateDialog
                open={databaseDuplicateDialogOpen}
                onOpenChange={setDatabaseDuplicateDialogOpen}
                duplicates={databaseDuplicates}
                onPurgeSelected={handlePurgeSelectedDuplicates}
                onKeepBoth={handleKeepBothDuplicates}
                onCancel={handleCancelDuplicateUpload}
              />

              {/* Exceeds Limit Dialog */}
              <ExceedsLimitDialog
                open={exceedsLimitDialogOpen}
                onOpenChange={setExceedsLimitDialogOpen}
                filesAnalysis={filesAnalysis}
                totalCurrentSize={0} // Current usage would need to be tracked separately
                onProceedWithPartial={() => {
                  // Filter files to only upload those that fit within limit
                  const filesToKeep = filesAnalysis.filter(f => f.canUpload).map(f => f.id);
                  setFiles(prev => prev.filter(f => filesToKeep.includes(f.id)));
                  
                  // Proceed with upload
                  setExceedsLimitDialogOpen(false);
                  setReviewMode(false);
                  
                  // Start upload with filtered files
                  const filesToUpload = files.filter(f => filesToKeep.includes(f.id) && f.status === 'pending');
                  
                  toast({
                    title: "Partial upload started",
                    description: `Uploading ${filesToUpload.length} files that fit within storage limit`,
                  });
                  
                  // Trigger upload for remaining files
                  setTimeout(() => {
                    const remainingFiles = files.filter(f => filesToKeep.includes(f.id));
                    if (remainingFiles.length > 0) {
                      startUpload();
                    }
                  }, 100);
                }}
                onCancel={() => {
                  setExceedsLimitDialogOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      </Layout>
    </SelectedFilesProvider>
  );
}