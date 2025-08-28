import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSimpleUpload } from '@/hooks/useSimpleUpload';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, FileImage, FileVideo, FileAudio, X, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UploadedFile {
  file: File;
  id: string;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

export default function SimpleUpload() {
  const navigate = useNavigate();
  const { uploading, uploadFile } = useSimpleUpload();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles: UploadedFile[] = acceptedFiles.map(file => ({
      file,
      id: crypto.randomUUID(),
      status: 'uploading' as const
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

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <FileImage className="w-8 h-8" />;
    if (file.type.startsWith('video/')) return <FileVideo className="w-8 h-8" />;
    if (file.type.startsWith('audio/')) return <FileAudio className="w-8 h-8" />;
    return <FileImage className="w-8 h-8" />;
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
              <Card key={uploadedFile.id} className="p-4">
                <div className="flex items-center gap-4">
                  <div className="text-muted-foreground">
                    {getFileIcon(uploadedFile.file)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{uploadedFile.file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(uploadedFile.file.size)}
                    </p>
                    {uploadedFile.error && (
                      <p className="text-sm text-destructive mt-1">{uploadedFile.error}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {uploadedFile.status === 'uploading' && (
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    )}
                    {uploadedFile.status === 'completed' && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    {uploadedFile.status === 'error' && (
                      <X className="w-5 h-5 text-destructive" />
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(uploadedFile.id)}
                      disabled={uploading}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}