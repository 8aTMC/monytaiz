import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
      <DialogContent className="sm:max-w-[500px] bg-gradient-card border-border/50">
        <div className="flex flex-col items-center space-y-8 py-8">
          {/* Large Avatar */}
          <div className="relative">
            <Avatar className="h-36 w-36 border-4 border-primary/20 shadow-glow ring-2 ring-primary/10">
              <AvatarImage 
                src={collaborator.profile_picture_url} 
                className="object-cover" 
              />
              <AvatarFallback className="text-4xl font-bold bg-gradient-primary text-primary-foreground">
                {collaborator.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-gradient-primary border-2 border-background shadow-soft" />
          </div>

          {/* Name */}
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              {collaborator.name}
            </h2>
            <div className="h-px w-16 bg-gradient-primary mx-auto opacity-60" />
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