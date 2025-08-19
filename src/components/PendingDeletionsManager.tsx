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
import { RefreshCw, UserX, UserCheck, Clock, Trash2, AlertCircle, User } from 'lucide-react';

// Google icon component
const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export const PendingDeletionsManager = () => {
  const [pendingDeletions, setPendingDeletions] = useState<PendingDeletion[]>([]);
  const [selectedUser, setSelectedUser] = useState<PendingDeletion | null>(null);
  const [restorationReason, setRestorationReason] = useState('');
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUserForDelete, setSelectedUserForDelete] = useState<PendingDeletion | null>(null);
  const [deletionReason, setDeletionReason] = useState('');

  const { 
    loading, 
    restoreUserFromDeletion, 
    getPendingDeletions, 
    permanentlyDeleteExpiredUsers,
    immediatelyDeleteUser
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

  const handleDeleteUser = async () => {
    if (!selectedUserForDelete || !deletionReason.trim()) return;

    try {
      await immediatelyDeleteUser(selectedUserForDelete.user_id, deletionReason);
      setShowDeleteDialog(false);
      setSelectedUserForDelete(null);
      setDeletionReason('');
      loadPendingDeletions();
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const openRestoreDialog = (deletion: PendingDeletion) => {
    setSelectedUser(deletion);
    setShowRestoreDialog(true);
  };

  const openDeleteDialog = (deletion: PendingDeletion) => {
    setSelectedUserForDelete(deletion);
    setShowDeleteDialog(true);
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
            Manage management user accounts scheduled for deletion (excludes fans)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadPendingDeletions}
            disabled={refreshing}
            className="flex-shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleCleanupExpired}
            disabled={loading}
            className="flex-shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
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
                      <span className="flex items-center gap-2">
                        {deletion.profiles?.display_name || deletion.profiles?.username || 'Unknown User'}
                        {deletion.profiles?.provider === 'google' && (
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            <GoogleIcon className="h-3 w-3" />
                            Google
                          </Badge>
                        )}
                      </span>
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

                <div className="flex justify-end gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => openDeleteDialog(deletion)}
                    disabled={loading}
                  >
                    <AlertCircle className="h-3.5 w-3.5 mr-1" />
                    Fully Delete
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openRestoreDialog(deletion)}
                    disabled={loading}
                  >
                    <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                    Restore User
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Fully Delete User Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Permanently Delete User Account</DialogTitle>
            <DialogDescription>
              This action cannot be undone and will immediately delete all user data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive font-medium mb-2">
                ⚠️ WARNING: This action cannot be undone!
              </p>
              <p className="text-sm text-muted-foreground">
                This will immediately and permanently delete the user account and all associated data.
              </p>
            </div>
            {selectedUserForDelete && (
              <div className="bg-muted p-3 rounded text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <strong>User:</strong> 
                  <span>{selectedUserForDelete.profiles?.display_name || 'Unknown'}</span>
                  {selectedUserForDelete.profiles?.provider === 'google' && (
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      <GoogleIcon className="h-3 w-3" />
                      Google
                    </Badge>
                  )}
                </div>
                <div><strong>Scheduled for deletion:</strong> {format(new Date(selectedUserForDelete.scheduled_for), 'PPP')}</div>
              </div>
            )}
            <div>
              <Label htmlFor="deletion-reason">Reason for immediate deletion</Label>
              <Textarea
                id="deletion-reason"
                placeholder="Explain why this account is being immediately deleted..."
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setSelectedUserForDelete(null);
                setDeletionReason('');
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={loading || !deletionReason.trim()}
            >
              {loading ? 'Deleting...' : 'Permanently Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore User Dialog */}
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