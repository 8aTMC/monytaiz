import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Collaborator {
  id: string;
  creator_id: string;
  name: string;
  url: string;
  description?: string;
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

  const findExistingCollaborator = async (name: string, url: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('collaborators')
      .select('*')
      .or(`name.ilike.${name.replace(/'/g, "''")},url.eq.${url}`)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    return data;
  };

  const createCollaborator = async (collaboratorData: Omit<Collaborator, 'id' | 'creator_id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Check for existing collaborator with same name (case-insensitive) or URL
      const existingCollaborator = await findExistingCollaborator(collaboratorData.name, collaboratorData.url);
      
      if (existingCollaborator) {
        // Return existing collaborator with a different message
        toast({
          title: "Collaborator already exists",
          description: `Using existing collaborator: ${existingCollaborator.name}`,
          variant: "default"
        });
        
        // Update local state if not already present
        setCollaborators(prev => {
          const exists = prev.some(c => c.id === existingCollaborator.id);
          if (!exists) {
            return [existingCollaborator, ...prev];
          }
          return prev;
        });

        return { ...existingCollaborator, wasExisting: true };
      }

      // Create new collaborator if no duplicate found
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

      return { ...data, wasExisting: false };
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
      // First, get the collaborator to check if it has a profile picture
      const { data: collaborator } = await supabase
        .from('collaborators')
        .select('profile_picture_url')
        .eq('id', id)
        .single();

      // Delete the profile picture from storage if it exists
      if (collaborator?.profile_picture_url) {
        const fileName = collaborator.profile_picture_url.split('/').pop();
        if (fileName) {
          await supabase.storage
            .from('avatars')
            .remove([`collaborators/${fileName}`]);
        }
      }

      // Then delete the database record
      const { error } = await supabase
        .from('collaborators')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setCollaborators(prev => prev.filter(collab => collab.id !== id));
      toast({
        title: "Success",
        description: "Collaborator and profile picture deleted successfully"
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
    // Remove duplicates by name (case-insensitive) and return most recent
    const unique = collaborators.filter((collaborator, index, arr) => 
      arr.findIndex(c => c.name.toLowerCase() === collaborator.name.toLowerCase()) === index
    );
    return unique.slice(0, limit);
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