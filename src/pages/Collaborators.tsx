import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Search, UserCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollaborators } from '@/hooks/useCollaborators';
import { CollaboratorDialog } from '@/components/CollaboratorDialog';
import { CollaboratorDetailDialog } from '@/components/CollaboratorDetailDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Collaborators() {
  const { collaborators, loading, createCollaborator, deleteCollaborator, searchCollaborators } = useCollaborators();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedCollaborator, setSelectedCollaborator] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [collaboratorToDelete, setCollaboratorToDelete] = useState<{ id: string; name: string } | null>(null);

  const filteredCollaborators = searchQuery ? searchCollaborators(searchQuery) : collaborators;

  const handleCreateCollaborator = async (collaboratorData: { name: string; url: string; description?: string; profile_picture_url?: string }) => {
    await createCollaborator(collaboratorData);
    setShowCreateDialog(false);
  };

  const handleDeleteCollaborator = (id: string, name: string) => {
    setCollaboratorToDelete({ id, name });
    setShowDeleteDialog(true);
  };

  const confirmDeleteCollaborator = async () => {
    if (collaboratorToDelete) {
      await deleteCollaborator(collaboratorToDelete.id);
      setShowDeleteDialog(false);
      setCollaboratorToDelete(null);
    }
  };

  const handleCollaboratorClick = (collaborator: any) => {
    setSelectedCollaborator(collaborator);
    setShowDetailDialog(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Collaborators</h1>
          <p className="text-muted-foreground mt-1">
            Manage your collaborators and mentions for content tagging
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Collaborator
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search collaborators..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-muted rounded-full" />
                  <div className="space-y-2">
                    <div className="w-24 h-4 bg-muted rounded" />
                    <div className="w-32 h-3 bg-muted rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredCollaborators.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UserCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">
              {searchQuery ? 'No collaborators found' : 'No collaborators yet'}
            </CardTitle>
            <CardDescription className="text-center mb-4">
              {searchQuery 
                ? 'Try adjusting your search criteria'
                : 'Add your first collaborator to start organizing your content mentions'
              }
            </CardDescription>
            {!searchQuery && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Collaborator
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCollaborators.map((collaborator) => (
            <Card 
              key={collaborator.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleCollaboratorClick(collaborator)}
            >
              <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={collaborator.profile_picture_url} />
                      <AvatarFallback>
                        {collaborator.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base">{collaborator.name}</CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        @{collaborator.name.toLowerCase().replace(/\s+/g, '')}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCollaborator(collaborator.id, collaborator.name);
                    }}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    Delete
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Profile URL</p>
                    <a 
                      href={collaborator.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline break-all"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {collaborator.url}
                    </a>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Added {new Date(collaborator.created_at).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CollaboratorDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCollaboratorCreated={handleCreateCollaborator}
      />

      <CollaboratorDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        collaborator={selectedCollaborator}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Collaborator</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{collaboratorToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteCollaborator}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}