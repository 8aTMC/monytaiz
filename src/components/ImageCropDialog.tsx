import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface ImageCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onCropComplete: (imageBlob: Blob) => void;
}

export function ImageCropDialog({ open, onOpenChange, imageSrc, onCropComplete }: ImageCropDialogProps) {
  const [crop, setCrop] = useState<Crop>({ unit: '%', width: 90, height: 90, x: 5, y: 5 });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const { toast } = useToast();

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    
    // Validate image dimensions
    if (width < 100 || height < 100) {
      toast({
        title: "Image too small",
        description: "Please use an image that's at least 100x100 pixels",
        variant: "destructive"
      });
      onOpenChange(false);
      return;
    }

    const crop: Crop = {
      unit: 'px',
      width: Math.min(width, height),
      height: Math.min(width, height),
      x: (width - Math.min(width, height)) / 2,
      y: (height - Math.min(width, height)) / 2,
    };
    setCrop(crop);
  };

  const getCroppedImg = async (image: HTMLImageElement, crop: PixelCrop): Promise<Blob> => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      // Set canvas size to 512x512 for consistent square output
      canvas.width = 512;
      canvas.height = 512;

      // Clear the canvas
      ctx.clearRect(0, 0, 512, 512);

      ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        512,
        512
      );

      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas is empty'));
              return;
            }
            resolve(blob);
          },
          'image/webp',
          0.8
        );
      });
    } catch (error) {
      throw new Error(`Failed to crop image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCropComplete = async () => {
    if (!imgRef.current || !completedCrop) {
      toast({
        title: "Error",
        description: "Please select a crop area",
        variant: "destructive"
      });
      return;
    }

    try {
      setUploading(true);
      setProcessing(true);
      
      const croppedImageBlob = await getCroppedImg(imgRef.current, completedCrop);
      
      // Return the blob directly - no upload here
      onCropComplete(croppedImageBlob);
      onOpenChange(false);
      
      toast({
        title: "Success",
        description: "Image cropped successfully"
      });
    } catch (error) {
      console.error('Error processing image:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to crop image",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setCrop({ unit: '%', width: 90, height: 90, x: 5, y: 5 });
    setCompletedCrop(undefined);
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Crop Profile Picture</DialogTitle>
          <DialogDescription>
            Drag to reposition and resize the crop area to create a square profile picture.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          
          <div className="flex justify-center">
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={1}
              minWidth={100}
              minHeight={100}
              keepSelection
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop me"
                style={{ maxWidth: '100%', maxHeight: '400px' }}
                onLoad={onImageLoad}
                onError={(e) => {
                  // Only show error if we're not in the middle of processing and src is not empty
                  if (!processing && imageSrc && imageSrc.trim() !== '') {
                    console.error('Image load error:', {
                      src: imageSrc,
                      error: e,
                      timestamp: new Date().toISOString()
                    });
                    toast({
                      title: "Error",
                      description: "Failed to load image for cropping. Please try selecting the image again.",
                      variant: "destructive"
                    });
                    onOpenChange(false);
                  }
                }}
              />
            </ReactCrop>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleCropComplete} disabled={uploading || !completedCrop}>
              {uploading ? 'Processing...' : 'Apply Crop'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}