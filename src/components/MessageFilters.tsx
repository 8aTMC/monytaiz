import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Pin, MessageCircle } from 'lucide-react';

export type FilterType = 'all' | 'ai' | 'pinned' | 'unread';

interface MessageFiltersProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  aiChatCount: number;
  pinnedCount: number;
  unreadCount: number;
}

export const MessageFilters = ({
  activeFilter,
  onFilterChange,
  aiChatCount,
  pinnedCount,
  unreadCount
}: MessageFiltersProps) => {
  const baseFilters = [
    {
      id: 'all' as FilterType,
      label: 'All',
      icon: MessageCircle,
      count: null
    },
    {
      id: 'ai' as FilterType,
      label: 'AI',
      icon: Bot,
      count: aiChatCount
    },
    {
      id: 'pinned' as FilterType,
      label: 'Pinned',
      icon: Pin,
      count: pinnedCount
    },
    {
      id: 'unread' as FilterType,
      label: 'Unread',
      icon: MessageCircle,
      count: unreadCount
    }
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {baseFilters.map((filter) => (
          <Button
            key={filter.id}
            variant={activeFilter === filter.id ? "default" : "ghost"}
            size="sm"
            onClick={() => onFilterChange(filter.id)}
            className="h-7 px-2 text-xs"
          >
            <filter.icon className="h-3 w-3 mr-1" />
            {filter.label}
            {filter.count !== null && filter.count > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                {filter.count}
              </Badge>
            )}
          </Button>
        ))}
      </div>
    </div>
  );
};