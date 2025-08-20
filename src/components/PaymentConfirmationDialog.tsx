import { useState } from 'react';
import { CreditCard, Wallet, Plus, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PaymentMethod {
  id: string;
  type: 'wallet' | 'card';
  name: string;
  balance?: number;
  last4?: string;
}

interface PaymentConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  amount: number;
  onConfirm: () => void;
  onAddCard: () => void;
}

export const PaymentConfirmationDialog = ({ 
  open, 
  onClose, 
  amount, 
  onConfirm, 
  onAddCard 
}: PaymentConfirmationDialogProps) => {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('wallet');
  
  // Mock payment methods
  const paymentMethods: PaymentMethod[] = [
    {
      id: 'wallet',
      type: 'wallet',
      name: 'Wallet credits',
      balance: 0.25
    }
  ];

  const vat = amount * 0.05; // 5% VAT example
  const total = amount + vat;
  
  const selectedMethod = paymentMethods.find(m => m.id === selectedPaymentMethod);
  const canAfford = selectedMethod?.type === 'wallet' 
    ? (selectedMethod.balance || 0) >= total 
    : true;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">CONFIRM MESSAGE PURCHASE</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">You will be charged</p>
            <p className="text-2xl font-bold text-foreground">${total.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">
              ${amount.toFixed(2)} + ${vat.toFixed(2)} VAT
            </p>
          </div>

          <Separator />

          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Payment method</label>
            <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    <span>Wallet credits ${selectedMethod?.balance?.toFixed(2) || '0.00'}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((method) => (
                  <SelectItem key={method.id} value={method.id}>
                    <div className="flex items-center gap-2">
                      {method.type === 'wallet' ? (
                        <Wallet className="h-4 w-4" />
                      ) : (
                        <CreditCard className="h-4 w-4" />
                      )}
                      <span>
                        {method.name} 
                        {method.balance !== undefined && ` $${method.balance.toFixed(2)}`}
                        {method.last4 && ` ****${method.last4}`}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {!canAfford && (
              <div className="mt-2 text-center">
                <p className="text-sm text-destructive mb-2">Insufficient balance</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onAddCard}
                  className="text-primary"
                >
                  TOP UP YOUR WALLET
                </Button>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="flex-1"
            >
              CANCEL
            </Button>
            <Button 
              onClick={onConfirm}
              disabled={!canAfford}
              className="flex-1"
            >
              {canAfford ? 'CONFIRM PURCHASE' : 'INSUFFICIENT FUNDS'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};