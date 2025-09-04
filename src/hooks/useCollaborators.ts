import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Collaborator {
  id: string;
  creator_id: string;
  name: string;
  url: string;
  profile_picture_url?: string;
  created_at: string;
  updated_at: string;
}

export const useCollaborators = () => {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCollaborators = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Check if user is authenticated first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Please log in to view collaborators');
      }

      const { data, error } = await supabase
        .from('collaborators')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        // Handle specific RLS errors more gracefully
        if (error.code === 'PGRST301' || error.message.includes('row-level security')) {
          throw new Error('Access denied: insufficient permissions to view collaborators');
        }
        throw error;
      }
      setCollaborators(data || []);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error fetching collaborators';
      setError(errorMsg);
      console.error('Error fetching collaborators:', err);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createCollaborator = async (collaboratorData: Omit<Collaborator, 'id' | 'creator_id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('collaborators')
        .insert({
          ...collaboratorData,
          creator_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      setCollaborators(prev => [data, ...prev]);
      toast({
        title: "Success",
        description: "Collaborator added successfully"
      });

      return data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error creating collaborator';
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive"
      });
      throw err;
    }
  };

  const updateCollaborator = async (id: string, updates: Partial<Omit<Collaborator, 'id' | 'creator_id' | 'created_at' | 'updated_at'>>) => {
    try {
      const { data, error } = await supabase
        .from('collaborators')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setCollaborators(prev => 
        prev.map(collab => collab.id === id ? data : collab)
      );

      return data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error updating collaborator';
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive"
      });
      throw err;
    }
  };

  const deleteCollaborator = async (id: string) => {
    try {
      const { error } = await supabase
        .from('collaborators')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setCollaborators(prev => prev.filter(collab => collab.id !== id));
      toast({
        title: "Success",
        description: "Collaborator deleted successfully"
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error deleting collaborator';
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive"
      });
      throw err;
    }
  };

  const getRecentCollaborators = (limit = 5) => {
    return collaborators.slice(0, limit);
  };

  const searchCollaborators = (query: string) => {
    if (!query.trim()) return collaborators;
    return collaborators.filter(collab => 
      collab.name.toLowerCase().includes(query.toLowerCase()) ||
      collab.url.toLowerCase().includes(query.toLowerCase())
    );
  };

  useEffect(() => {
    fetchCollaborators();
  }, [fetchCollaborators]);

  return {
    collaborators,
    loading,
    error,
    fetchCollaborators,
    createCollaborator,
    updateCollaborator,
    deleteCollaborator,
    getRecentCollaborators,
    searchCollaborators
  };
};