import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  price?: number;
  onPriceChange: (price: number | null) => void;
}

export function PriceDialog({ open, onOpenChange, price = 0, onPriceChange }: PriceDialogProps) {
  const [inputValue, setInputValue] = useState((price ?? 0).toFixed(2));
  const { toast } = useToast();
  
  const MAX_PRICE = 10000; // $10,000 maximum

  // Format price input to handle both comma and dot as decimal separators
  const formatPriceInput = (value: string): string => {
    // Replace comma with dot for decimal separator
    let formatted = value.replace(/,/g, '.');
    
    // Remove any characters that aren't digits, decimal points, or negative signs
    formatted = formatted.replace(/[^\d.-]/g, '');
    
    // Ensure only one decimal point
    const parts = formatted.split('.');
    if (parts.length > 2) {
      formatted = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Limit to 2 decimal places
    if (parts[1] && parts[1].length > 2) {
      formatted = parts[0] + '.' + parts[1].substring(0, 2);
    }
    
    return formatted;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPriceInput(e.target.value);
    setInputValue(formatted);
  };

  const handleSave = () => {
    const numericValue = parseFloat(inputValue);
    if (isNaN(numericValue) || numericValue < 0) {
      onPriceChange(0);
    } else if (numericValue > MAX_PRICE) {
      toast({
        title: "Price Limit Exceeded",
        description: `Maximum allowed price is ${formatDisplayValue(MAX_PRICE)}`,
        variant: "destructive",
      });
      return;
    } else {
      // Round to 2 decimal places and convert to cents
      const roundedValue = Math.round(numericValue * 100) / 100;
      onPriceChange(roundedValue);
    }
    onOpenChange(false);
  };

const handleCancel = () => {
  setInputValue((price ?? 0).toFixed(2));
  onOpenChange(false);
};

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  // Format display value with proper thousands separators
  const formatDisplayValue = (value: number): string => {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const previewValue = parseFloat(inputValue) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] z-[1200]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Set Suggested Price
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="price-input" className="text-sm font-medium">
              Price (USD)
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="price-input"
                placeholder="0.00"
                value={inputValue}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                className="pl-9"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Use either comma (,) or dot (.) as decimal separator. Maximum price: {formatDisplayValue(MAX_PRICE)}
            </p>
          </div>

          {previewValue > 0 && (
            <div className="p-3 bg-muted/50 rounded-lg border">
              <p className="text-sm text-muted-foreground">Preview:</p>
              <p className="text-lg font-semibold text-foreground">{formatDisplayValue(previewValue)}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleCancel}>
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
}