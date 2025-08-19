import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Clock, User, Shield, AlertCircle, Eye, Heart, UserCheck, Star, ThumbsUp } from 'lucide-react';
import { useFanDeletion, PendingFanDeletion } from '@/hooks/useFanDeletion';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export const PendingFanDeletionsManager = () => {
  const [pendingDeletions, setPendingDeletions] = useState<PendingFanDeletion[]>([]);
  const [selectedUser, setSelectedUser] = useState<PendingFanDeletion | null>(null);
  const [restorationReason, setRestorationReason] = useState('');
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showFanDetailsDialog, setShowFanDetailsDialog] = useState(false);
  const [selectedFanForDetails, setSelectedFanForDetails] = useState<PendingFanDeletion | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { loading, restoreFanFromDeletion, getPendingFanDeletions } = useFanDeletion();
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
          >
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
                    </span>
                    {getStatusBadge(deletion.scheduled_for)}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openFanDetailsDialog(deletion)}
                    >
                      <Eye className="h-4 w-4" />
                      View Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openRestoreDialog(deletion)}
                      disabled={loading}
                    >
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