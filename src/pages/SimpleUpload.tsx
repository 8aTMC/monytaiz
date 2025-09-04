import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useDirectUpload } from '@/hooks/useDirectUpload';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, Zap, TrendingDown, Clock, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FileUploadRowWithMetadata, UploadedFileWithMetadata } from '@/components/FileUploadRowWithMetadata';
import { DetailedUploadProgressBar } from '@/components/DetailedUploadProgressBar';
import { VideoValidationError } from '@/components/VideoValidationError';
import { FileReviewRow } from '@/components/FileReviewRow';
import { SelectionHeader } from '@/components/SelectionHeader';
import { BatchMetadataToolbar } from '@/components/BatchMetadataToolbar';
import { useToast } from '@/hooks/use-toast';
import { SelectedFilesProvider } from '@/contexts/SelectedFilesContext';

export default function SimpleUpload() {
  const navigate = useNavigate();
  const { uploading, uploadFile, uploadProgress } = useDirectUpload();
  const { toast } = useToast();
  const [files, setFiles] = useState<(UploadedFileWithMetadata & { 
    compressionRatio?: number; 
    processedSize?: number; 
    qualityInfo?: any;
  })[]>([]);
  const [currentUploadProgress, setCurrentUploadProgress] = useState(0);
  const [currentUploadingFile, setCurrentUploadingFile] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  
  // Selection state management
  const selectedFiles = files.filter(f => f.selected);
  const hasSelection = selectedFiles.length > 0;
  const allSelected = files.length > 0 && selectedFiles.length === files.length;

  // Selection functions
  const toggleFileSelection = useCallback((fileId: string, selected: boolean) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, selected } : f
    ));
  }, []);

  const selectAllFiles = useCallback(() => {
    setFiles(prev => prev.map(f => ({ ...f, selected: true })));
  }, []);

  const clearSelection = useCallback(() => {
    setFiles(prev => prev.map(f => ({ ...f, selected: false })));
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
    
    clearSelection();
    toast({
      title: "Batch changes applied",
      description: `Metadata updated for ${selectedFiles.length} files`,
      variant: "default",
    });
  }, [selectedFiles.length, clearSelection, toast]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
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

    setFiles(prev => [...prev, ...newFiles]);
    setReviewMode(true);
  }, []);

  const startUpload = useCallback(async () => {
    setReviewMode(false);
    
    // Get pending files before updating status
    const filesToUpload = files.filter(f => f.status === 'pending');
    
    // Update all pending files to uploading status
    setFiles(prev => prev.map(f => 
      f.status === 'pending' ? { ...f, status: 'uploading' as const } : f
    ));
    
    // Upload files one by one
    for (let i = 0; i < filesToUpload.length; i++) {
      const fileToUpload = filesToUpload[i];
      setCurrentUploadingFile(fileToUpload.id);
      
      try {
        const result = await uploadFile(fileToUpload.file);
        
        setFiles(prev => prev.map(f => 
          f.id === fileToUpload.id 
            ? { 
                ...f, 
                status: 'completed',
                compressionRatio: result.compressionRatio,
                processedSize: result.processedSize,
                qualityInfo: result.qualityInfo
              }
            : f
        ));
      } catch (error) {
        console.error('Upload failed:', error);
        
        // Check if it's a validation error
        const isValidationError = error instanceof Error && (
          error.message.includes('File too large') ||
          error.message.includes('Resolution too high') ||
          error.message.includes('Video processing not available') ||
          error.message.includes('cannot be processed')
        );
        
        setFiles(prev => prev.map(f => 
          f.id === fileToUpload.id 
            ? { 
                ...f, 
                status: isValidationError ? 'validation_error' as const : 'error' as const,
                error: error instanceof Error ? error.message : 'Upload failed' 
              }
            : f
        ));
      }
      
      setCurrentUploadProgress(((i + 1) / filesToUpload.length) * 100);
    }
    
    setCurrentUploadingFile(null);
  }, [files, uploadFile]);

  const clearUpload = useCallback(() => {
    setFiles([]);
    setReviewMode(false);
    setCurrentUploadProgress(0);
    setCurrentUploadingFile(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff'],
      'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.m4v'],
      'audio/*': ['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.aac', '.opus', '.wma']
    },
    disabled: uploading || reviewMode
  });

  const removeFile = (id: string) => {
    setFiles(prev => {
      const newFiles = prev.filter(f => f.id !== id);
      // If no files left, exit review mode
      if (newFiles.length === 0) {
        setReviewMode(false);
      }
      return newFiles;
    });
  };

  const handleMetadataChange = (fileId: string, metadata: Partial<UploadedFileWithMetadata['metadata']>) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId 
        ? { ...f, metadata: { ...f.metadata, ...metadata } }
        : f
    ));
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

  return (
    <SelectedFilesProvider>
      <Layout>
        <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {reviewMode ? 'Review Files' : 'Upload Media'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {reviewMode 
                      ? 'Review your selected files before uploading. You can edit metadata and remove files.'
                      : 'Ultra-fast direct uploads. Files are immediately available in your library.'
                }
              </p>
            </div>
            
            {hasCompletedFiles && !reviewMode && (
              <Button onClick={() => navigate('/library')}>
                View Library ({completedFiles})
              </Button>
            )}
          </div>
          
          {reviewMode && files.length > 0 && (
            <div className="flex items-center gap-3 mt-4 justify-end">
              <Button 
                variant="outline" 
                onClick={clearUpload}
                className="flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Clear Upload
              </Button>
              <Button 
                onClick={startUpload}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Start Upload ({files.length} files)
              </Button>
            </div>
          )}
        </div>

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
                ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
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

        {/* Review Mode - File List with Selection and Batch Controls */}
        {reviewMode && files.length > 0 && (
          <div className="space-y-4 mb-6">
            {/* File count and selection header */}
            <SelectionHeader
              totalFiles={files.length}
              selectedCount={selectedFiles.length}
              allSelected={allSelected}
              onSelectAll={selectAllFiles}
              onClearSelection={clearSelection}
            />
            
            {/* Batch metadata toolbar */}
            {hasSelection && (
              <BatchMetadataToolbar
                selectedCount={selectedFiles.length}
                onClearSelection={clearSelection}
                onUpdateMetadata={updateSelectedFilesMetadata}
              />
            )}
            
            <div className="space-y-3">
              {files.map((file, index) => (
                <FileReviewRow
                  key={file.id}
                  file={file}
                  files={files}
                  currentIndex={index}
                  onRemove={removeFile}
                  onMetadataChange={handleMetadataChange}
                  onSelectionChange={toggleFileSelection}
                  onNavigateToFile={(targetIndex) => {
                    // Navigation is handled by the individual FileReviewRow
                    console.log('Navigate to file index:', targetIndex);
                  }}
                  formatFileSize={formatFileSize}
                />
              ))}
            </div>
            
            <Card className="p-4 bg-muted/30">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Ready to upload {files.length} file{files.length === 1 ? '' : 's'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Files will be uploaded directly with no processing delays. Thumbnails generated in background.
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* Enhanced Upload Progress */}
        {uploading && (
          <div className="space-y-4 mb-6">
            {/* Overall Progress Summary */}
            {files.length > 1 && (
              <Card className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Upload className="w-4 h-4 text-primary" />
                      <span className="font-medium">Upload Progress</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {files.filter(f => f.status === 'completed').length} / {files.length} completed
                    </span>
                  </div>
                  <Progress value={currentUploadProgress} className="h-2" />
                  
            {/* Statistics - Remove compression stats since no processing */}
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Files</p>
                <p className="font-medium">{files.filter(f => f.status === 'completed').length}/{files.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Size</p>
                <p className="font-medium text-primary">
                  {formatFileSize(files.reduce((acc, f) => {
                    if (f.status === 'completed') {
                      return acc + f.file.size;
                    }
                    return acc;
                  }, 0))}
                </p>
              </div>
            </div>
                </div>
              </Card>
            )}

            {/* Current File Detailed Progress */}
            {uploadProgress.phase !== 'complete' && uploadProgress.phase !== 'error' && currentUploadingFile && (
              <DetailedUploadProgressBar
                fileName={files.find(f => f.id === currentUploadingFile)?.file.name || 'Processing...'}
                fileType={files.find(f => f.id === currentUploadingFile)?.file.type || ''}
                progress={uploadProgress as any}
                isActive={true}
              />
            )}

            {/* Error Display */}
            {uploadProgress.phase === 'error' && (
              <Card className="p-4 border-destructive">
                <div className="flex items-center gap-2 text-destructive">
                  <Upload className="w-4 h-4" />
                  <span className="font-medium">Upload Error</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{uploadProgress.message}</p>
              </Card>
            )}
          </div>
        )}

      </div>
    </Layout>
    </SelectedFilesProvider>
  );
}