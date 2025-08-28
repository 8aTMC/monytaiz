import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSimpleUpload } from '@/hooks/useSimpleUpload';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FileUploadRowWithMetadata, UploadedFileWithMetadata } from '@/components/FileUploadRowWithMetadata';

export default function SimpleUpload() {
  const navigate = useNavigate();
  const { uploading, uploadFile } = useSimpleUpload();
  const [files, setFiles] = useState<UploadedFileWithMetadata[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles: UploadedFileWithMetadata[] = acceptedFiles.map(file => ({
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
        await uploadFile(fileToUpload.file);
        
        setFiles(prev => prev.map(f => 
          f.id === fileToUpload.id 
            ? { ...f, status: 'completed' }
            : f
        ));
      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.id === fileToUpload.id 
            ? { ...f, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' }
            : f
        ));
      }
      
      setUploadProgress(((i + 1) / newFiles.length) * 100);
    }
  }, [uploadFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'video/*': ['.mp4', '.mov', '.avi', '.mkv'],
      'audio/*': ['.mp3', '.wav', '.m4a', '.flac']
    },
    disabled: uploading
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

  const completedFiles = files.filter(f => f.status === 'completed').length;
  const hasCompletedFiles = completedFiles > 0;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Upload Media</h1>
            <p className="text-muted-foreground mt-1">
              Upload images, videos, and audio files for optimization
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

        {/* Upload Progress */}
        {uploading && files.length > 0 && (
          <Card className="p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Uploading files...</span>
              <span className="text-sm text-muted-foreground">{Math.round(uploadProgress)}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </Card>
        )}

        {/* Files List */}
        {files.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-medium">Files</h3>
            {files.map((uploadedFile) => (
              <FileUploadRowWithMetadata
                key={uploadedFile.id}
                uploadedFile={uploadedFile}
                onRemove={removeFile}
                onMetadataChange={handleMetadataChange}
                disabled={uploading}
                formatFileSize={formatFileSize}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}