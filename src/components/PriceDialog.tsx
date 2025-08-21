import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign, AlertCircle } from 'lucide-react';

const MAX_PRICE = 10000.00;

interface PriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  price: number | null;
  onPriceChange: (price: number | null) => void;
}

export const PriceDialog = ({
  open,
  onOpenChange,
  price,
  onPriceChange,
}: PriceDialogProps) => {
  const [inputValue, setInputValue] = useState(price?.toString() || '');
  const [error, setError] = useState('');

  const handleSave = () => {
    const numericValue = parseFloat(inputValue);
    
    if (isNaN(numericValue) || numericValue < 0) {
      setError('Please enter a valid price');
      return;
    }
    
    if (numericValue > MAX_PRICE) {
      setError(`Maximum price is $${MAX_PRICE.toLocaleString()}`);
      return;
    }
    
    setError('');
    onPriceChange(numericValue);
    onOpenChange(false);
  };

  const handleClear = () => {
    setInputValue('');
    setError('');
    onPriceChange(null);
    onOpenChange(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
    
    // Prevent input above max value
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue) && numericValue > MAX_PRICE) {
      setError(`Maximum price is $${MAX_PRICE.toLocaleString()}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Set Suggested Price</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="price" className="text-sm font-medium">
              Suggested Price
            </Label>
            <div className="relative mt-1">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                max={MAX_PRICE}
                placeholder="0.00"
                value={inputValue}
                onChange={handleInputChange}
                className="pl-9"
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive mt-1">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              This price will be used for AI recommendations (Max: ${MAX_PRICE.toLocaleString()})
            </p>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClear}>
              Clear
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!!error && inputValue !== ''}
            >
              Save Price
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};