import { useState, useEffect, useCallback } from 'react';

interface RecentEmoji {
  emoji: string;
  count: number;
  lastUsed: number;
}

const STORAGE_KEY = 'recentEmojis';
const MAX_RECENT_EMOJIS = 40;

export const useRecentEmojis = () => {
  const [recentEmojis, setRecentEmojis] = useState<RecentEmoji[]>([]);

  // Load recent emojis from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: RecentEmoji[] = JSON.parse(stored);
        // Sort by last used (most recent first) and count (most used first)
        const sorted = parsed.sort((a, b) => {
          // First sort by last used date (newer first)
          const timeDiff = b.lastUsed - a.lastUsed;
          if (timeDiff !== 0) return timeDiff;
          // If times are similar, sort by count (more used first)
          return b.count - a.count;
        });
        setRecentEmojis(sorted.slice(0, MAX_RECENT_EMOJIS));
      }
    } catch (error) {
      console.error('Error loading recent emojis:', error);
    }
  }, []);

  // Save to localStorage whenever recentEmojis changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recentEmojis));
    } catch (error) {
      console.error('Error saving recent emojis:', error);
    }
  }, [recentEmojis]);

  const addRecentEmoji = useCallback((emoji: string) => {
    const now = Date.now();
    
    setRecentEmojis(prev => {
      // Find if emoji already exists
      const existingIndex = prev.findIndex(item => item.emoji === emoji);
      
      let updated: RecentEmoji[];
      
      if (existingIndex >= 0) {
        // Update existing emoji
        updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          count: updated[existingIndex].count + 1,
          lastUsed: now
        };
      } else {
        // Add new emoji
        updated = [
          ...prev,
          { emoji, count: 1, lastUsed: now }
        ];
      }
      
      // Sort by last used (most recent first) and count (most used first)
      const sorted = updated.sort((a, b) => {
        // First sort by last used date (newer first)
        const timeDiff = b.lastUsed - a.lastUsed;
        if (timeDiff !== 0) return timeDiff;
        // If times are similar, sort by count (more used first)
        return b.count - a.count;
      });
      
      // Limit to MAX_RECENT_EMOJIS
      return sorted.slice(0, MAX_RECENT_EMOJIS);
    });
  }, []);

  const clearRecentEmojis = useCallback(() => {
    setRecentEmojis([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    recentEmojis,
    addRecentEmoji,
    clearRecentEmojis
  };
};