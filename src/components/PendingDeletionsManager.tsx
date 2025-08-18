import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUserDeletion, PendingDeletion } from '@/hooks/useUserDeletion';
import { formatDistanceToNow, format } from 'date-fns';
import { RefreshCw, UserX, UserCheck, Clock, Trash2 } from 'lucide-react';

export const PendingDeletionsManager = () => {
  const [pendingDeletions, setPendingDeletions] = useState<PendingDeletion[]>([]);
  const [selectedUser, setSelectedUser] = useState<PendingDeletion | null>(null);
  const [restorationReason, setRestorationReason] = useState('');
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { 
    loading, 
    restoreUserFromDeletion, 
    getPendingDeletions, 
    permanentlyDeleteExpiredUsers 
  } = useUserDeletion();

  const loadPendingDeletions = async () => {
    setRefreshing(true);
    try {
      const deletions = await getPendingDeletions();
      setPendingDeletions(deletions);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPendingDeletions();
  }, []);

  const handleRestoreUser = async () => {
    if (!selectedUser) return;

    try {
      await restoreUserFromDeletion(selectedUser.user_id, restorationReason);
      setShowRestoreDialog(false);
      setSelectedUser(null);
      setRestorationReason('');
      loadPendingDeletions();
    } catch (error) {
      // Error is handled in the hook
    }
  };

  const handleCleanupExpired = async () => {
    try {
      await permanentlyDeleteExpiredUsers();
      loadPendingDeletions();
    } catch (error) {
      // Error is handled in the hook
    }
  };

  const openRestoreDialog = (deletion: PendingDeletion) => {
    setSelectedUser(deletion);
    setShowRestoreDialog(true);
  };

  const isExpired = (scheduledFor: string) => {
    return new Date(scheduledFor) <= new Date();
  };

  const getStatusBadge = (deletion: PendingDeletion) => {
    const expired = isExpired(deletion.scheduled_for);
    if (expired) {
      return <Badge variant="destructive">Expired - Ready for Cleanup</Badge>;
    }
    return <Badge variant="secondary">Pending Deletion</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 pr-20">
        <div>
          <h2 className="text-2xl font-bold">Pending Deletions</h2>
          <p className="text-muted-foreground">
            Manage user accounts scheduled for deletion
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={loadPendingDeletions}
            disabled={refreshing}
            className="flex-shrink-0"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="destructive"
            onClick={handleCleanupExpired}
            disabled={loading}
            className="flex-shrink-0"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Cleanup Expired
          </Button>
        </div>
      </div>

      {pendingDeletions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <UserCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No pending deletions</p>
            <p className="text-muted-foreground">All user accounts are active</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pendingDeletions.map((deletion) => (
            <Card key={deletion.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <UserX className="h-5 w-5" />
                      {deletion.profiles?.display_name || deletion.profiles?.username || 'Unknown User'}
                    </CardTitle>
                    <CardDescription>
                      User ID: {deletion.user_id}
                    </CardDescription>
                  </div>
                  {getStatusBadge(deletion)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium mb-1">Deletion Type</div>
                    <div className="text-muted-foreground">
                      {deletion.is_self_requested ? 'Self-requested' : 'Admin-initiated'}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium mb-1">Requested</div>
                    <div className="text-muted-foreground">
                      {formatDistanceToNow(new Date(deletion.requested_at))} ago
                    </div>
                  </div>
                  <div>
                    <div className="font-medium mb-1">Scheduled For</div>
                    <div className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(deletion.scheduled_for), 'PPP')}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium mb-1">Time Remaining</div>
                    <div className={`${isExpired(deletion.scheduled_for) ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {isExpired(deletion.scheduled_for) 
                        ? 'Expired' 
                        : formatDistanceToNow(new Date(deletion.scheduled_for))
                      }
                    </div>
                  </div>
                </div>

                {deletion.reason && (
                  <div>
                    <div className="font-medium mb-1">Reason</div>
                    <div className="text-muted-foreground text-sm bg-muted p-2 rounded">
                      {deletion.reason}
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => openRestoreDialog(deletion)}
                    disabled={loading}
                  >
                    <UserCheck className="h-4 w-4 mr-2" />
                    Restore User
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore User Account</DialogTitle>
            <DialogDescription>
              This will restore the user account and reactivate all their content.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="restoration-reason">Reason for restoration</Label>
              <Textarea
                id="restoration-reason"
                placeholder="Why is this account being restored?"
                value={restorationReason}
                onChange={(e) => setRestorationReason(e.target.value)}
                rows={3}
              />
            </div>

            {selectedUser && (
              <div className="bg-muted p-3 rounded text-sm">
                <div><strong>User:</strong> {selectedUser.profiles?.display_name || 'Unknown'}</div>
                <div><strong>Scheduled for deletion:</strong> {format(new Date(selectedUser.scheduled_for), 'PPP')}</div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRestoreDialog(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRestoreUser}
              disabled={loading || !restorationReason.trim()}
            >
              {loading ? 'Restoring...' : 'Restore Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};