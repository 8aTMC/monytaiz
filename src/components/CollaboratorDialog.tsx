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
  const { toast } = useToast();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setProfileImage(acceptedFiles[0]);
        setProfileImageUrl(URL.createObjectURL(acceptedFiles[0]));
      }
    }
  });

  const uploadProfileImage = async (file: File): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = `collaborators/${fileName}`;

    // Convert to WebP and compress
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    return new Promise((resolve, reject) => {
      img.onload = async () => {
        // Resize to max 150px while maintaining aspect ratio
        const maxSize = 150;
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(async (blob) => {
          if (!blob) {
            reject(new Error('Failed to convert image'));
            return;
          }

          try {
            const { data, error } = await supabase.storage
              .from('content')
              .upload(filePath, blob, {
                contentType: 'image/webp',
                upsert: false
              });

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
              .from('content')
              .getPublicUrl(data.path);

            resolve(publicUrl);
          } catch (error) {
            reject(error);
          }
        }, 'image/webp', 0.8);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
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
      let uploadedImageUrl = '';
      
      if (profileImage) {
        setUploading(true);
        uploadedImageUrl = await uploadProfileImage(profileImage);
        setUploading(false);
      }

      onCollaboratorCreated({
        name: name.trim(),
        url: url.trim(),
        profile_picture_url: uploadedImageUrl || undefined
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
      setUploading(false);
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
      </DialogContent>
    </Dialog>
  );
}