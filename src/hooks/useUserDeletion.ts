import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PendingDeletion {
  id: string;
  user_id: string;
  requested_by: string;
  requested_at: string;
  scheduled_for: string;
  reason?: string;
  admin_notes?: string;
  is_self_requested: boolean;
  restored_at?: string;
  restored_by?: string;
  restored_reason?: string;
  profiles?: {
    username?: string;
    display_name?: string;
  };
}

export const useUserDeletion = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const initiateUserDeletion = async (
    targetUserId: string, 
    reason?: string, 
    isSelfDelete: boolean = false
  ) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('initiate_user_deletion', {
        target_user_id: targetUserId,
        deletion_reason: reason,
        is_self_delete: isSelfDelete
      });

      if (error) throw error;

      toast({
        title: "Deletion Initiated",
        description: isSelfDelete 
          ? "Your account deletion has been scheduled for 30 days from now."
          : "User account deletion has been scheduled.",
      });

      return data;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to initiate user deletion",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const restoreUserFromDeletion = async (
    targetUserId: string, 
    restorationReason?: string
  ) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('restore_user_from_deletion', {
        target_user_id: targetUserId,
        restoration_reason: restorationReason
      });

      if (error) throw error;

      toast({
        title: "User Restored",
        description: "User account has been successfully restored.",
      });

      return data;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to restore user",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getPendingDeletions = async (): Promise<PendingDeletion[]> => {
    try {
      const { data, error } = await supabase
        .from('pending_deletions')
        .select(`
          *,
          profiles:user_id (
            username,
            display_name
          )
        `)
        .is('restored_at', null)
        .order('requested_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch pending deletions",
        variant: "destructive",
      });
      return [];
    }
  };

  const permanentlyDeleteExpiredUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('permanently_delete_expired_users');

      if (error) throw error;

      const result = data as { deleted_count: number; message: string };

      toast({
        title: "Cleanup Complete",
        description: `Permanently deleted ${result.deleted_count} expired users.`,
      });

      return result;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete expired users",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const checkUserDeletionStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('deletion_status, deletion_scheduled_for')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error checking user deletion status:', error);
      return null;
    }
  };

  return {
    loading,
    initiateUserDeletion,
    restoreUserFromDeletion,
    getPendingDeletions,
    permanentlyDeleteExpiredUsers,
    checkUserDeletionStatus,
  };
};