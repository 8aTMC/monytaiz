import { useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Play, CheckCircle, AlertCircle, RefreshCw, Pause, Clock } from 'lucide-react';
import { useFileUpload } from '@/hooks/useFileUpload';
import { EnhancedFileUploadRow } from './EnhancedFileUploadRow';
import { cn } from '@/lib/utils';

export const AdvancedFileUpload = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    updateFileMetadata
  } = useFileUpload();

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    addFiles(Array.from(files));
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
      addFiles(Array.from(files));
    }
  }, [addFiles]);

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
              {uploadQueue.length < 100 && !isUploading && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Add More
                </Button>
              )}
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

        {/* Files List Header */}
        {uploadQueue.length > 0 && (
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Files</h3>
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
                    getStatusIcon={getStatusIcon}
                    formatFileSize={formatFileSize}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Hidden input for upload more functionality */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm,.avi,.mkv,.mp3,.wav,.aac,.ogg,.pdf,.doc,.docx,.txt,.rtf"
        />

      </CardContent>
    </Card>
  );
};