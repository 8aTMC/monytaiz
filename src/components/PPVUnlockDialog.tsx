import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Lock, 
  CreditCard, 
  Shield, 
  Clock,
  Image,
  Video,
  Music,
  FileText,
  CheckCircle
} from 'lucide-react';

interface MessageFile {
  id: string;
  type: string;
  name: string;
  url?: string;
  preview?: string;
  size: number;
  locked: boolean;
  price?: number;
}

interface PPVUnlockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlockComplete: () => void;
  files: MessageFile[];
  messageId: string;
  sellerId: string;
  buyerId: string;
}

export const PPVUnlockDialog = ({ 
  isOpen, 
  onClose, 
  onUnlockComplete, 
  files, 
  messageId, 
  sellerId, 
  buyerId 
}: PPVUnlockDialogProps) => {
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const getFileTypeIcon = (type: string) => {
    switch (type) {
      case 'images': return <Image className="h-4 w-4" />;
      case 'videos': return <Video className="h-4 w-4" />;
      case 'audio': return <Music className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalPrice = files.reduce((sum, f) => sum + (f.price || 0), 0);
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  // Group files by type for display
  const groupedFiles = files.reduce((acc, file) => {
    if (!acc[file.type]) acc[file.type] = [];
    acc[file.type].push(file);
    return acc;
  }, {} as Record<string, MessageFile[]>);

  const handleUnlock = async () => {
    try {
      setProcessing(true);

      // Create PPV transaction
      const { data: transaction, error: transactionError } = await supabase
        .from('ppv_transactions')
        .insert({
          buyer_id: buyerId,
          seller_id: sellerId,
          message_id: messageId,
          total_amount_cents: Math.round(totalPrice * 100),
          status: 'completed', // For demo purposes
          payment_method: 'demo',
          processed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Grant access to all files in the message
      const accessPromises = files.map(file => 
        supabase
          .from('fan_file_access')
          .insert({
            fan_id: buyerId,
            media_id: file.id,
            media_table: 'simple_media', // Assuming simple_media for now
            access_type: 'purchased',
            granted_by: sellerId,
            message_id: messageId,
            price_paid_cents: Math.round((file.price || 0) * 100)
          })
      );

      await Promise.all(accessPromises);

      // Update fan purchase analytics
      const { data: existingAnalytics } = await supabase
        .from('fan_purchase_analytics')
        .select('*')
        .eq('fan_id', buyerId)
        .maybeSingle();

      const totalSpentCents = Math.round(totalPrice * 100);
      
      if (existingAnalytics) {
        const newTotalSpent = existingAnalytics.total_spent_cents + totalSpentCents;
        const newTotalPurchases = existingAnalytics.total_purchases + 1;
        const newAverage = Math.round(newTotalSpent / newTotalPurchases);
        const newMax = Math.max(existingAnalytics.max_purchase_cents, totalSpentCents);

        await supabase
          .from('fan_purchase_analytics')
          .update({
            total_spent_cents: newTotalSpent,
            total_purchases: newTotalPurchases,
            average_purchase_cents: newAverage,
            max_purchase_cents: newMax,
            last_purchase_at: new Date().toISOString()
          })
          .eq('fan_id', buyerId);
      } else {
        await supabase
          .from('fan_purchase_analytics')
          .insert({
            fan_id: buyerId,
            total_spent_cents: totalSpentCents,
            total_purchases: 1,
            average_purchase_cents: totalSpentCents,
            max_purchase_cents: totalSpentCents,
            first_purchase_at: new Date().toISOString(),
            last_purchase_at: new Date().toISOString()
          });
      }

      toast({
        title: "Content Unlocked!",
        description: `Successfully unlocked ${files.length} file${files.length !== 1 ? 's' : ''} for $${totalPrice.toFixed(2)}`,
      });

      onUnlockComplete();
      onClose();

    } catch (error) {
      console.error('Error processing PPV purchase:', error);
      toast({
        title: "Purchase Failed",
        description: "Failed to unlock content. Please try again.",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Unlock Content
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Content Preview */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Content Pack</h3>
                <Badge variant="secondary">{files.length} files</Badge>
              </div>
              
              <div className="space-y-2">
                {Object.entries(groupedFiles).map(([type, typeFiles]) => (
                  <div key={type} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {getFileTypeIcon(type)}
                      <span className="capitalize">{type}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {typeFiles.length} file{typeFiles.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
              
              <Separator className="my-3" />
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total size</span>
                <span>{formatFileSize(totalSize)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Section */}
          <Card className="border-2 border-primary">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-5 w-5" />
                <h3 className="font-semibold">Payment</h3>
              </div>
              
              <div className="space-y-3">
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    This is where the Payment gateway will go
                  </p>
                  <div className="text-2xl font-bold">${totalPrice.toFixed(2)}</div>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>Secure payment processing</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Instant access after payment</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleUnlock}
              disabled={processing}
              className="flex-1"
            >
              {processing ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Processing...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Confirm ${totalPrice.toFixed(2)}
                </div>
              )}
            </Button>
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground text-center">
            By confirming, you agree to purchase this content. All sales are final.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};