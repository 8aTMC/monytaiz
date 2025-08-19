import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Clock, User, Shield, AlertCircle, Eye, Heart, UserCheck, Star, ThumbsUp, RefreshCw } from 'lucide-react';
import { useFanDeletion, PendingFanDeletion } from '@/hooks/useFanDeletion';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// Google icon component
const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export const PendingFanDeletionsManager = () => {
  const [pendingDeletions, setPendingDeletions] = useState<PendingFanDeletion[]>([]);
  const [selectedUser, setSelectedUser] = useState<PendingFanDeletion | null>(null);
  const [restorationReason, setRestorationReason] = useState('');
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showFanDetailsDialog, setShowFanDetailsDialog] = useState(false);
  const [selectedFanForDetails, setSelectedFanForDetails] = useState<PendingFanDeletion | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUserForDelete, setSelectedUserForDelete] = useState<PendingFanDeletion | null>(null);
  const [deletionReason, setDeletionReason] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { loading, restoreFanFromDeletion, getPendingFanDeletions, immediatelyDeleteFan } = useFanDeletion();
  const { toast } = useToast();

  const loadPendingDeletions = async () => {
    setRefreshing(true);
    try {
      const deletions = await getPendingFanDeletions();
      setPendingDeletions(deletions);
    } catch (error) {
      console.error('Error loading pending fan deletions:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPendingDeletions();
  }, []);

  const handleRestoreFan = async () => {
    if (!selectedUser || !restorationReason.trim()) return;

    try {
      await restoreFanFromDeletion(selectedUser.user_id, restorationReason);
      setShowRestoreDialog(false);
      setSelectedUser(null);
      setRestorationReason('');
      await loadPendingDeletions();
    } catch (error) {
      console.error('Error restoring fan:', error);
    }
  };

  const openRestoreDialog = (deletion: PendingFanDeletion) => {
    setSelectedUser(deletion);
    setShowRestoreDialog(true);
  };

  const handleDeleteFan = async () => {
    if (!selectedUserForDelete || !deletionReason.trim()) return;

    try {
      await immediatelyDeleteFan(selectedUserForDelete.user_id, deletionReason);
      setShowDeleteDialog(false);
      setSelectedUserForDelete(null);
      setDeletionReason('');
      await loadPendingDeletions();
    } catch (error) {
      console.error('Error deleting fan:', error);
    }
  };

  const openDeleteDialog = (deletion: PendingFanDeletion) => {
    setSelectedUserForDelete(deletion);
    setShowDeleteDialog(true);
  };

  const openFanDetailsDialog = (deletion: PendingFanDeletion) => {
    setSelectedFanForDetails(deletion);
    setShowFanDetailsDialog(true);
  };

  const getFanCategoryIcon = (category?: string) => {
    switch (category) {
      case 'husband': return <Heart className="h-4 w-4 text-red-500" />;
      case 'boyfriend': return <UserCheck className="h-4 w-4 text-pink-500" />;
      case 'supporter': return <Star className="h-4 w-4 text-yellow-500" />;
      case 'friend': return <ThumbsUp className="h-4 w-4 text-blue-500" />;
      default: return <User className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const isExpired = (scheduledFor: string) => {
    return new Date(scheduledFor) <= new Date();
  };

  const getStatusBadge = (scheduledFor: string) => {
    const expired = isExpired(scheduledFor);
    return (
      <Badge variant={expired ? "destructive" : "secondary"}>
        {expired ? "Expired" : "Pending"}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-foreground">Pending Fan Deletions</h2>
          <Button 
            onClick={loadPendingDeletions} 
            disabled={refreshing}
            variant="outline"
            size="sm"
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
        <p className="text-muted-foreground">
          Manage fan accounts scheduled for deletion
        </p>
      </div>

      {pendingDeletions.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                No pending fan deletions
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                All fan accounts are active and not scheduled for deletion.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pendingDeletions.map((deletion) => (
            <Card key={deletion.id} className="border-l-4 border-l-orange-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {getFanCategoryIcon(deletion.profiles?.fan_category)}
                    <span className="flex items-center gap-2">
                      {deletion.profiles?.display_name || deletion.profiles?.username || `Fan ${deletion.user_id.slice(0, 8)}`}
                      {deletion.profiles?.is_verified && (
                        <Badge variant="secondary" className="text-xs">Verified</Badge>
                      )}
                      {deletion.profiles?.provider === 'google' && (
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <GoogleIcon className="h-3 w-3" />
                          Google
                        </Badge>
                      )}
                    </span>
                    {getStatusBadge(deletion.scheduled_for)}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openDeleteDialog(deletion)}
                      disabled={loading}
                      className="flex items-center gap-1"
                    >
                      <AlertCircle className="h-3.5 w-3.5" />
                      Fully Delete
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openFanDetailsDialog(deletion)}
                      className="flex items-center gap-1"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openRestoreDialog(deletion)}
                      disabled={loading}
                      className="flex items-center gap-1"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      Restore Fan
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-muted-foreground">Deletion Type</p>
                    <p className="flex items-center gap-1">
                      {deletion.is_self_requested ? (
                        <>
                          <User className="h-4 w-4" />
                          Self-requested
                        </>
                      ) : (
                        <>
                          <Shield className="h-4 w-4" />
                          Admin-initiated
                        </>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">Requested</p>
                    <p className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(deletion.requested_at), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">Scheduled For</p>
                    <p className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {format(new Date(deletion.scheduled_for), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">Status</p>
                    <p className="flex items-center gap-1">
                      {isExpired(deletion.scheduled_for) ? (
                        <>
                          <AlertCircle className="h-4 w-4 text-destructive" />
                          Ready for deletion
                        </>
                      ) : (
                        <>
                          <Clock className="h-4 w-4 text-orange-500" />
                          {Math.ceil((new Date(deletion.scheduled_for).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days remaining
                        </>
                      )}
                    </p>
                  </div>
                </div>
                {deletion.reason && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <p className="font-medium text-sm text-muted-foreground mb-1">Reason:</p>
                    <p className="text-sm">{deletion.reason}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Fully Delete Fan Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Permanently Delete Fan Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive font-medium mb-2">
                ⚠️ WARNING: This action cannot be undone!
              </p>
              <p className="text-sm text-muted-foreground">
                This will immediately and permanently delete the fan account and all associated data.
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                You are about to permanently delete the following fan account:
              </p>
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">
                  {selectedUserForDelete?.profiles?.display_name || selectedUserForDelete?.profiles?.username || 'Unknown Fan'}
                </p>
                <p className="text-sm text-muted-foreground">
                  User ID: {selectedUserForDelete?.user_id}
                </p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">
                Deletion Reason <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                placeholder="Explain why this fan account is being permanently deleted..."
                className="mt-1"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setSelectedUserForDelete(null);
                  setDeletionReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteFan}
                disabled={!deletionReason.trim() || loading}
              >
                {loading ? "Deleting..." : "Permanently Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fan Details Dialog */}
      <Dialog open={showFanDetailsDialog} onOpenChange={setShowFanDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedFanForDetails && getFanCategoryIcon(selectedFanForDetails.profiles?.fan_category)}
              Fan Account Details
            </DialogTitle>
          </DialogHeader>
          {selectedFanForDetails && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Display Name</label>
                  <p className="text-sm font-medium">
                    {selectedFanForDetails.profiles?.display_name || 'Not set'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Username</label>
                  <p className="text-sm font-medium">
                    {selectedFanForDetails.profiles?.username || 'Not set'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Fan Category</label>
                  <p className="text-sm font-medium flex items-center gap-1">
                    {getFanCategoryIcon(selectedFanForDetails.profiles?.fan_category)}
                    {selectedFanForDetails.profiles?.fan_category || 'fan'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Sign-up Method</label>
                  <p className="text-sm font-medium flex items-center gap-1">
                    {selectedFanForDetails.profiles?.provider === 'google' ? (
                      <>
                        <GoogleIcon className="h-4 w-4" />
                        Google
                      </>
                    ) : (
                      <>
                        <User className="h-4 w-4" />
                        Email
                      </>
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Joined</label>
                  <p className="text-sm font-medium">
                    {selectedFanForDetails.profiles?.created_at 
                      ? format(new Date(selectedFanForDetails.profiles.created_at), 'PPP')
                      : 'Unknown'
                    }
                  </p>
                </div>
              </div>

              {/* Bio */}
              {selectedFanForDetails.profiles?.bio && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Bio</label>
                  <p className="text-sm mt-1 p-3 bg-muted rounded-lg">
                    {selectedFanForDetails.profiles.bio}
                  </p>
                </div>
              )}

              {/* Deletion Info */}
              <div className="border-t pt-4">
                <label className="text-sm font-medium text-muted-foreground">Deletion Information</label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Deletion Type</p>
                    <p className="text-sm font-medium">
                      {selectedFanForDetails.is_self_requested ? 'Self-requested' : 'Admin-initiated'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Scheduled For</p>
                    <p className="text-sm font-medium">
                      {format(new Date(selectedFanForDetails.scheduled_for), 'PPP')}
                    </p>
                  </div>
                </div>
                {selectedFanForDetails.reason && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground">Reason</p>
                    <p className="text-sm mt-1 p-2 bg-muted rounded">
                      {selectedFanForDetails.reason}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Restore Fan Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Fan Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                You are about to restore the following fan account:
              </p>
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">
                  {selectedUser?.profiles?.display_name || selectedUser?.profiles?.username || 'Unknown Fan'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Scheduled for deletion: {selectedUser && format(new Date(selectedUser.scheduled_for), 'PPP')}
                </p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">
                Restoration Reason <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={restorationReason}
                onChange={(e) => setRestorationReason(e.target.value)}
                placeholder="Explain why this fan account is being restored..."
                className="mt-1"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRestoreDialog(false);
                  setSelectedUser(null);
                  setRestorationReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRestoreFan}
                disabled={!restorationReason.trim() || loading}
              >
                {loading ? "Restoring..." : "Restore Account"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};