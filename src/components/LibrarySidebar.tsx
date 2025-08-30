import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, GripVertical, MoreVertical } from 'lucide-react';
import { NewFolderDialog } from '@/components/NewFolderDialog';
import { EditFolderDialog } from '@/components/EditFolderDialog';

interface CategoryItem {
  id: string;
  label: string;
  icon: any;
  description: string;
  isDefault: boolean;
}

interface LibrarySidebarProps {
  defaultCategories: CategoryItem[];
  customFolders: CategoryItem[];
  selectedCategory: string;
  categoryCounts: Record<string, number>;
  onCategorySelect: (categoryId: string) => void;
  onFolderCreated: () => void;
  onFolderUpdated: () => void;
}

export const LibrarySidebar = ({
  defaultCategories,
  customFolders,
  selectedCategory,
  categoryCounts,
  onCategorySelect,
  onFolderCreated,
  onFolderUpdated
}: LibrarySidebarProps) => {
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const sortedCustomFolders = sortOrder
    ? [...customFolders].sort((a, b) =>
        sortOrder === 'asc'
          ? a.label.localeCompare(b.label)
          : b.label.localeCompare(a.label)
      )
    : customFolders;

  // ---- Reusable row (used for both default categories & custom folders)
  const Row = ({
    item,
    isSelected,
    count,
    leftPad = false,
    showHandle = false,
    onClick,
    rightMenu
  }: {
    item: CategoryItem;
    isSelected: boolean;
    count: number;
    leftPad?: boolean;
    showHandle?: boolean;
    onClick?: () => void;
    rightMenu?: React.ReactNode;
  }) => {
    const Icon = item.icon;
    return (
      <div className="relative group">
        {/* counter */}
        <Badge
          variant="secondary"
          className={`absolute top-1.5 right-1.5 rounded-full text-[10px] px-1.5 h-4 min-w-[16px] flex items-center justify-center pointer-events-none transition-all ${
            isSelected
              ? 'bg-white/20 text-white border-white/20'
              : 'bg-primary/10 text-primary border-primary/20 group-hover:bg-primary/20'
          }`}
        >
          {count || 0}
        </Badge>

        {/* kebab / edit */}
        {rightMenu}

        <Button
          variant={isSelected ? 'default' : 'ghost'}
          className={`w-full justify-start text-left h-auto p-2.5 pr-10 ${
            leftPad ? 'pl-9' : ''
          } min-w-0 relative overflow-hidden transition-all ${
            isSelected
              ? 'bg-gradient-primary shadow-shadow-soft border-0'
              : 'hover:bg-gradient-glass hover:shadow-shadow-soft/50 border border-transparent hover:border-border'
          }`}
          onClick={onClick}
          disabled={showHandle}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            {showHandle && (
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            )}

            {/* Only show icon for default categories, not custom folders */}
            {item.isDefault && (
              <div
                className={`p-1.5 rounded-lg flex-shrink-0 transition ${
                  isSelected ? 'bg-white/20' : 'bg-primary/10 group-hover:bg-primary/20'
                }`}
              >
                {Icon && (
                  <Icon
                    className={`h-4 w-4 ${
                      isSelected ? 'text-white' : 'text-primary'
                    }`}
                  />
                )}
              </div>
            )}

            <div className="flex flex-col items-start min-w-0 flex-1 overflow-hidden leading-tight">
              <span
                className={`font-medium text-left w-full truncate ${
                  isSelected ? 'text-white' : 'text-foreground'
                }`}
                title={item.label}
              >
                {item.label}
              </span>

              {/* 2-line subtitle (≈40 chars) */}
              <span
                className={`text-xs text-left w-full line-clamp-2 ${
                  isSelected ? 'text-white/85' : 'text-muted-foreground'
                }`}
                title={item.description}
              >
                {item.description}
              </span>
            </div>
          </div>
        </Button>
      </div>
    );
  };

  return (
    <div className="w-64 flex-shrink-0 overflow-hidden relative border-r border-border h-full">
      <div className="absolute inset-0 bg-gradient-sidebar" />
      {/* moved significantly closer to navigation */}
      <div className="relative h-full overflow-y-auto custom-scrollbar pl-2 pr-3 py-4 -ml-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground mb-0.5 bg-gradient-primary bg-clip-text text-transparent">
            Library
          </h2>
          <p className="text-xs text-muted-foreground">Manage your content</p>
        </div>

        {/* Default categories (more compact, consistent with custom) */}
        <div className="space-y-1.5 mb-5">
          {defaultCategories.map((category) => {
            const isSelected = selectedCategory === category.id;
            return (
              <Row
                key={category.id}
                item={category}
                isSelected={isSelected}
                count={categoryCounts[category.id] || 0}
                onClick={() => onCategorySelect(category.id)}
              />
            );
          })}
        </div>

        {/* Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-border to-transparent h-px" />
          <div className="relative flex justify-center" />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mb-4">
          <NewFolderDialog onFolderCreated={onFolderCreated} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsReorderMode(!isReorderMode)}
            disabled={customFolders.length === 0}
            className="text-xs px-2 h-7 flex-shrink-0 hover:bg-gradient-glass transition"
            title="Reorder"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Custom folders */}
        {sortedCustomFolders.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[11px] font-medium tracking-wide text-muted-foreground">
                My Folders
              </div>
            </div>

            {sortedCustomFolders.map((folder, index) => {
              const isSelected = selectedCategory === folder.id;

              return (
                <div key={folder.id} className="relative">
                  {/* three-dots edit trigger (absolute, elegant) */}
                  {!isReorderMode && (
                    <div className="absolute top-1 left-1 z-10">
                      {/* If your EditFolderDialog accepts `trigger`, use this: */}
                      <EditFolderDialog
                        folder={{ id: folder.id, label: folder.label }}
                        onFolderUpdated={onFolderUpdated}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        }
                      />
                      {/* If it doesn't support `trigger`, replace the component above
                          with your own menu/button that calls the dialog internally,
                          or style the existing EditFolderDialog to render only the icon. */}
                    </div>
                  )}

                  <Row
                    item={folder}
                    isSelected={isSelected}
                    count={categoryCounts[folder.id] || 0}
                    leftPad={!isReorderMode} // room for kebab icon
                    showHandle={isReorderMode}
                    onClick={() => {
                      if (!isReorderMode) onCategorySelect(folder.id);
                    }}
                  />

                  {/* subtle divider between folders */}
                  <div className="h-px mx-1 bg-border/30" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
