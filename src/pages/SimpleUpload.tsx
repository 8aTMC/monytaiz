import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSimpleUpload } from '@/hooks/useSimpleUpload';
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

export default function SimpleUpload() {
  const navigate = useNavigate();
  const { uploading, uploadFile, uploadProgress, isProcessing } = useSimpleUpload();
  const [files, setFiles] = useState<(UploadedFileWithMetadata & { 
    compressionRatio?: number; 
    processedSize?: number; 
    qualityInfo?: any;
  })[]>([]);
  const [currentUploadProgress, setCurrentUploadProgress] = useState(0);
  const [currentUploadingFile, setCurrentUploadingFile] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState(false);

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
    disabled: uploading || isProcessing || reviewMode
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
    <Layout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {reviewMode ? 'Review Files' : 'Upload Media'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {reviewMode 
                ? 'Review your selected files before uploading. You can edit metadata and remove files.'
                : 'Upload media files with maximum compression. Videos converted to WebM (480p/720p/1080p), audio to Opus format. Never keeps originals.'
              }
            </p>
          </div>
          
          {reviewMode && files.length > 0 && (
            <div className="flex items-center gap-3">
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
          
          {hasCompletedFiles && !reviewMode && (
            <Button onClick={() => navigate('/library')}>
              View Library ({completedFiles})
            </Button>
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
                ${(uploading || isProcessing) ? 'opacity-50 cursor-not-allowed' : ''}
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

        {/* Review Mode - File List with Thumbnails */}
        {reviewMode && files.length > 0 && (
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Selected Files ({files.length})</h3>
              <p className="text-sm text-muted-foreground">
                Total size: {formatFileSize(files.reduce((acc, f) => acc + f.file.size, 0))}
              </p>
            </div>
            
            <div className="space-y-3">
              {files.map((file) => (
                <FileReviewRow
                  key={file.id}
                  file={file}
                  onRemove={removeFile}
                  onMetadataChange={handleMetadataChange}
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
                  Files will be processed and compressed during upload. You can edit metadata for each file above.
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* Enhanced Processing & Upload Progress */}
        {(isProcessing || uploading) && (
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
                  
                  {/* Statistics */}
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Files</p>
                      <p className="font-medium">{files.filter(f => f.status === 'completed').length}/{files.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Saved</p>
                      <p className="font-medium text-emerald-600">
                        {formatFileSize(files.reduce((acc, f) => {
                          if (f.compressionRatio && f.processedSize) {
                            return acc + (f.file.size - f.processedSize);
                          }
                          return acc;
                        }, 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Avg Compression</p>
                      <p className="font-medium text-emerald-600">
                        {Math.round(files.reduce((acc, f, _, arr) => acc + (f.compressionRatio || 0), 0) / files.length)}%
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Current File Detailed Progress */}
            {uploadProgress.phase !== 'complete' && currentUploadingFile && (
              <DetailedUploadProgressBar
                fileName={files.find(f => f.id === currentUploadingFile)?.file.name || 'Processing...'}
                fileType={files.find(f => f.id === currentUploadingFile)?.file.type || ''}
                progress={uploadProgress}
                isActive={true}
              />
            )}
          </div>
        )}

      </div>
    </Layout>
  );
}