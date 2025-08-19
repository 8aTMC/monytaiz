import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Clock, User, Shield, AlertCircle } from 'lucide-react';
import { useFanDeletion, PendingFanDeletion } from '@/hooks/useFanDeletion';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export const PendingFanDeletionsManager = () => {
  const [pendingDeletions, setPendingDeletions] = useState<PendingFanDeletion[]>([]);
  const [selectedUser, setSelectedUser] = useState<PendingFanDeletion | null>(null);
  const [restorationReason, setRestorationReason] = useState('');
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Pending Fan Deletions</h2>
          <p className="text-muted-foreground">
            Manage fan accounts scheduled for deletion
          </p>
        </div>
        <Button 
          onClick={loadPendingDeletions} 
          disabled={refreshing}
          variant="outline"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
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
                    <User className="h-5 w-5 text-primary" />
                    {deletion.profiles?.display_name || deletion.profiles?.username || 'Unknown Fan'}
                    {getStatusBadge(deletion.scheduled_for)}
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openRestoreDialog(deletion)}
                    disabled={loading}
                  >
                    Restore Fan
                  </Button>
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