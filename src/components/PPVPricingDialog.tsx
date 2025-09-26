import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { formatRevenue } from '@/lib/formatRevenue';
import { useToast } from '@/hooks/use-toast';
import { 
  DollarSign, 
  TrendingUp, 
  BarChart3, 
  Image, 
  Video, 
  Music, 
  FileText,
  Edit2,
  Check,
  X
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface MediaItem {
  id: string;
  title: string;
  media_type: string;
  file_size: number;
  suggested_price_cents?: number;
}

interface PPVPricingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (totalPriceCents: number, filePrices: Record<string, number>) => void;
  attachedFiles: MediaItem[];
  fanId: string;
}

interface PurchaseAnalytics {
  total_spent_cents: number;
  total_purchases: number;
  average_purchase_cents: number;
  max_purchase_cents: number;
}

interface PurchaseHistory {
  date: string;
  amount_cents: number;
}

export const PPVPricingDialog = ({ isOpen, onClose, onConfirm, attachedFiles, fanId }: PPVPricingDialogProps) => {
  const [filePrices, setFilePrices] = useState<Record<string, number>>({});
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState('');
  const [customTotalPrice, setCustomTotalPrice] = useState<number>(0);
  const [analytics, setAnalytics] = useState<PurchaseAnalytics | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPriceError, setTotalPriceError] = useState<string>('');
  const [filePriceError, setFilePriceError] = useState<string>('');
  
  const MAX_PRICE = 10000; // $10,000 maximum

  // Initialize prices from suggested prices
  useEffect(() => {
    const initialPrices: Record<string, number> = {};
    attachedFiles.forEach(file => {
      initialPrices[file.id] = file.suggested_price_cents || 1000; // Default $10
    });
    setFilePrices(initialPrices);
    
    // Initialize custom total price with calculated total
    const calculatedTotal = Object.values(initialPrices).reduce((sum, price) => sum + price, 0);
    setCustomTotalPrice(calculatedTotal);
  }, [attachedFiles]);

  // Load fan analytics
  useEffect(() => {
    if (isOpen && fanId) {
      loadFanAnalytics();
      loadPurchaseHistory();
    }
  }, [isOpen, fanId]);

  const loadFanAnalytics = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('fan_purchase_analytics')
        .select('*')
        .eq('fan_id', fanId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setAnalytics(data || {
        total_spent_cents: 0,
        total_purchases: 0,
        average_purchase_cents: 0,
        max_purchase_cents: 0
      });
    } catch (error) {
      console.error('Error loading fan analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPurchaseHistory = async () => {
    try {
      // Mock data for now - will be replaced with real query later
      const mockHistory = [
        { date: '2024-01-15', amount_cents: 1500 },
        { date: '2024-01-20', amount_cents: 2500 },
        { date: '2024-01-25', amount_cents: 1800 },
        { date: '2024-02-01', amount_cents: 3200 },
        { date: '2024-02-10', amount_cents: 2800 },
        { date: '2024-02-15', amount_cents: 2100 },
        { date: '2024-02-20', amount_cents: 4500 },
      ];
      setPurchaseHistory(mockHistory);
    } catch (error) {
      console.error('Error loading purchase history:', error);
    }
  };

  const getFileTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
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

  const handlePriceEdit = (fileId: string) => {
    setEditingFile(fileId);
    setTempPrice((filePrices[fileId] / 100).toFixed(2));
  };

  const handlePriceSave = (fileId: string) => {
    const priceInDollars = parseFloat(tempPrice || '0');
    if (priceInDollars > MAX_PRICE) {
      setFilePriceError(`Maximum allowed price is $${MAX_PRICE.toLocaleString('en-US')}`);
      return;
    }
    setFilePriceError('');
    const price = Math.round(priceInDollars * 100);
    setFilePrices(prev => ({ ...prev, [fileId]: price }));
    setEditingFile(null);
    setTempPrice('');
  };

  const handlePriceCancel = () => {
    setEditingFile(null);
    setTempPrice('');
    setFilePriceError('');
  };

  const calculatedTotalPrice = Object.values(filePrices).reduce((sum, price) => sum + price, 0);

  const handleResetToCalculated = () => {
    setCustomTotalPrice(calculatedTotalPrice);
  };

  const handleConfirm = () => {
    onConfirm(customTotalPrice, filePrices);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Set PPV Price
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="pricing" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pricing">File Pricing</TabsTrigger>
            <TabsTrigger value="analytics">Fan Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="pricing" className="flex-1 flex flex-col space-y-4">
            <ScrollArea className="flex-1">
              <div className="space-y-3">
                {attachedFiles.map((file) => (
                  <Card key={file.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            {getFileTypeIcon(file.media_type)}
                          </div>
                          <div>
                            <p className="font-medium">{file.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {file.media_type} • {formatFileSize(file.file_size)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                           {editingFile === file.id ? (
                             <div className="space-y-2">
                               <div className="flex items-center gap-2">
                                 <Input
                                   type="number"
                                   value={tempPrice}
                                   onChange={(e) => setTempPrice(e.target.value)}
                                   placeholder="0.00"
                                   className="w-20"
                                   step="0.01"
                                   min="0"
                                   max="10000"
                                 />
                                 <Button
                                   size="sm"
                                   variant="ghost"
                                   onClick={() => handlePriceSave(file.id)}
                                 >
                                   <Check className="h-4 w-4" />
                                 </Button>
                                 <Button
                                   size="sm"
                                   variant="ghost"
                                   onClick={handlePriceCancel}
                                 >
                                   <X className="h-4 w-4" />
                                 </Button>
                               </div>
                               {filePriceError && (
                                 <p className="text-sm text-destructive">{filePriceError}</p>
                               )}
                             </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-lg font-semibold">
                                ${(filePrices[file.id] / 100).toFixed(2)}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handlePriceEdit(file.id)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            {/* Total Price */}
            <Card className="border-2 border-primary">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Total Pack Price</h3>
                    <p className="text-sm text-muted-foreground">
                      {attachedFiles.length} file{attachedFiles.length !== 1 ? 's' : ''}
                      {customTotalPrice !== calculatedTotalPrice && (
                        <span className="ml-2 text-xs text-orange-600">
                          • Custom price (calculated: ${(calculatedTotalPrice / 100).toFixed(2)})
                        </span>
                      )}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      value={(customTotalPrice / 100).toFixed(2)}
                      onChange={(e) => {
                        const priceInDollars = parseFloat(e.target.value || '0');
                        if (priceInDollars > MAX_PRICE) {
                          setTotalPriceError(`Maximum allowed price is $${MAX_PRICE.toLocaleString('en-US')}`);
                          return;
                        }
                        setTotalPriceError('');
                        setCustomTotalPrice(Math.round(priceInDollars * 100));
                      }}
                      placeholder="0.00"
                      className="w-32 text-right text-xl font-bold"
                      step="0.01"
                      min="0"
                      max="10000"
                    />
                  </div>
                </div>
                
                {(totalPriceError || customTotalPrice !== calculatedTotalPrice) && (
                  <div className="mt-3 pt-3 border-t flex justify-between items-center">
                    {customTotalPrice !== calculatedTotalPrice && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleResetToCalculated}
                        className="text-xs"
                      >
                        Reset to calculated price
                      </Button>
                    )}
                    {totalPriceError && (
                      <p className="text-sm text-destructive">{totalPriceError}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="flex-1 flex flex-col space-y-4">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-pulse">Loading analytics...</div>
              </div>
            ) : (
              <>
                {/* Analytics Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p className="text-sm text-muted-foreground">Total Spent</p>
                      <p className="text-2xl font-bold">
                        {formatRevenue(analytics?.total_spent_cents || 0)}
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4 text-center">
                      <BarChart3 className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                      <p className="text-sm text-muted-foreground">Purchases</p>
                      <p className="text-2xl font-bold">{analytics?.total_purchases || 0}</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4 text-center">
                      <DollarSign className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                      <p className="text-sm text-muted-foreground">Average</p>
                      <p className="text-2xl font-bold">
                        {formatRevenue(analytics?.average_purchase_cents || 0)}
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4 text-center">
                      <TrendingUp className="h-8 w-8 mx-auto mb-2 text-orange-500" />
                      <p className="text-sm text-muted-foreground">Max Purchase</p>
                      <p className="text-2xl font-bold">
                        {formatRevenue(analytics?.max_purchase_cents || 0)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Purchase History Chart */}
                <Card className="flex-1">
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-4">Purchase History</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={purchaseHistory}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis tickFormatter={(value) => `$${(value / 100).toFixed(0)}`} />
                          <Tooltip 
                            formatter={(value: number) => [`$${(value / 100).toFixed(2)}`, 'Amount']}
                            labelFormatter={(label) => `Date: ${label}`}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="amount_cents" 
                            stroke="hsl(var(--primary))" 
                            strokeWidth={2}
                            dot={{ fill: 'hsl(var(--primary))' }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Recommended: ${((analytics?.average_purchase_cents || 1000) / 100).toFixed(2)} - ${((analytics?.max_purchase_cents || 2000) / 100).toFixed(2)}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} className="min-w-[120px]">
              Set Price ${(customTotalPrice / 100).toFixed(2)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};