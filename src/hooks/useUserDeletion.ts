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
    provider?: string;
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
      // Get all user IDs that have non-fan roles (management users)
      const { data: managementUserIds, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .neq('role', 'fan');

      if (roleError) throw roleError;

      const managementIds = managementUserIds?.map(role => role.user_id) || [];

      if (managementIds.length === 0) {
        return [];
      }

      // Get pending deletions for management users only (non-fans)
      const { data, error } = await supabase
        .from('pending_deletions')
        .select(`
          *,
          profiles:user_id (
            username,
            display_name,
            provider
          )
        `)
        .is('restored_at', null)
        .in('user_id', managementIds)
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

  const immediatelyDeleteUser = async (
    targetUserId: string,
    deletionReason?: string
  ) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('immediately_delete_user', {
        target_user_id: targetUserId,
        admin_reason: deletionReason
      });

      if (error) throw error;

      toast({
        title: "User Deleted",
        description: "User account has been permanently deleted.",
      });

      return data;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
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
    immediatelyDeleteUser,
  };
};