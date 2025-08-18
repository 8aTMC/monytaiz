import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign } from 'lucide-react';

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

  const handleSave = () => {
    const numericValue = parseFloat(inputValue);
    if (!isNaN(numericValue) && numericValue >= 0) {
      onPriceChange(numericValue);
    } else {
      onPriceChange(null);
    }
    onOpenChange(false);
  };

  const handleClear = () => {
    setInputValue('');
    onPriceChange(null);
    onOpenChange(false);
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
                placeholder="0.00"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              This price will be used for AI recommendations
            </p>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClear}>
              Clear
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Price
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};