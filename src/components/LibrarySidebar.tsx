import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, GripVertical, MoreVertical, Search } from 'lucide-react';
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
  const [searchTerm, setSearchTerm] = useState('');

  // Optimized search function - case insensitive matching of title and description
  const searchFolders = (folders: CategoryItem[], search: string): CategoryItem[] => {
    if (!search.trim()) return folders;
    
    const searchLower = search.toLowerCase().trim();
    return folders.filter(folder => 
      folder.label.toLowerCase().includes(searchLower) ||
      folder.description.toLowerCase().includes(searchLower)
    );
  };

  // Apply search first, then sorting
  const filteredFolders = searchFolders(customFolders, searchTerm);
  const sortedCustomFolders = sortOrder
    ? [...filteredFolders].sort((a, b) =>
        sortOrder === 'asc'
          ? a.label.localeCompare(b.label)
          : b.label.localeCompare(a.label)
      )
    : filteredFolders;

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
          className={`absolute top-1.5 right-1.5 rounded-full text-[10px] px-1.5 h-4 min-w-[16px] flex items-center justify-center pointer-events-none transition-all z-10 ${
            isSelected
              ? 'bg-white text-primary border-white shadow-sm'
              : 'bg-primary/10 text-primary border-primary/20 group-hover:bg-primary/20'
          }`}
        >
          {count || 0}
        </Badge>

        {/* kebab / edit */}
        {rightMenu}

        <Button
          variant={isSelected ? 'default' : 'ghost'}
          className={`w-full justify-start text-left h-auto p-2.5 pr-8 ${
            leftPad ? 'pl-9' : ''
          } min-w-0 relative transition-all ${
            isSelected
              ? 'bg-gradient-primary shadow-shadow-soft border-0'
              : 'hover:bg-gradient-glass hover:shadow-shadow-soft/50 border border-transparent hover:border-border'
          }`}
          onClick={onClick}
          disabled={showHandle}
        >
          <div className="flex items-center gap-2 flex-1">
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

            <div className="flex flex-col items-start flex-1 leading-tight" style={{ width: 'calc(100% - 32px)' }}>
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
                className={`text-xs leading-[1.3] text-left ${
                  isSelected ? 'text-white/80' : 'text-muted-foreground'
                }`}
                style={{ 
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  width: '100%'
                }}
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
    <div className="w-full flex-shrink-0 relative h-full border-r border-border" style={{ zIndex: 10 }}>
      <div className="absolute inset-0 bg-gradient-sidebar" />
      {/* Library directory content */}
      <div className="relative h-full overflow-y-auto custom-scrollbar px-4 py-4" style={{ minWidth: '100%' }}>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground mb-0.5 bg-gradient-primary bg-clip-text text-transparent ml-[10px]">
            Library
          </h2>
          <p className="text-xs text-muted-foreground ml-[10px]">Manage your content</p>
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
        <div className="mb-3 flex justify-center">
          <div className="flex items-center gap-1" style={{ width: 'calc(100% - 30px)' }}>
            <div className="flex-1">
              <NewFolderDialog onFolderCreated={onFolderCreated} />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReorderMode(!isReorderMode)}
              disabled={customFolders.length === 0}
              className="text-xs px-2 h-7 flex-1 hover:bg-gradient-glass transition"
            >
              <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
              Reorder
            </Button>
          </div>
        </div>

        {/* Search Field */}
        <div className="mb-4 flex justify-center">
          <div className="relative" style={{ width: 'calc(100% - 30px)' }}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search folders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Custom folders */}
        {sortedCustomFolders.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[11px] font-medium tracking-wide text-muted-foreground ml-[10px]">
                My Folders
              </div>
            </div>

            {sortedCustomFolders.map((folder, index) => {
              const isSelected = selectedCategory === folder.id;

              return (
                <div key={folder.id} className="relative">
                  {/* three-dots edit trigger (absolute, elegant) */}
                  {!isReorderMode && (
                    <div className="absolute top-1/2 left-1 -translate-y-1/2 z-10">
                      {/* If your EditFolderDialog accepts `trigger`, use this: */}
                      <EditFolderDialog
                        folder={{ 
                          id: folder.id, 
                          label: folder.label,
                          description: folder.description 
                        }}
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
