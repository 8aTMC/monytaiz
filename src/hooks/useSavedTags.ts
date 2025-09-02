import { useState, useEffect } from 'react';
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

  const fetchSavedTags = async () => {
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
  };

  const createOrUpdateTag = async (tagName: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // First, try to find existing tag
      const { data: existingTag } = await supabase
        .from('saved_tags')
        .select('*')
        .eq('tag_name', tagName)
        .eq('creator_id', user.id)
        .single();

      if (existingTag) {
        // Update usage count and last used
        const { data, error } = await supabase
          .from('saved_tags')
          .update({
            usage_count: existingTag.usage_count + 1,
            last_used_at: new Date().toISOString()
          })
          .eq('id', existingTag.id)
          .select()
          .single();

        if (error) throw error;

        setSavedTags(prev => 
          prev.map(tag => tag.id === existingTag.id ? data : tag)
            .sort((a, b) => new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime())
        );

        return data;
      } else {
        // Create new tag
        const { data, error } = await supabase
          .from('saved_tags')
          .insert({
            tag_name: tagName,
            creator_id: user.id,
            usage_count: 1,
            last_used_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;

        setSavedTags(prev => [data, ...prev]);
        return data;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error saving tag';
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive"
      });
      throw err;
    }
  };

  const getRecentTags = (limit = 5) => {
    return savedTags.slice(0, limit);
  };

  const searchTags = (query: string) => {
    if (!query.trim()) return savedTags;
    return savedTags.filter(tag => 
      tag.tag_name.toLowerCase().includes(query.toLowerCase())
    );
  };

  // Update tag usage when tags are used
  const useTag = async (tagName: string) => {
    await createOrUpdateTag(tagName);
  };

  const useTags = async (tagNames: string[]) => {
    for (const tagName of tagNames) {
      if (tagName.trim()) {
        await createOrUpdateTag(tagName);
      }
    }
  };

  useEffect(() => {
    fetchSavedTags();
  }, []);

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