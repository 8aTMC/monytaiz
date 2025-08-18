import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from '@/hooks/useTranslation';
import { format } from 'date-fns';
import { Clock } from 'lucide-react';

interface UsernameHistoryEntry {
  id: string;
  old_username: string;
  new_username: string;
  changed_at: string;
}

interface UsernameHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  currentUsername: string;
}

export function UsernameHistoryDialog({ 
  open, 
  onOpenChange, 
  userId, 
  currentUsername 
}: UsernameHistoryDialogProps) {
  const { t } = useTranslation();
  const [history, setHistory] = useState<UsernameHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && userId) {
      fetchUsernameHistory();
    }
  }, [open, userId]);

  const fetchUsernameHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('username_history')
        .select('*')
        .eq('user_id', userId)
        .order('changed_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching username history:', error);
      } else {
        setHistory(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {t('platform.usernames.pastUsernames')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Current username */}
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center justify-between">
              <span className="font-medium text-primary">{currentUsername}</span>
              <span className="text-xs text-muted-foreground bg-primary/20 px-2 py-1 rounded">
                {t('platform.usernames.current')}
              </span>
            </div>
          </div>

          {/* History */}
          {loading ? (
            <div className="text-center py-4 text-muted-foreground">
              {t('platform.usernames.loading')}...
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              {t('platform.usernames.noUsernameHistory')}
            </div>
          ) : (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                {t('platform.usernames.previousUsernames')}
              </h4>
              {history.map((entry) => (
                <div key={entry.id} className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{entry.new_username}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(entry.changed_at), 'MMM dd, yyyy')}
                    </span>
                  </div>
                  {entry.old_username && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {t('platform.usernames.changedFrom')}: {entry.old_username}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}