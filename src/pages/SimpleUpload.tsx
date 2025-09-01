import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSimpleUpload } from '@/hooks/useSimpleUpload';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FileUploadRowWithMetadata, UploadedFileWithMetadata } from '@/components/FileUploadRowWithMetadata';

export default function SimpleUpload() {
  const navigate = useNavigate();
  const { uploading, uploadFile, uploadProgress, isProcessing } = useSimpleUpload();
  const [files, setFiles] = useState<(UploadedFileWithMetadata & { compressionRatio?: number; processedSize?: number })[]>([]);
  const [currentUploadProgress, setCurrentUploadProgress] = useState(0);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles: (UploadedFileWithMetadata & { compressionRatio?: number; processedSize?: number })[] = acceptedFiles.map(file => ({
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
      
      try {
        const result = await uploadFile(fileToUpload.file);
        
        setFiles(prev => prev.map(f => 
          f.id === fileToUpload.id 
            ? { 
                ...f, 
                status: 'completed',
                compressionRatio: result.compressionRatio,
                processedSize: result.processedSize
              }
            : f
        ));
      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.id === fileToUpload.id 
            ? { ...f, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' }
            : f
        ));
      }
      
      setCurrentUploadProgress(((i + 1) / newFiles.length) * 100);
    }
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

        {/* Processing & Upload Progress */}
        {(isProcessing || uploading) && (
          <Card className="p-4 mb-6">
            <div className="space-y-4">
              {/* Current File Processing */}
              {uploadProgress.phase !== 'complete' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{uploadProgress.message}</span>
                    <span className="text-sm text-muted-foreground">{uploadProgress.progress}%</span>
                  </div>
                  <Progress value={uploadProgress.progress} className="h-2" />
                  
                  {/* Size information */}
                  {uploadProgress.originalSize && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                      <span>Original: {formatFileSize(uploadProgress.originalSize)}</span>
                      {uploadProgress.processedSize && uploadProgress.compressionRatio ? (
                        <span className="text-emerald-600 font-medium">
                          Processed: {formatFileSize(uploadProgress.processedSize)} 
                          ({uploadProgress.compressionRatio}% reduction)
                        </span>
                      ) : (
                        <span>Processing...</span>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {/* Overall Progress */}
              {files.length > 1 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Overall Progress</span>
                    <span className="text-sm text-muted-foreground">{Math.round(currentUploadProgress)}%</span>
                  </div>
                  <Progress value={currentUploadProgress} className="h-2" />
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Legacy upload progress for compatibility */}
        {uploading && files.length > 0 && !uploadProgress.originalSize && (
          <Card className="p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Uploading files...</span>
              <span className="text-sm text-muted-foreground">{Math.round(currentUploadProgress)}%</span>
            </div>
            <Progress value={currentUploadProgress} className="h-2" />
          </Card>
        )}

        {/* Files List */}
        {files.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-medium">Files</h3>
            {files.map((uploadedFile) => (
              <Card key={uploadedFile.id} className="p-4">
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
                      backgroundColor: uploadedFile.status === 'completed' ? '#dcfce7' : 
                                     uploadedFile.status === 'error' ? '#fef2f2' : '#f3f4f6',
                      color: uploadedFile.status === 'completed' ? '#166534' : 
                             uploadedFile.status === 'error' ? '#dc2626' : '#6b7280'
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
                
                {uploadedFile.error && (
                  <p className="text-xs text-red-600 mt-2">{uploadedFile.error}</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}