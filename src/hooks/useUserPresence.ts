import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useUserPresence = (userId: string | undefined) => {
  const [isOnline, setIsOnline] = useState(false);
  const { toast } = useToast();
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const lastSeenRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize presence tracking with conflict resolution
  const initializePresence = async () => {
    if (!userId) return;

    try {
      // Insert or update user presence with proper conflict resolution
      const { error } = await supabase
        .from('user_presence')
        .upsert({
          user_id: userId,
          is_online: true,
          last_seen_at: new Date().toISOString()
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        });

      if (error && error.code === '23505') {
        // Handle unique constraint violation by updating instead
        await supabase
          .from('user_presence')
          .update({
            is_online: true,
            last_seen_at: new Date().toISOString()
          })
          .eq('user_id', userId);
      } else if (error) {
        throw error;
      }

      setIsOnline(true);
      
      // Start heartbeat to keep presence updated
      startHeartbeat();
    } catch (error) {
      console.error('Error initializing presence:', error);
      // Don't show toast for presence errors to avoid spam
    }
  };

  // Start heartbeat to keep updating presence with debouncing
  const startHeartbeat = () => {
    if (!userId || heartbeatRef.current) return;

    heartbeatRef.current = setInterval(async () => {
      try {
        const { error } = await supabase
          .from('user_presence')
          .update({
            is_online: true,
            last_seen_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (error && error.code === '23505') {
          // Ignore conflict errors during heartbeat
          return;
        } else if (error) {
          console.error('Error updating presence:', error);
        }
      } catch (error) {
        console.error('Error updating presence:', error);
      }
    }, 30000); // Update every 30 seconds
  };

  // Set user as offline
  const setOffline = async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_presence')
        .update({
          is_online: false,
          last_seen_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error && error.code !== '23505') {
        console.error('Error setting offline:', error);
      }

      setIsOnline(false);
    } catch (error) {
      console.error('Error setting offline:', error);
    }
  };

  // Handle page visibility changes
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Page is now hidden, set offline after a delay
      lastSeenRef.current = setTimeout(() => {
        setOffline();
      }, 5000); // 5 second grace period
    } else {
      // Page is now visible, clear timeout and go online
      if (lastSeenRef.current) {
        clearTimeout(lastSeenRef.current);
        lastSeenRef.current = null;
      }
      initializePresence();
    }
  };

  // Handle beforeunload event
  const handleBeforeUnload = () => {
    // Use sendBeacon for reliable offline status update
    const supabaseUrl = "https://alzyzfjzwvofmjccirjq.supabase.co";
    navigator.sendBeacon(
      `${supabaseUrl}/rest/v1/user_presence`,
      JSON.stringify({
        user_id: userId,
        is_online: false,
        last_seen_at: new Date().toISOString()
      })
    );
  };

  useEffect(() => {
    if (!userId) return;

    // Initialize presence on mount
    initializePresence();

    // Set up event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup function
    return () => {
      // Clear intervals
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (lastSeenRef.current) {
        clearTimeout(lastSeenRef.current);
      }

      // Remove event listeners
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // Set offline
      setOffline();
    };
  }, [userId]);

  return {
    isOnline,
    initializePresence,
    setOffline
  };
};
