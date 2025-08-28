import React, { useState, useCallback, useRef } from 'react';
import ReactCrop, { 
  Crop, 
  PixelCrop, 
  centerCrop, 
  makeAspectCrop 
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Upload, Crop as CropIcon, X, Check } from 'lucide-react';

interface AvatarCropperProps {
  currentAvatarUrl: string;
  onAvatarChange: (url: string) => void;
  fallbackText: string;
}

export const AvatarCropper: React.FC<AvatarCropperProps> = ({
  currentAvatarUrl,
  onAvatarChange,
  fallbackText
}) => {
  const { toast } = useToast();
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [uploading, setUploading] = useState(false);
  const [cropping, setCropping] = useState(false);
  
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large", 
          description: "Please select an image smaller than 5MB",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImgSrc(reader.result?.toString() || '');
        setCropDialogOpen(true);
      });
      reader.readAsDataURL(file);
    }
  }, [toast]);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    
    // Create a square crop centered in the image
    const crop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        1, // Aspect ratio 1:1 for square
        width,
        height,
      ),
      width,
      height,
    );
    setCrop(crop);
  }, []);

  const getCroppedImg = useCallback(
    async (image: HTMLImageElement, pixelCrop: PixelCrop): Promise<Blob | null> => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        return null;
      }

      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      // Set canvas size to desired output size (512x512 for avatars)
      const outputSize = 512;
      canvas.width = outputSize;
      canvas.height = outputSize;

      ctx.drawImage(
        image,
        pixelCrop.x * scaleX,
        pixelCrop.y * scaleY,
        pixelCrop.width * scaleX,
        pixelCrop.height * scaleY,
        0,
        0,
        outputSize,
        outputSize,
      );

      return new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.9);
      });
    },
    []
  );

  const handleCropComplete = useCallback(async () => {
    if (!imgRef.current || !completedCrop) {
      toast({
        title: "Error",
        description: "Please select a crop area",
        variant: "destructive",
      });
      return;
    }

    setCropping(true);
    try {
      const croppedImageBlob = await getCroppedImg(imgRef.current, completedCrop);
      
      if (!croppedImageBlob) {
        throw new Error('Failed to crop image');
      }

      // Upload to Supabase storage
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileName = `avatar_${user.id}_${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, croppedImageBlob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(uploadData.path);

      onAvatarChange(publicUrl);
      setCropDialogOpen(false);
      setImgSrc('');
      
      toast({
        title: "Success",
        description: "Avatar uploaded successfully",
      });
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      console.error('Error processing avatar:', error);
      toast({
        title: "Error",
        description: "Failed to process avatar image",
        variant: "destructive",
      });
    } finally {
      setCropping(false);
      setUploading(false);
    }
  }, [completedCrop, getCroppedImg, onAvatarChange, toast]);

  const handleCancelCrop = useCallback(() => {
    setCropDialogOpen(false);
    setImgSrc('');
    setCrop(undefined);
    setCompletedCrop(undefined);
    
    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-16 w-16">
        <AvatarImage src={currentAvatarUrl} />
        <AvatarFallback>
          {fallbackText ? fallbackText[0].toUpperCase() : 'C'}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex flex-col gap-2">
        <Label>Profile Picture</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? 'Uploading...' : 'Upload Image'}
          </Button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Recommended: Square image, max 5MB
        </p>
      </div>

      {/* Crop Dialog */}
      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CropIcon className="h-5 w-5" />
              Crop Avatar
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Drag to adjust the crop area. The image will be resized to a square format.
            </p>
            
            {imgSrc && (
              <div className="max-h-[400px] overflow-auto">
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={1}
                  minWidth={50}
                  minHeight={50}
                  keepSelection
                >
                  <img
                    ref={imgRef}
                    alt="Crop me"
                    src={imgSrc}
                    onLoad={onImageLoad}
                    className="max-w-full h-auto"
                  />
                </ReactCrop>
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancelCrop}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button 
                onClick={handleCropComplete}
                disabled={!completedCrop || cropping}
              >
                <Check className="h-4 w-4 mr-2" />
                {cropping ? 'Processing...' : 'Apply Crop'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};