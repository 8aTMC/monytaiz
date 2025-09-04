import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';

interface CollaboratorDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collaborator: {
    id: string;
    name: string;
    url: string;
    description?: string;
    profile_picture_url?: string;
  } | null;
}

export function CollaboratorDetailDialog({ 
  open, 
  onOpenChange, 
  collaborator 
}: CollaboratorDetailDialogProps) {
  if (!collaborator) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] z-[90]">
        <DialogHeader>
          <DialogTitle className="sr-only">Collaborator Details</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-6 py-4">
          {/* Large Avatar */}
          <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
            <AvatarImage 
              src={collaborator.profile_picture_url} 
              className="object-cover" 
            />
            <AvatarFallback className="text-2xl font-semibold bg-muted">
              {collaborator.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          {/* Name */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">
              {collaborator.name}
            </h2>
          </div>

          {/* URL */}
          <div className="flex items-center space-x-2">
            <Badge 
              variant="outline" 
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => window.open(collaborator.url, '_blank')}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Visit Profile
            </Badge>
          </div>

          {/* About Section */}
          {collaborator.description && (
            <div className="w-full space-y-3">
              <h3 className="text-lg font-semibold text-foreground">About</h3>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {collaborator.description}
                </p>
              </div>
            </div>
          )}

          {!collaborator.description && (
            <div className="w-full space-y-3">
              <h3 className="text-lg font-semibold text-foreground">About</h3>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground italic">
                  No description available
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}