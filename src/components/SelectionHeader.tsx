import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckSquare, Square } from 'lucide-react';

interface SelectionHeaderProps {
  totalFiles: number;
  selectedCount: number;
  allSelected: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

export const SelectionHeader = ({
  totalFiles,
  selectedCount,
  allSelected,
  onSelectAll,
  onClearSelection
}: SelectionHeaderProps) => {
  if (totalFiles === 0) return null;

  return (
    <div className="flex items-center justify-between py-2 mb-3 border-b border-border/40">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={allSelected ? onClearSelection : onSelectAll}
          className="flex items-center gap-2 h-8"
        >
          {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          {allSelected ? 'Deselect All' : 'Select All'}
        </Button>
        
        <span className="text-sm text-muted-foreground">
          {selectedCount > 0 ? (
            <span className="font-medium text-foreground">
              {selectedCount} of {totalFiles} selected
            </span>
          ) : (
            `${totalFiles} file${totalFiles !== 1 ? 's' : ''}`
          )}
        </span>
      </div>
      
      {selectedCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="text-muted-foreground hover:text-foreground h-8"
        >
          Clear Selection
        </Button>
      )}
    </div>
  );
};