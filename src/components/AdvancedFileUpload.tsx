import { useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Play, CheckCircle, AlertCircle } from 'lucide-react';
import { useFileUpload } from '@/hooks/useFileUpload';
import { FileUploadThumbnail } from './FileUploadThumbnail';
import { FileUploadRow } from './FileUploadRow';
import { cn } from '@/lib/utils';

export const AdvancedFileUpload = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    uploadQueue,
    isUploading,
    currentUploadIndex,
    addFiles,
    removeFile,
    startUpload,
    clearQueue,
    processedCount,
    totalCount,
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
      default:
        return null;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Upload Files</span>
          {totalCount > 0 && (
            <Badge variant="secondary">
              {processedCount}/{totalCount} processed
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Area - Only show when no files selected */}
        {uploadQueue.length === 0 && (
          <div 
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              "border-muted-foreground/25 hover:border-muted-foreground/50",
              "bg-muted/10 hover:bg-muted/20"
            )}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Upload Your Content</h3>
            <p className="text-muted-foreground mb-4">
              Drag and drop files here or click to browse
            </p>
            <Button 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
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
            <div className="mt-4 text-xs text-muted-foreground space-y-1">
              <p><strong>Supported formats:</strong></p>
              <p>📸 Photos: JPG, PNG, WEBP, GIF (max 20MB)</p>
              <p>🎥 Videos: MP4, MOV, WEBM, AVI, MKV (max 6GB)</p>
              <p>🎵 Audio: MP3, WAV, AAC, OGG (max 10MB)</p>
              <p>📄 Documents: PDF, DOC, DOCX, TXT, RTF (max 100MB)</p>
              <p className="font-medium">Maximum 100 files per batch</p>
            </div>
          </div>
        )}

        {/* Upload More Button - Show when files are selected and less than 100 */}
        {uploadQueue.length > 0 && uploadQueue.length < 100 && (
          <div className="flex justify-end">
            <Button 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload More
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

        {/* Upload Queue */}
        {uploadQueue.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Upload Queue</h4>
              <div className="flex gap-2">
                {!isUploading && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearQueue}
                    >
                      Clear All
                    </Button>
                    <Button
                      size="sm"
                      onClick={startUpload}
                      disabled={uploadQueue.length === 0}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Start Upload
                    </Button>
                  </>
                )}
              </div>
            </div>

            <ScrollArea className="h-80 border rounded-lg p-4">
              <div className="space-y-3">
                {uploadQueue.map((item, index) => (
                  <FileUploadRow
                    key={item.id}
                    item={item}
                    index={index}
                    currentUploadIndex={currentUploadIndex}
                    isUploading={isUploading}
                    onRemove={removeFile}
                    getStatusIcon={getStatusIcon}
                    formatFileSize={formatFileSize}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Upload Status */}
        {isUploading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Uploading files...</span>
              <span className="text-sm text-muted-foreground">
                {currentUploadIndex + 1} of {totalCount}
              </span>
            </div>
            <Progress 
              value={((currentUploadIndex + 1) / totalCount) * 100} 
              className="h-2"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};