import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AtSign, Hash, FolderOpen, CheckSquare, Square, X, Save } from 'lucide-react';
import { MentionsDialog } from './MentionsDialog';
import { TagsDialog } from './TagsDialog';
import { FolderSelectDialog } from './FolderSelectDialog';
import { FileUploadItem } from '@/hooks/useFileUpload';
import { useToast } from '@/hooks/use-toast';

interface BatchMetadataToolbarProps {
  selectedCount: number;
  allSelected: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onUpdateMetadata: (metadata: Partial<FileUploadItem['metadata']>) => void;
}

export const BatchMetadataToolbar = ({
  selectedCount,
  allSelected,
  onSelectAll,
  onClearSelection,
  onUpdateMetadata
}: BatchMetadataToolbarProps) => {
  const [mentionsDialogOpen, setMentionsDialogOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [foldersDialogOpen, setFoldersDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleSave = () => {
    onClearSelection();
    toast({
      title: "Batch changes applied",
      description: `Metadata updated for ${selectedCount} files`,
      variant: "success",
    });
  };

  return (
    <>
      <Card className="p-4 mb-4 bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onSelectAll}
                className="flex items-center gap-1"
              >
                {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                {allSelected ? 'Deselect All' : 'Select All'}
              </Button>
              <span className="text-sm font-medium">
                {selectedCount} file{selectedCount !== 1 ? 's' : ''} selected
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMentionsDialogOpen(true)}
                className="flex items-center gap-1"
              >
                <AtSign className="w-4 h-4" />
                Add Mentions
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTagsDialogOpen(true)}
                className="flex items-center gap-1"
              >
                <Hash className="w-4 h-4" />
                Add Tags
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFoldersDialogOpen(true)}
                className="flex items-center gap-1"
              >
                <FolderOpen className="w-4 h-4" />
                Add to Folders
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClearSelection}
              className="flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Cancel Selection
            </Button>
            
            <Button
              size="sm"
              onClick={handleSave}
              className="flex items-center gap-1"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </Button>
          </div>
        </div>
      </Card>

      {/* Batch metadata dialogs */}
      <MentionsDialog
        open={mentionsDialogOpen}
        onOpenChange={setMentionsDialogOpen}
        mentions={[]}
        onMentionsChange={(mentions) => {
          onUpdateMetadata({ mentions });
          setMentionsDialogOpen(false);
        }}
      />
      
      <TagsDialog
        open={tagsDialogOpen}
        onOpenChange={setTagsDialogOpen}
        tags={[]}
        onTagsChange={(tags) => {
          onUpdateMetadata({ tags });
          setTagsDialogOpen(false);
        }}
      />
      
      <FolderSelectDialog
        open={foldersDialogOpen}
        onOpenChange={setFoldersDialogOpen}
        selectedFolders={[]}
        onFoldersChange={(folders) => {
          onUpdateMetadata({ folders });
          setFoldersDialogOpen(false);
        }}
      />
    </>
  );
};