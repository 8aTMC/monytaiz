import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, XCircle, ArrowRight, Info } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export const FileFormatInfo = () => {
  const { t } = useTranslation();

  const supportedFormats = {
    audio: {
      formats: ['mp3', 'ogg', 'wav', 'opus', 'aac'],
      conversion: 'WebM/Opus',
      description: 'All audio files are converted to WebM format with Opus codec for optimal streaming and reduced file size.'
    },
    image: {
      formats: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic', 'heif'],
      conversion: 'WebP',
      description: 'Images are converted to WebP format at 80% quality for faster loading while maintaining visual quality. HEIC/HEIF files are converted client-side.'
    },
    video: {
      formats: ['mov', 'mp4', 'mkv', 'webm'],
      conversion: 'Original Format',
      description: 'Videos are uploaded in their original format with backend processing for multiple quality levels.'
    }
  };

  const unsupportedFormats = [
    { format: 'tiff/tif', reason: 'Complex format, limited browser support' },
    { format: 'avif', reason: 'Advanced image format with limited browser support' },
    { format: 'avi', reason: 'Legacy video format, large file sizes' },
    { format: 'flv', reason: 'Flash video format, deprecated' },
    { format: 'wmv', reason: 'Proprietary Windows format' },
    { format: 'flac', reason: 'Lossless audio format, very large file sizes' },
    { format: 'hevc/h265', reason: 'Patent-encumbered codec' }
  ];

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          {t('fileFormats.title', 'Supported File Formats')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Supported Formats */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">
            {t('fileFormats.supported', 'Supported Formats')}
          </h3>
          
          {Object.entries(supportedFormats).map(([type, info]) => (
            <div key={type} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="font-medium capitalize text-foreground">{type}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Converts to</span>
                  <ArrowRight className="h-4 w-4" />
                  <Badge variant="secondary">{info.conversion}</Badge>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {info.formats.map(format => (
                  <Badge key={format} variant="outline" className="text-xs">
                    .{format}
                  </Badge>
                ))}
              </div>
              
              <p className="text-sm text-muted-foreground">
                {info.description}
              </p>
            </div>
          ))}
        </div>

        <Separator />

        {/* Unsupported Formats */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">
            {t('fileFormats.unsupported', 'Unsupported Formats')}
          </h3>
          
          <div className="grid gap-3">
            {unsupportedFormats.map(({ format, reason }) => (
              <div key={format} className="flex items-center justify-between p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <Badge variant="destructive" className="text-xs">
                    .{format}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  {reason}
                </span>
              </div>
            ))}
          </div>
          
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Note:</strong> Unsupported files will be automatically filtered out during upload with an error message. Only supported formats will be processed.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};