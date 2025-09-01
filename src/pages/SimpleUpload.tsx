import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSimpleUpload } from '@/hooks/useSimpleUpload';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, Zap, TrendingDown, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FileUploadRowWithMetadata, UploadedFileWithMetadata } from '@/components/FileUploadRowWithMetadata';
import { DetailedUploadProgressBar } from '@/components/DetailedUploadProgressBar';
import { VideoValidationError } from '@/components/VideoValidationError';

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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: crypto.randomUUID(),
      status: 'uploading' as const,
      metadata: {
        mentions: [],
        tags: [],
        folders: [],
        description: '',
        suggestedPrice: null,
      }
    }));

    setFiles(prev => [...prev, ...newFiles]);

    // Upload files one by one
    for (let i = 0; i < newFiles.length; i++) {
      const fileToUpload = newFiles[i];
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
      
      setCurrentUploadProgress(((i + 1) / newFiles.length) * 100);
    }
    
    setCurrentUploadingFile(null);
  }, [uploadFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff'],
      'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.m4v'],
      'audio/*': ['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.aac', '.opus', '.wma']
    },
    disabled: uploading || isProcessing
  });

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
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
            <h1 className="text-3xl font-bold text-foreground">Upload Media</h1>
            <p className="text-muted-foreground mt-1">
              Upload media files with maximum compression. Videos converted to WebM (480p/720p/1080p), audio to Opus format. Never keeps originals.
            </p>
          </div>
          
          {hasCompletedFiles && (
            <Button onClick={() => navigate('/library')}>
              View Library ({completedFiles})
            </Button>
          )}
        </div>

        {/* Upload Area */}
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

        {/* Files List with Enhanced Display */}
        {files.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Files</h3>
              {files.some(f => f.status === 'completed' && f.compressionRatio) && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <TrendingDown className="w-4 h-4 text-emerald-600" />
                    <span>
                      Total saved: {formatFileSize(files.reduce((acc, f) => {
                        if (f.compressionRatio && f.processedSize) {
                          return acc + (f.file.size - f.processedSize);
                        }
                        return acc;
                      }, 0))}
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            {files.map((uploadedFile) => (
              <div key={uploadedFile.id}>
                {uploadedFile.status === 'validation_error' && uploadedFile.error ? (
                  <VideoValidationError
                    error={uploadedFile.error}
                    file={uploadedFile.file}
                    onRemove={() => removeFile(uploadedFile.id)}
                  />
                ) : (
                  <Card className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                            <Upload className="w-5 h-5 text-muted-foreground" />
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{uploadedFile.file.name}</p>
                            <div className="text-xs text-muted-foreground">
                              {formatSizeComparison(
                                uploadedFile.file.size, 
                                uploadedFile.processedSize, 
                                uploadedFile.compressionRatio
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {uploadedFile.status === 'completed' && uploadedFile.compressionRatio && uploadedFile.compressionRatio > 0 && (
                            <div className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full">
                              {uploadedFile.compressionRatio}% saved
                            </div>
                          )}
                          
                          <div className="text-xs px-2 py-1 rounded-full capitalize" style={{
                            backgroundColor: uploadedFile.status === 'completed' ? 'hsl(var(--success) / 0.1)' : 
                                           uploadedFile.status === 'error' ? 'hsl(var(--destructive) / 0.1)' : 'hsl(var(--muted))',
                            color: uploadedFile.status === 'completed' ? 'hsl(var(--success))' : 
                                   uploadedFile.status === 'error' ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))'
                          }}>
                            {uploadedFile.status}
                          </div>
                          
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => removeFile(uploadedFile.id)}
                            disabled={uploading}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>

                      {/* Quality breakdown for video files */}
                      {uploadedFile.qualityInfo && uploadedFile.file.type.startsWith('video/') && (
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Quality Variants Generated</p>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            {Object.entries(uploadedFile.qualityInfo).map(([quality, info]: [string, any]) => (
                              <div key={quality} className="bg-background rounded p-2">
                                <p className="font-medium">{quality}</p>
                                <p className="text-muted-foreground">{formatFileSize(info.size || 0)}</p>
                                {info.compressionRatio && (
                                  <p className="text-emerald-600">-{info.compressionRatio}%</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {uploadedFile.error && uploadedFile.status !== 'validation_error' && (
                        <p className="text-xs text-destructive mt-2">{uploadedFile.error}</p>
                      )}
                    </div>
                  </Card>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}