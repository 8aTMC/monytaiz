import React, { useEffect, useState } from 'react';
import { useSimpleMedia, SimpleMediaItem } from '@/hooks/useSimpleMedia';
import { SimpleMediaGrid } from '@/components/SimpleMediaGrid';
import { SimpleMediaPreview } from '@/components/SimpleMediaPreview';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { RefreshCw, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SimpleLibrary() {
  const navigate = useNavigate();
  const { media, loading, error, fetchMedia, getThumbnailUrl, getFullUrl } = useSimpleMedia();
  const [selectedItem, setSelectedItem] = useState<SimpleMediaItem | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const handleItemClick = (item: SimpleMediaItem) => {
    setSelectedItem(item);
    setIsPreviewOpen(true);
  };

  const handlePreviewClose = () => {
    setIsPreviewOpen(false);
    setSelectedItem(null);
  };

  const handleRefresh = () => {
    fetchMedia();
  };

  const handleUpload = () => {
    navigate('/simple-upload');
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Media Library</h1>
            <p className="text-muted-foreground mt-1">
              Browse your optimized media collection
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            
            <Button onClick={handleUpload}>
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-muted/20 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {loading ? 'Loading...' : `${media.length} items`}
            </div>
            {error && (
              <div className="text-sm text-destructive">
                Error: {error}
              </div>
            )}
          </div>
        </div>

        {/* Empty State with Upload Link */}
        {media.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">No media found</h3>
            <p className="text-muted-foreground mb-4">Upload some files to get started</p>
            <Button onClick={handleUpload} className="mb-8">
              <Upload className="w-4 h-4 mr-2" />
              Upload Files
            </Button>
          </div>
        )}

        {/* Media Grid */}
        <SimpleMediaGrid
          media={media}
          loading={loading}
          onItemClick={handleItemClick}
          getThumbnailUrl={getThumbnailUrl}
        />

        {/* Preview Modal */}
        <SimpleMediaPreview
          item={selectedItem}
          isOpen={isPreviewOpen}
          onClose={handlePreviewClose}
          getFullUrl={getFullUrl}
        />
      </div>
    </Layout>
  );
}