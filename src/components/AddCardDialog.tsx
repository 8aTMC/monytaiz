import { useState } from 'react';
import { CreditCard, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AddCardDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (cardData: any) => void;
}

export const AddCardDialog = ({ open, onClose, onSave }: AddCardDialogProps) => {
  const [formData, setFormData] = useState({
    email: 'luisal@flamantnoir.com',
    country: 'ES',
    state: 'Madrid',
    address: '',
    city: 'Madrid',
    zipCode: '',
    cardName: '',
    cardNumber: '',
    expiry: '',
    cvc: '',
    saveCard: false,
    ageConfirm: false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ageConfirm) {
      alert('Please confirm you are at least 18 years old');
      return;
    }
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-background max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">ADD CARD</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Billing Details */}
          <div>
            <h3 className="text-sm font-medium text-primary mb-3">BILLING DETAILS</h3>
            <p className="text-xs text-muted-foreground mb-4">
              We are fully compliant with Payment Card Industry Data Security Standards.
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="country" className="text-xs text-muted-foreground">Country</Label>
                <Select value={formData.country} onValueChange={(value) => setFormData({...formData, country: value})}>
                  <SelectTrigger>
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <span className="text-xs">🇪🇸</span>
                        <span>Spain</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ES">
                      <div className="flex items-center gap-2">
                        <span>🇪🇸</span>
                        <span>Spain</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="state" className="text-xs text-muted-foreground">State / Province</Label>
                <Select value={formData.state} onValueChange={(value) => setFormData({...formData, state: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Madrid, Comunidad ..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Madrid">Madrid, Comunidad de Madrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="mt-4">
              <Label htmlFor="address" className="text-xs text-muted-foreground">Address</Label>
              <Input 
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="mt-1"
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <Label htmlFor="city" className="text-xs text-muted-foreground">City</Label>
                <Input 
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="zipCode" className="text-xs text-muted-foreground">ZIP / Postal Code</Label>
                <Input 
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) => setFormData({...formData, zipCode: e.target.value})}
                  className="mt-1"
                  required
                />
              </div>
            </div>
          </div>

          {/* Card Details */}
          <div>
            <h3 className="text-sm font-medium text-primary mb-3">CARD DETAILS</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email" className="text-xs text-muted-foreground">E-mail</Label>
                <Input 
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="cardName" className="text-xs text-muted-foreground">Name on the card</Label>
                <Input 
                  id="cardName"
                  value={formData.cardName}
                  onChange={(e) => setFormData({...formData, cardName: e.target.value})}
                  className="mt-1"
                  required
                />
              </div>
            </div>
            
            <div className="mt-4">
              <Label htmlFor="cardNumber" className="text-xs text-muted-foreground">Card Number</Label>
              <div className="relative">
                <Input 
                  id="cardNumber"
                  value={formData.cardNumber}
                  onChange={(e) => setFormData({...formData, cardNumber: e.target.value})}
                  placeholder="1234 5678 9012 3456"
                  className="mt-1 pr-10"
                  required
                />
                <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              {formData.cardNumber.length > 16 && (
                <p className="text-xs text-primary mt-1">My card number is longer</p>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <Label htmlFor="expiry" className="text-xs text-muted-foreground">Expiration</Label>
                <Input 
                  id="expiry"
                  placeholder="MM / YY"
                  value={formData.expiry}
                  onChange={(e) => setFormData({...formData, expiry: e.target.value})}
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="cvc" className="text-xs text-muted-foreground">CVC</Label>
                <Input 
                  id="cvc"
                  placeholder="123"
                  value={formData.cvc}
                  onChange={(e) => setFormData({...formData, cvc: e.target.value})}
                  className="mt-1"
                  required
                />
              </div>
            </div>
          </div>

          {/* Age Confirmation */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="ageConfirm"
              checked={formData.ageConfirm}
              onCheckedChange={(checked) => setFormData({...formData, ageConfirm: !!checked})}
              required
            />
            <Label htmlFor="ageConfirm" className="text-xs text-muted-foreground">
              Tick here to confirm that you are at least 18 years old and the age of majority in your place of residence
            </Label>
          </div>

          {/* Payment Icons */}
          <div className="flex justify-center gap-2 py-4">
            <img src="/api/placeholder/32/20" alt="Visa" className="h-5" />
            <img src="/api/placeholder/32/20" alt="Mastercard" className="h-5" />
            <img src="/api/placeholder/32/20" alt="Maestro" className="h-5" />
            <img src="/api/placeholder/32/20" alt="Diners" className="h-5" />
            <img src="/api/placeholder/32/20" alt="Discover" className="h-5" />
            <img src="/api/placeholder/32/20" alt="JCB" className="h-5" />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              type="button"
              variant="outline" 
              onClick={onClose}
              className="flex-1"
            >
              CANCEL
            </Button>
            <Button 
              type="submit"
              className="flex-1"
              disabled={!formData.ageConfirm}
            >
              SUBMIT
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};