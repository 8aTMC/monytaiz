import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useRefreshCollaborators = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshCollaborators = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    
    try {
      console.log('🔄 Starting collaborator mapping refresh...');
      
      const { data, error } = await supabase.functions.invoke('refresh-collaborators');
      
      if (error) {
        console.error('❌ Error refreshing collaborators:', error);
        toast({
          title: "Error",
          description: "Failed to refresh collaborator mappings. Please try again.",
          variant: "destructive",
        });
        return false;
      }

      console.log('✅ Collaborator mapping refresh successful:', data);
      
      return true;
    } catch (error) {
      console.error('❌ Unexpected error during collaborator refresh:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsRefreshing(false);
    }
  };

  return {
    refreshCollaborators,
    isRefreshing
  };
};