import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Upload, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCollaborators } from '@/hooks/useCollaborators';
import { ImageCropDialog } from './ImageCropDialog';

interface CollaboratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCollaboratorCreated: (collaborator: { name: string; url: string; description?: string; profile_picture_url?: string }) => void;
}

export function CollaboratorDialog({ open, onOpenChange, onCollaboratorCreated }: CollaboratorDialogProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState<string>('');
  const [profileImageBlob, setProfileImageBlob] = useState<Blob | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [cropCompleted, setCropCompleted] = useState(false);
  const { toast } = useToast();
  const { createCollaborator } = useCollaborators();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024, // 20MB limit
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        
        // Validate file size
        if (file.size > 20 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: "Please select an image smaller than 20MB",
            variant: "destructive"
          });
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          setImageSrc(reader.result as string);
          setShowCropDialog(true);
        };
        reader.onerror = () => {
          toast({
            title: "Error",
            description: "Failed to read the selected file",
            variant: "destructive"
          });
        };
        reader.readAsDataURL(file);
      }
    },
    onDropRejected: (fileRejections) => {
      const error = fileRejections[0]?.errors[0];
      if (error?.code === 'file-too-large') {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 20MB",
          variant: "destructive"
        });
      } else if (error?.code === 'file-invalid-type') {
        toast({
          title: "Invalid file type",
          description: "Please select a valid image file (JPEG, PNG, WebP)",
          variant: "destructive"
        });
      }
    }
  });

  const handleCropComplete = async (imageBlob: Blob) => {
    setProfileImageBlob(imageBlob);
    // Convert blob to data URL to avoid blob URL lifecycle issues
    try {
      const reader = new FileReader();
      reader.onload = () => {
        setProfileImageUrl(reader.result as string);
      };
      reader.readAsDataURL(imageBlob);
    } catch (error) {
      console.warn('Failed to create preview URL:', error);
    }
    setCropCompleted(true);
    setShowCropDialog(false); // Close crop dialog after state is updated
  };

  const handleCropCancel = () => {
    setImageSrc('');
    setProfileImageBlob(null);
    setProfileImageUrl('');
    setCropCompleted(false);
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
      let finalProfileUrl = null;
      
      // Upload image if we have a cropped blob
      if (profileImageBlob) {
        const timestamp = Date.now();
        const fileName = `collaborator_${timestamp}.webp`;
        const filePath = `collaborators/${fileName}`;

        // Retry upload logic
        let uploadAttempts = 0;
        const maxRetries = 3;
        let uploadData, uploadError;

        while (uploadAttempts < maxRetries) {
          uploadAttempts++;
          
          const uploadResult = await supabase.storage
            .from('avatars')
            .upload(filePath, profileImageBlob, {
              contentType: 'image/webp',
              upsert: false
            });

          uploadData = uploadResult.data;
          uploadError = uploadResult.error;

          if (!uploadError) break;

          console.warn(`Upload attempt ${uploadAttempts} failed:`, uploadError);
          
          if (uploadAttempts < maxRetries) {
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * uploadAttempts));
          }
        }

        if (uploadError) {
          throw new Error(`Upload failed after ${maxRetries} attempts: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(uploadData.path);
        
        finalProfileUrl = publicUrl;
      }

      const collaboratorData = {
        name: name.trim(),
        url: url.trim(),
        description: description.trim() || null,
        profile_picture_url: finalProfileUrl
      };

      await createCollaborator(collaboratorData);
      onCollaboratorCreated(collaboratorData);

      // Reset form
      setName('');
      setUrl('');
      setDescription('');
      setProfileImageUrl('');
      setProfileImageBlob(null);
      onOpenChange(false);

      toast({
        title: "Success",
        description: "Collaborator added successfully"
      });
    } catch (error) {
      console.error('Error creating collaborator:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message.includes('Upload failed') 
          ? "Failed to upload profile picture. Please try a smaller image or check your connection."
          : error.message.includes('timeout') || error.message.includes('network')
            ? "Network connection error. Please check your internet connection and try again."
            : "Failed to create collaborator. Please try again."
        : "Failed to create collaborator. Please try again.";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  const removeImage = () => {
    setProfileImageUrl('');
    setProfileImageBlob(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Collaborator</DialogTitle>
          <DialogDescription>
            Add a new collaborator with their profile information and optional profile picture.
          </DialogDescription>
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
                  PNG, JPG, WebP up to 20MB (will be optimized)
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

          {/* Description Field */}
          <div className="space-y-2">
            <Label htmlFor="collaborator-description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="collaborator-description"
              placeholder="Brief description about this collaborator..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px] resize-none"
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/200 characters
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={creating || !name.trim() || !url.trim()}
            >
              {creating ? 'Creating...' : 'Add Collaborator'}
            </Button>
          </div>
        </div>

      {/* Separate Crop Dialog */}
      <ImageCropDialog
        open={showCropDialog}
        onOpenChange={(open) => {
          setShowCropDialog(open);
          if (!open && !cropCompleted) {
            // Only cancel if crop wasn't completed successfully
            handleCropCancel();
          } else if (!open && cropCompleted) {
            // Clean up after successful crop
            setImageSrc('');
            setCropCompleted(false);
          }
        }}
        imageSrc={imageSrc}
        onCropComplete={handleCropComplete}
      />
      </DialogContent>
    </Dialog>
  );
}