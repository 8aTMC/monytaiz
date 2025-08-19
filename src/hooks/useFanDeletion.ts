import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PendingFanDeletion {
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
    id?: string;
    username?: string;
    display_name?: string;
    bio?: string;
    avatar_url?: string;
    banner_url?: string;
    fan_category?: string;
    is_verified?: boolean;
    created_at?: string;
  };
  user_metadata?: {
    provider?: string;
    providers?: string[];
  };
}

export const useFanDeletion = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const initiateFanDeletion = async (
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
        title: "Fan Deletion Initiated",
        description: isSelfDelete 
          ? "Your account deletion has been scheduled for 30 days from now."
          : "Fan account deletion has been scheduled.",
      });

      return data;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to initiate fan deletion",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const restoreFanFromDeletion = async (
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
        title: "Fan Restored",
        description: "Fan account has been successfully restored.",
      });

      return data;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to restore fan",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getPendingFanDeletions = async (): Promise<PendingFanDeletion[]> => {
    try {
      // Get all user IDs that have the 'fan' role
      const { data: fanUserIds, error: fanError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'fan');

      if (fanError) throw fanError;

      const fanIds = fanUserIds?.map(role => role.user_id) || [];

      if (fanIds.length === 0) {
        return [];
      }

      // Get pending deletions for fan users only with full profile data
      const { data, error } = await supabase
        .from('pending_deletions')
        .select(`
          *,
          profiles!inner (
            id,
            username,
            display_name,
            bio,
            avatar_url,
            banner_url,
            fan_category,
            is_verified,
            created_at
          )
        `)
        .is('restored_at', null)
        .in('user_id', fanIds)
        .order('requested_at', { ascending: false });

      if (error) throw error;

      // Get user auth metadata for each user to determine sign-up provider
      const deletionsWithProvider = await Promise.all(
        (data || []).map(async (deletion) => {
          try {
            // Get user from auth.users to check their providers
            const { data: userData, error: userError } = await supabase.auth.admin.getUserById(deletion.user_id);
            
            if (!userError && userData?.user) {
              const providers = userData.user.app_metadata?.providers || [];
              const isGoogleUser = providers.includes('google');
              
              return {
                ...deletion,
                user_metadata: {
                  provider: isGoogleUser ? 'google' : 'email',
                  providers: providers
                }
              };
            }
            
            return deletion;
          } catch (error) {
            console.error('Error fetching user auth data:', error);
            return deletion;
          }
        })
      );

      return deletionsWithProvider;
    } catch (error: any) {
      console.error('Full error details:', error);
      toast({
        title: "Error",
        description: "Failed to fetch pending fan deletions",
        variant: "destructive",
      });
      return [];
    }
  };

  const checkFanDeletionStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('deletion_status, deletion_scheduled_for')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error checking fan deletion status:', error);
      return null;
    }
  };

  return {
    loading,
    initiateFanDeletion,
    restoreFanFromDeletion,
    getPendingFanDeletions,
    checkFanDeletionStatus,
  };
};