import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RangeSlider } from "@/components/ui/range-slider";
import { MultiSelect } from "@/components/ui/multi-select";
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { X, Filter } from "lucide-react";

interface FilterState {
  collaborators: string[];
  tags: string[];
  priceRange: [number, number];
}

interface LibraryFiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

interface CollaboratorOption {
  value: string;
  label: string;
  description?: string;
}

interface TagOption {
  value: string;
  label: string;
  description?: string;
}

export const LibraryFiltersDialog: React.FC<LibraryFiltersDialogProps> = ({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
}) => {
  const { t } = useTranslation();
  const [collaboratorOptions, setCollaboratorOptions] = useState<CollaboratorOption[]>([]);
  const [tagOptions, setTagOptions] = useState<TagOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);
  const [manualPriceMin, setManualPriceMin] = useState('');
  const [manualPriceMax, setManualPriceMax] = useState('');

  // Load available collaborators and tags
  useEffect(() => {
  const loadCollaborators = async () => {
      try {
        // Load all collaborators, ordered by name alphabetically
        const { data: collaborators } = await supabase
          .from('collaborators')
          .select('id, name, description')
          .order('name', { ascending: true });

        if (collaborators) {
          setCollaboratorOptions(
            collaborators.map(c => ({
              value: c.id,
              label: c.name,
              description: c.description || undefined
            }))
          );
        }
      } catch (error) {
        console.error('Error loading collaborators:', error);
        setCollaboratorOptions([]);
      }
    };

    const loadOptions = async () => {
      setLoading(true);
      try {
        // Load collaborators
        await loadCollaborators();

        // Load saved tags
        const { data: tags } = await supabase
          .from('saved_tags')
          .select('tag_name, usage_count')
          .order('usage_count', { ascending: false });

        if (tags) {
          // Remove duplicates by tag_name and create unique keys
          const uniqueTags = tags.reduce((acc, tag) => {
            const existing = acc.find(t => t.tag_name === tag.tag_name);
            if (!existing || tag.usage_count > existing.usage_count) {
              return [...acc.filter(t => t.tag_name !== tag.tag_name), tag];
            }
            return acc;
          }, [] as typeof tags);
          
          setTagOptions(
            uniqueTags.map((t, index) => ({
              value: `${t.tag_name}_${index}`, // Ensure unique value
              label: t.tag_name,
              description: `Used ${t.usage_count} times`
            }))
          );
        }
      } catch (error) {
        console.error('Error loading filter options:', error);
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      loadOptions();
    }
  }, [open]);

  // Update local state when external filters change
  useEffect(() => {
    setLocalFilters(filters);
    setManualPriceMin((filters.priceRange[0] / 100).toString());
    setManualPriceMax((filters.priceRange[1] / 100).toString());
  }, [filters]);

  const handleCollaboratorChange = (collaborators: string[]) => {
    setLocalFilters(prev => ({ ...prev, collaborators }));
  };

  const handleTagChange = (tags: string[]) => {
    // Extract tag names from unique values (remove the index suffix)
    const tagNames = tags.map(tag => tag.replace(/_\d+$/, ''));
    setLocalFilters(prev => ({ ...prev, tags: tagNames }));
  };

  const handlePriceRangeChange = (range: number[]) => {
    setLocalFilters(prev => ({ ...prev, priceRange: [range[0], range[1]] }));
    setManualPriceMin((range[0] / 100).toString());
    setManualPriceMax((range[1] / 100).toString());
  };

  const handleManualPriceChange = () => {
    const min = Math.max(0, parseFloat(manualPriceMin) || 0) * 100;
    const max = Math.min(1000000, parseFloat(manualPriceMax) || 10000) * 100;
    
    if (min <= max) {
      setLocalFilters(prev => ({ ...prev, priceRange: [min, max] }));
    }
  };

  const handleApply = () => {
    console.log('🎛️ Applying filters:', localFilters);
    console.log('🎛️ Collaborator IDs selected:', localFilters.collaborators);
    console.log('🎛️ Tags selected:', localFilters.tags);
    console.log('🎛️ Price range:', localFilters.priceRange);
    onFiltersChange(localFilters);
    onOpenChange(false);
  };

  const handleClear = () => {
    const clearedFilters: FilterState = {
      collaborators: [],
      tags: [],
      priceRange: [0, 1000000] // $0 to $10,000
    };
    setLocalFilters(clearedFilters);
    setManualPriceMin('0');
    setManualPriceMax('10000');
  };

  const handleReset = () => {
    setLocalFilters(filters);
    setManualPriceMin((filters.priceRange[0] / 100).toString());
    setManualPriceMax((filters.priceRange[1] / 100).toString());
  };

  const hasActiveFilters = 
    localFilters.collaborators.length > 0 || 
    localFilters.tags.length > 0 || 
    localFilters.priceRange[0] > 0 || 
    localFilters.priceRange[1] < 1000000;

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toLocaleString()}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card/95 backdrop-blur-md border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Advanced Filters
          </DialogTitle>
          <DialogDescription>
            Filter your media library by collaborators, tags, and price range.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Active Filters</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="h-6 text-xs"
                >
                  Clear All
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {localFilters.collaborators.map(id => {
                  const collaborator = collaboratorOptions.find(c => c.value === id);
                  return collaborator ? (
                    <Badge key={id} variant="secondary" className="bg-primary/10 text-primary">
                      Collaborator: {collaborator.label}
                      <X
                        className="ml-1 h-3 w-3 cursor-pointer"
                        onClick={() => handleCollaboratorChange(localFilters.collaborators.filter(c => c !== id))}
                      />
                    </Badge>
                  ) : null;
                })}
                {localFilters.tags.map((tag, index) => (
                  <Badge key={`tag-${tag}-${index}`} variant="secondary" className="bg-primary/10 text-primary">
                    Tag: {tag}
                    <X
                      className="ml-1 h-3 w-3 cursor-pointer"
                      onClick={() => handleTagChange(localFilters.tags.filter(t => t !== tag))}
                    />
                  </Badge>
                ))}
                {(localFilters.priceRange[0] > 0 || localFilters.priceRange[1] < 1000000) && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    Price: {formatCurrency(localFilters.priceRange[0])} - {formatCurrency(localFilters.priceRange[1])}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Collaborators Filter */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Filter by Collaborators</Label>
            <MultiSelect
              options={collaboratorOptions}
              value={localFilters.collaborators}
              onChange={handleCollaboratorChange}
              placeholder="Select collaborators..."
              emptyMessage="No collaborators found."
              loading={loading}
              maxSelections={5}
              searchPlaceholder="Search collaborators..."
            />
            {collaboratorOptions.length === 0 && !loading && (
              <p className="text-xs text-muted-foreground">
                No collaborators found. Try adding collaborators first.
              </p>
            )}
          </div>

          {/* Tags Filter */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Filter by Tags</Label>
            <MultiSelect
              options={tagOptions}
              value={localFilters.tags.map(tag => {
                const option = tagOptions.find(opt => opt.label === tag);
                return option ? option.value : tag;
              })}
              onChange={handleTagChange}
              placeholder="Select tags..."
              emptyMessage="No tags found."
              loading={loading}
            />
          </div>

          {/* Price Range Filter */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Price Range</Label>
            
            {/* Manual Input Fields */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Min Price ($)</Label>
                <Input
                  type="number"
                  min="0"
                  max="10000"
                  step="0.01"
                  value={manualPriceMin}
                  onChange={(e) => setManualPriceMin(e.target.value)}
                  onBlur={handleManualPriceChange}
                  className="mt-1"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Max Price ($)</Label>
                <Input
                  type="number"
                  min="0"
                  max="10000"
                  step="0.01"
                  value={manualPriceMax}
                  onChange={(e) => setManualPriceMax(e.target.value)}
                  onBlur={handleManualPriceChange}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Range Slider */}
            <RangeSlider
              value={localFilters.priceRange}
              onValueChange={handlePriceRangeChange}
              min={0}
              max={1000000}
              step={100}
              minLabel="Min"
              maxLabel="Max"
              formatValue={formatCurrency}
              className="mt-4"
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply} className="bg-gradient-primary">
              Apply Filters
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};