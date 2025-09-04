import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ProfilePicturePreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  name: string;
}

export function ProfilePicturePreview({ open, onOpenChange, imageUrl, name }: ProfilePicturePreviewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] p-0 border-none bg-transparent shadow-none">
        <div className="flex items-center justify-center">
          <Avatar className="h-80 w-80 border-4 border-background shadow-lg">
            <AvatarImage src={imageUrl} className="object-cover" />
            <AvatarFallback className="text-6xl font-semibold bg-muted">
              {name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </DialogContent>
    </Dialog>
  );
}