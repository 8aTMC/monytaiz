import React, { useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FullscreenImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title?: string;
}

export const FullscreenImageViewer: React.FC<FullscreenImageViewerProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title
}) => {
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyPress);
      // Prevent scrolling on body when fullscreen is open
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.removeEventListener('keydown', handleKeyPress);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, handleKeyPress]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClose}
        className="absolute top-4 right-4 z-[10000] text-white hover:bg-white/20 bg-black/50 backdrop-blur-sm"
      >
        <X className="w-5 h-5" />
      </Button>
      
      {/* Image container */}
      <div
        className="w-full h-full flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt={title || 'Fullscreen image'}
          className="max-w-full max-h-full object-contain"
          style={{ maxWidth: '100vw', maxHeight: '100vh' }}
        />
      </div>
      
      {/* Title overlay */}
      {title && (
        <div className="absolute bottom-4 left-4 right-4 text-center">
          <div className="bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm truncate max-w-md mx-auto">
            {title}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};