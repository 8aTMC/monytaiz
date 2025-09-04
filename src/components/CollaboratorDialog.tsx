import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Upload, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface CollaboratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCollaboratorCreated: (collaborator: { name: string; url: string; profile_picture_url?: string }) => void;
}

export function CollaboratorDialog({ open, onOpenChange, onCollaboratorCreated }: CollaboratorDialogProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [crop, setCrop] = useState<Crop>({ unit: '%', width: 90, height: 90, x: 5, y: 5 });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [imgRef, setImgRef] = useState<HTMLImageElement | null>(null);
  const { toast } = useToast();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        const reader = new FileReader();
        reader.onload = () => {
          setImageSrc(reader.result as string);
          setShowCropDialog(true);
        };
        reader.readAsDataURL(file);
      }
    }
  });

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const crop: Crop = {
      unit: 'px',
      width: Math.min(width, height),
      height: Math.min(width, height),
      x: (width - Math.min(width, height)) / 2,
      y: (height - Math.min(width, height)) / 2,
    };
    setCrop(crop);
    setImgRef(e.currentTarget);
  };

  const getCroppedImg = (image: HTMLImageElement, crop: PixelCrop): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('No 2d context');
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Set canvas size to 512x512 for consistent square output
    canvas.width = 512;
    canvas.height = 512;

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

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            throw new Error('Canvas is empty');
          }
          resolve(blob);
        },
        'image/webp',
        0.8
      );
    });
  };

  const handleCropComplete = async () => {
    if (!imgRef || !completedCrop) return;

    try {
      setUploading(true);
      const croppedImageBlob = await getCroppedImg(imgRef, completedCrop);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const fileName = `${user.id}-${Date.now()}.webp`;
      const filePath = `collaborators/${fileName}`;

      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedImageBlob, {
          contentType: 'image/webp',
          upsert: false
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(data.path);

      setProfileImageUrl(publicUrl);
      setShowCropDialog(false);
      setImageSrc('');
      toast({
        title: "Success",
        description: "Profile picture cropped and uploaded successfully"
      });
    } catch (error) {
      console.error('Error cropping image:', error);
      toast({
        title: "Error",
        description: "Failed to process image",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCancelCrop = () => {
    setShowCropDialog(false);
    setImageSrc('');
    setCrop({ unit: '%', width: 90, height: 90, x: 5, y: 5 });
    setCompletedCrop(undefined);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !url.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and URL are required fields",
        variant: "destructive"
      });
      return;
    }

    setCreating(true);
    try {
      onCollaboratorCreated({
        name: name.trim(),
        url: url.trim(),
        profile_picture_url: profileImageUrl || undefined
      });

      // Reset form
      setName('');
      setUrl('');
      setProfileImage(null);
      setProfileImageUrl('');
      onOpenChange(false);

      toast({
        title: "Success",
        description: "Collaborator added successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create collaborator",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  const removeImage = () => {
    setProfileImage(null);
    setProfileImageUrl('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Collaborator</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Profile Picture Upload */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Profile Picture (Optional)</Label>
            
            {profileImageUrl ? (
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={profileImageUrl} />
                  <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={removeImage}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                  ${isDragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                  }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {isDragActive
                    ? "Drop the image here..."
                    : "Drag & drop an image here, or click to select"
                  }
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, WebP up to 10MB (will be optimized)
                </p>
              </div>
            )}
          </div>

          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="collaborator-name" className="text-sm font-medium">
              Name *
            </Label>
            <Input
              id="collaborator-name"
              placeholder="Enter collaborator name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">
              {name.length}/50 characters
            </p>
          </div>

          {/* URL Field */}
          <div className="space-y-2">
            <Label htmlFor="collaborator-url" className="text-sm font-medium">
              URL *
            </Label>
            <Input
              id="collaborator-url"
              placeholder="https://example.com/profile"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              type="url"
            />
            <p className="text-xs text-muted-foreground">
              Link to their profile, portfolio, or social media
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={creating || uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={creating || uploading || !name.trim() || !url.trim()}
            >
              {creating ? 'Creating...' : uploading ? 'Uploading...' : 'Add Collaborator'}
            </Button>
          </div>
        </div>

        {/* Crop Dialog */}
        <Dialog open={showCropDialog} onOpenChange={(open) => !open && handleCancelCrop()}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Crop Profile Picture</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Drag to reposition and resize the crop area to create a square profile picture.
              </p>
              
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
                    ref={setImgRef}
                    src={imageSrc}
                    alt="Crop me"
                    style={{ maxWidth: '100%', maxHeight: '400px' }}
                    onLoad={onImageLoad}
                  />
                </ReactCrop>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCancelCrop} disabled={uploading}>
                  Cancel
                </Button>
                <Button onClick={handleCropComplete} disabled={uploading || !completedCrop}>
                  {uploading ? 'Processing...' : 'Apply Crop'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}