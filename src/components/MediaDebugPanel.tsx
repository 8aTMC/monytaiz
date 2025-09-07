import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Bug, ChevronDown, ChevronUp } from 'lucide-react';

interface MediaDebugPanelProps {
  item: {
    id?: string;
    type: 'image' | 'video' | 'audio';
    storage_path?: string;
    file_path?: string;
    path?: string;
    title: string | null;
    tiny_placeholder?: string;
    thumbnail_path?: string;
    width?: number;
    height?: number;
  };
  mediaState: {
    currentUrl: string | null;
    isLoading: boolean;
    error: boolean;
  };
}

export const MediaDebugPanel = ({ item, mediaState }: MediaDebugPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // HEIC detection utility
  const isHEICFile = (path?: string) => {
    if (!path) return false;
    const fileName = path.toLowerCase();
    return fileName.endsWith('.heic') || fileName.endsWith('.heif');
  };

  const isHEIC = isHEICFile(item.storage_path) || isHEICFile(item.file_path) || isHEICFile(item.path);

  return (
    <Card className="w-full max-w-2xl mx-auto mb-4">
      <div className="p-4">
        <Button
          variant="outline"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Bug className="h-4 w-4" />
            <span>Debug Info for {item.title || item.id || 'Unknown'}</span>
          </div>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        {isExpanded && (
          <div className="mt-4 space-y-4">
            {/* File Information */}
            <div>
              <h3 className="font-semibold mb-2">File Information</h3>
              <div className="space-y-1 text-sm">
                <div><strong>ID:</strong> {item.id || 'Generated'}</div>
                <div><strong>Type:</strong> {item.type}</div>
                <div><strong>Title:</strong> {item.title}</div>
                <div><strong>Is HEIC:</strong> 
                  <Badge variant={isHEIC ? 'destructive' : 'secondary'} className="ml-2">
                    {isHEIC ? 'YES' : 'NO'}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            {/* Path Information */}
            <div>
              <h3 className="font-semibold mb-2">Path Information</h3>
              <div className="space-y-1 text-sm">
                <div><strong>Storage Path:</strong> {item.storage_path || 'null'}</div>
                <div><strong>File Path:</strong> {item.file_path || 'null'}</div>
                <div><strong>Path:</strong> {item.path || 'null'}</div>
                <div><strong>Thumbnail Path:</strong> {item.thumbnail_path || 'null'}</div>
              </div>
            </div>

            <Separator />

            {/* Media State */}
            <div>
              <h3 className="font-semibold mb-2">Media Loading State</h3>
              <div className="space-y-1 text-sm">
                <div><strong>Current URL:</strong> 
                  {mediaState.currentUrl ? (
                    <span className="text-green-600 break-all">{mediaState.currentUrl}</span>
                  ) : (
                    <span className="text-red-600">null</span>
                  )}
                </div>
                <div><strong>Is Loading:</strong> 
                  <Badge variant={mediaState.isLoading ? 'default' : 'secondary'} className="ml-2">
                    {mediaState.isLoading ? 'YES' : 'NO'}
                  </Badge>
                </div>
                <div><strong>Has Error:</strong> 
                  <Badge variant={mediaState.error ? 'destructive' : 'secondary'} className="ml-2">
                    {mediaState.error ? 'YES' : 'NO'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Best Path Logic */}
            <Separator />
            <div>
              <h3 className="font-semibold mb-2">Expected Best Path Logic</h3>
              <div className="space-y-1 text-sm">
                <div><strong>Priority 1:</strong> {item.path || item.storage_path || 'null'}</div>
                <div><strong>Priority 2 (fallback):</strong> {item.type === 'image' ? `processed/${item.id || 'unknown'}/image.webp` : `processed/${item.id || 'unknown'}/video.mp4`}</div>
              </div>
            </div>

            {/* Expected Behavior */}
            <Separator />
            <div>
              <h3 className="font-semibold mb-2">Expected Behavior</h3>
              <div className="space-y-1 text-sm">
                {isHEIC ? (
                  <div className="text-orange-600">
                    <strong>HEIC File:</strong> Should call fast-secure-media with format conversion to WebP
                  </div>
                ) : (
                  <div className="text-blue-600">
                    <strong>Regular File:</strong> Should use Supabase storage transforms
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};