import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { emojiData, EmojiCategory } from '@/data/emojiData';
import { useRecentEmojis } from '@/hooks/useRecentEmojis';
import { useTranslation } from '@/hooks/useTranslation';

interface EmojiPickerProps {
  children: React.ReactNode;
  onEmojiSelect: (emoji: string) => void;
}

const CATEGORIES: EmojiCategory[] = [
  'recently-used',
  'people',
  'nature',
  'food',
  'activities',
  'travel',
  'objects',
  'symbols',
  'flags'
];

const CATEGORY_ICONS: Record<EmojiCategory, string> = {
  'recently-used': '🕘',
  'people': '😀',
  'nature': '🌱',
  'food': '🍎',
  'activities': '⚽',
  'travel': '🚗',
  'objects': '💡',
  'symbols': '❤️',
  'flags': '🏳️'
};

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ children, onEmojiSelect }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<EmojiCategory>('recently-used');
  const { recentEmojis, addRecentEmoji } = useRecentEmojis();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter emojis based on search term
  const filteredEmojis = useMemo(() => {
    if (!searchTerm.trim()) return emojiData;

    const search = searchTerm.toLowerCase();
    return emojiData.filter(emoji => 
      emoji.name.toLowerCase().includes(search) ||
      emoji.keywords.some(keyword => keyword.toLowerCase().includes(search)) ||
      (emoji.keywordsEs && emoji.keywordsEs.some(keyword => keyword.toLowerCase().includes(search)))
    );
  }, [searchTerm]);

  // Group emojis by category
  const emojisByCategory = useMemo(() => {
    const categories: Record<EmojiCategory, typeof emojiData> = {
      'recently-used': recentEmojis.map(recent => 
        emojiData.find(emoji => emoji.emoji === recent.emoji)!
      ).filter(Boolean),
      'people': [],
      'nature': [],
      'food': [],
      'activities': [],
      'travel': [],
      'objects': [],
      'symbols': [],
      'flags': []
    };

    const emojisToProcess = searchTerm ? filteredEmojis : emojiData;
    
    emojisToProcess.forEach(emoji => {
      if (categories[emoji.category]) {
        categories[emoji.category].push(emoji);
      }
    });

    return categories;
  }, [filteredEmojis, recentEmojis, searchTerm]);

  const handleEmojiClick = (emoji: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    addRecentEmoji(emoji);
    onEmojiSelect(emoji);
    // Note: We don't close the popover here to allow multiple selections
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      // Focus search input when opened
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } else {
      // Reset search when closed
      setSearchTerm('');
      setActiveCategory('recently-used');
    }
  };

  // Auto-switch to recently-used if it has emojis and we're searching
  useEffect(() => {
    if (searchTerm && emojisByCategory['recently-used'].length > 0) {
      setActiveCategory('recently-used');
    }
  }, [searchTerm, emojisByCategory]);

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0 h-96" 
        align="start"
        side="top"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          const target = e.target as Element;
          if (target.closest('[data-emoji-button]')) {
            e.preventDefault();
          }
        }}
        onPointerDownOutside={(e) => {
          // Only close if clicking outside, not on emoji buttons
          const target = e.target as Element;
          if (target.closest('[data-emoji-button]')) {
            e.preventDefault();
          }
        }}
      >
        <div className="flex flex-col h-full">
          {/* Header with search and close */}
          <div className="flex items-center gap-2 p-3 border-b border-border">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder={t('emojiPicker.searchPlaceholder', 'Search emojis...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-9 w-9 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Emoji categories and content */}
          <div className="flex-1 min-h-0">
            <Tabs 
              value={activeCategory} 
              onValueChange={(value) => setActiveCategory(value as EmojiCategory)}
              className="h-full flex flex-col"
            >
              {/* Category tabs */}
              <TabsList className="grid grid-cols-9 gap-0 h-auto p-1 bg-muted/50">
                {CATEGORIES.map((category) => (
                  <TabsTrigger
                    key={category}
                    value={category}
                    className="p-1 h-8 w-8 text-base data-[state=active]:bg-background"
                    title={t(`emojiPicker.category.${category}`, category)}
                  >
                    {CATEGORY_ICONS[category]}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Emoji content */}
              <div className="flex-1 min-h-0">
                {CATEGORIES.map((category) => (
                  <TabsContent
                    key={category}
                    value={category}
                    className="h-full m-0 data-[state=inactive]:hidden"
                  >
                    <ScrollArea className="h-full">
                      <div className="p-2">
                        {emojisByCategory[category].length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            {category === 'recently-used' 
                              ? t('emojiPicker.noRecentEmojis', 'No recent emojis')
                              : t('emojiPicker.noEmojisFound', 'No emojis found')
                            }
                          </div>
                        ) : (
                          <div className="grid grid-cols-8 gap-1">
                            {emojisByCategory[category].map((emoji) => (
                              <button
                                key={`${emoji.emoji}-${emoji.name}`}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={(e) => handleEmojiClick(emoji.emoji, e)}
                                className="aspect-square flex items-center justify-center text-xl hover:bg-muted rounded transition-colors p-1"
                                title={emoji.name}
                                data-emoji-button
                              >
                                {emoji.emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};