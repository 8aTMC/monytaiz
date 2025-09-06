import { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Play, CheckCircle, AlertCircle, RefreshCw, Pause, Clock, Plus } from 'lucide-react';
import { useFileUpload } from '@/hooks/useFileUpload';
import { EnhancedFileUploadRow } from './EnhancedFileUploadRow';
import { BatchMetadataToolbar } from './BatchMetadataToolbar';
import { SelectionHeader } from './SelectionHeader';
import { FilePreviewDialog } from './FilePreviewDialog';
import { DuplicateFilesDialog } from './DuplicateFilesDialog';
import { cn } from '@/lib/utils';

export const AdvancedFileUpload = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreFileInputRef = useRef<HTMLInputElement>(null);
  
  // Centralized preview state
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  
  // Duplicate files dialog state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateFiles, setDuplicateFiles] = useState<{ name: string; size: number; type: string }[]>([]);
  
  const {
    uploadQueue,
    isUploading,
    currentUploadIndex,
    addFiles,
    startUpload,
    removeFile,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    clearQueue,
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
    uploadQueue.map(item => item.file), 
    [uploadQueue]
  );

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    addFiles(Array.from(files));
    // Reset input so same file can be selected again
    event.target.value = '';
  }, [addFiles]);

  const handleAddMoreFiles = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    const showDuplicateDialog = (duplicates: { name: string; size: number; type: string }[]) => {
      setDuplicateFiles(duplicates);
      setDuplicateDialogOpen(true);
    };
    
    addFiles(Array.from(files), showDuplicateDialog);
    // Reset input so same file can be selected again
    event.target.value = '';
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files) {
      // For drag and drop, show duplicate dialog if needed
      const showDuplicateDialog = (duplicates: { name: string; size: number; type: string }[]) => {
        setDuplicateFiles(duplicates);
        setDuplicateDialogOpen(true);
      };
      addFiles(Array.from(files), showDuplicateDialog);
    }
  }, [addFiles]);

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
    <Card className="w-full h-[calc(100vh-140px)]">
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
            </div>
            <div className="flex items-center gap-2">
              {isUploading ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={cancelAllUploads}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel All
                </Button>
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
                    onClick={startUpload}
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

        {/* Selection Header - Always visible when files exist */}
        <SelectionHeader
          totalFiles={uploadQueue.length}
          selectedCount={selectedFiles.length}
          allSelected={allSelected}
          onSelectAll={selectAllFiles}
          onClearSelection={clearSelection}
        />

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
              accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm,.avi,.mkv,.mp3,.wav,.aac,.ogg,.pdf,.doc,.docx,.txt,.rtf"
            />
          </div>
        )}

        {/* Add More Files Button - Below Start Upload when files exist */}
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
            <ScrollArea className="flex-1">
              <div className="space-y-2">
                {uploadQueue.map((item, index) => (
                  <EnhancedFileUploadRow
                    key={item.id}
                    item={item}
                    index={index}
                    currentUploadIndex={currentUploadIndex}
                    isUploading={isUploading}
                    onRemove={removeFile}
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
          accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm,.avi,.mkv,.mp3,.wav,.aac,.ogg,.pdf,.doc,.docx,.txt,.rtf"
        />
        <input
          ref={addMoreFileInputRef}
          type="file"
          multiple
          onChange={handleAddMoreFiles}
          className="hidden"
          accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm,.avi,.mkv,.mp3,.wav,.aac,.ogg,.pdf,.doc,.docx,.txt,.rtf"
        />

      </CardContent>

      <FilePreviewDialog
        file={previewIndex !== null ? uploadQueue[previewIndex]?.file : null}
        open={previewOpen}
        onOpenChange={closePreview}
        // Navigation props 
        files={filesArray}
        totalFiles={uploadQueue.length}
        currentIndex={previewIndex}
        // Metadata props
        mentions={previewIndex !== null ? uploadQueue[previewIndex]?.metadata?.mentions || [] : []}
        tags={previewIndex !== null ? uploadQueue[previewIndex]?.metadata?.tags || [] : []}
        folders={previewIndex !== null ? uploadQueue[previewIndex]?.metadata?.folders || [] : []}
        description={previewIndex !== null ? uploadQueue[previewIndex]?.metadata?.description || '' : ''}
        suggestedPrice={previewIndex !== null && uploadQueue[previewIndex]?.metadata?.suggestedPrice ? uploadQueue[previewIndex].metadata!.suggestedPrice! * 100 : 0}
        title={previewIndex !== null ? uploadQueue[previewIndex]?.file.name : ''}
        // Metadata change handlers
        onMentionsChange={(mentions) => handlePreviewMetadataUpdate('mentions', mentions)}
        onTagsChange={(tags) => handlePreviewMetadataUpdate('tags', tags)}
        onFoldersChange={(folders) => handlePreviewMetadataUpdate('folders', folders)}
        onDescriptionChange={(description) => handlePreviewMetadataUpdate('description', description)}
        onPriceChange={(price) => handlePreviewMetadataUpdate('suggestedPrice', price ? price / 100 : null)}
      />

      <DuplicateFilesDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        duplicateFiles={duplicateFiles}
        onConfirm={() => setDuplicateDialogOpen(false)}
      />
    </Card>
  );
};