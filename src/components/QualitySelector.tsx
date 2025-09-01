import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, Play, Download } from 'lucide-react';

interface QualityOption {
  label: string;
  value: string;
  resolution?: string;
  available?: boolean;
}

interface QualitySelectorProps {
  currentQuality: string;
  onQualityChange: (quality: string) => void;
  availableQualities?: string[];
  className?: string;
  showDownload?: boolean;
  onDownload?: (quality: string) => void;
}

const QUALITY_OPTIONS: QualityOption[] = [
  { label: 'Original', value: 'original', available: true },
  { label: '4K', value: '2160p', resolution: '3840×2160', available: false },
  { label: '1080p', value: '1080p', resolution: '1920×1080', available: false },
  { label: '720p', value: '720p', resolution: '1280×720', available: false },
  { label: '480p', value: '480p', resolution: '854×480', available: false },
];

export const QualitySelector: React.FC<QualitySelectorProps> = ({
  currentQuality,
  onQualityChange,
  availableQualities = ['original'],
  className = '',
  showDownload = false,
  onDownload
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const filteredQualities = QUALITY_OPTIONS.filter(option => 
    availableQualities.includes(option.value)
  );

  const currentOption = QUALITY_OPTIONS.find(option => option.value === currentQuality);

  const handleQualitySelect = (quality: string) => {
    onQualityChange(quality);
    setIsOpen(false);
  };

  const handleDownload = (quality: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDownload?.(quality);
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="min-w-[120px] justify-between"
          >
            <div className="flex items-center gap-2">
              <Settings className="h-3 w-3" />
              <span className="font-medium">
                {currentOption?.label || 'Original'}
              </span>
            </div>
            {currentOption?.resolution && (
              <Badge variant="secondary" className="text-xs">
                {currentOption.resolution}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {filteredQualities.map((option) => (
            <DropdownMenuItem
              key={option.value}
              className="flex items-center justify-between cursor-pointer"
              onClick={() => handleQualitySelect(option.value)}
            >
              <div className="flex items-center gap-2">
                <Play className="h-3 w-3" />
                <div className="flex flex-col">
                  <span className="font-medium">{option.label}</span>
                  {option.resolution && (
                    <span className="text-xs text-muted-foreground">
                      {option.resolution}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {option.value === currentQuality && (
                  <Badge variant="default" className="text-xs">
                    Current
                  </Badge>
                )}
                {showDownload && onDownload && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => handleDownload(option.value, e)}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {currentOption?.resolution && (
        <Badge variant="outline" className="text-xs">
          {currentOption.resolution}
        </Badge>
      )}
    </div>
  );
};