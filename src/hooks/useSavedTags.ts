import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SavedTag {
  id: string;
  creator_id: string;
  tag_name: string;
  usage_count: number;
  last_used_at: string;
  created_at: string;
}

export const useSavedTags = () => {
  const [savedTags, setSavedTags] = useState<SavedTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchSavedTags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('saved_tags')
        .select('*')
        .order('last_used_at', { ascending: false });

      if (error) throw error;
      setSavedTags(data || []);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error fetching saved tags';
      setError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createOrUpdateTag = useCallback(async (tagName: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Use upsert to handle both create and update cases atomically
      const { data, error } = await supabase
        .from('saved_tags')
        .upsert({
          tag_name: tagName,
          creator_id: user.id,
          usage_count: 1,
          last_used_at: new Date().toISOString()
        }, {
          onConflict: 'creator_id,tag_name',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) {
        // If upsert fails due to conflict, manually update the existing record
        if (error.code === '23505') { // Unique constraint violation
          const { data: existingTag } = await supabase
            .from('saved_tags')
            .select('*')
            .eq('tag_name', tagName)
            .eq('creator_id', user.id)
            .maybeSingle();

          if (existingTag) {
            const { data: updatedData, error: updateError } = await supabase
              .from('saved_tags')
              .update({
                usage_count: existingTag.usage_count + 1,
                last_used_at: new Date().toISOString()
              })
              .eq('id', existingTag.id)
              .select()
              .single();

            if (updateError) throw updateError;

            setSavedTags(prev => 
              prev.map(tag => tag.id === existingTag.id ? updatedData : tag)
                .sort((a, b) => new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime())
            );

            return updatedData;
          }
        }
        throw error;
      }

      // Handle successful upsert
      setSavedTags(prev => {
        const existingIndex = prev.findIndex(tag => tag.tag_name === tagName);
        if (existingIndex >= 0) {
          // Update existing tag
          return prev.map(tag => tag.id === data.id ? data : tag)
            .sort((a, b) => new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime());
        } else {
          // Add new tag
          return [data, ...prev];
        }
      });

      return data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error saving tag';
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive"
      });
      throw err;
    }
  }, [toast]);

  const getRecentTags = (limit = 5) => {
    // Deduplicate by tag_name, keeping the most recent (first occurrence)
    const uniqueTags = savedTags.filter((tag, index, self) => 
      index === self.findIndex(t => t.tag_name.toLowerCase() === tag.tag_name.toLowerCase())
    );
    return uniqueTags.slice(0, limit);
  };

  const searchTags = (query: string) => {
    if (!query.trim()) return savedTags;
    const filteredTags = savedTags.filter(tag => 
      tag.tag_name.toLowerCase().includes(query.toLowerCase())
    );
    // Deduplicate search results by tag_name, keeping the most recent
    return filteredTags.filter((tag, index, self) => 
      index === self.findIndex(t => t.tag_name.toLowerCase() === tag.tag_name.toLowerCase())
    );
  };

  // Update tag usage when tags are used
  const useTag = useCallback(async (tagName: string) => {
    await createOrUpdateTag(tagName);
  }, [createOrUpdateTag]);

  const useTags = useCallback(async (tagNames: string[]) => {
    for (const tagName of tagNames) {
      if (tagName.trim()) {
        await createOrUpdateTag(tagName);
      }
    }
  }, [createOrUpdateTag]);

  useEffect(() => {
    fetchSavedTags();
  }, [fetchSavedTags]);

  return {
    savedTags,
    loading,
    error,
    fetchSavedTags,
    createOrUpdateTag,
    getRecentTags,
    searchTags,
    useTag,
    useTags
  };
};