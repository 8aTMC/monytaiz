import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { 
  AlertTriangle, 
  CheckCircle, 
  Database, 
  HardDrive, 
  Trash2, 
  Search, 
  RefreshCw,
  FileX,
  Clock,
  Shield,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface OrphanedDataResult {
  category: string
  type: string
  count: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  items?: any[]
  size_bytes?: number
  recommendation: string
}

interface DetectionSummary {
  total_issues: number
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  potential_storage_saved: number
  categories: OrphanedDataResult[]
}

export const OrphanedDataManager: React.FC = () => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [detectionResults, setDetectionResults] = useState<DetectionSummary | null>(null);
  const [includeItems, setIncludeItems] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const detectOrphanedData = async () => {
    setIsDetecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('detect-orphaned-data', {
        body: {
          action: 'detect',
          include_items: includeItems
        }
      });

      if (error) throw error;

      setDetectionResults(data);
      toast({
        title: "Detection Complete",
        description: `Found ${data.total_issues} potential issues across ${data.categories.length} categories`,
        variant: data.total_issues > 0 ? "default" : "default"
      });
    } catch (error: any) {
      console.error('Detection error:', error);
      toast({
        title: "Detection Failed",
        description: error.message || "Failed to detect orphaned data",
        variant: "destructive"
      });
    } finally {
      setIsDetecting(false);
    }
  };

  const cleanupOrphanedData = async () => {
    if (!dryRun && selectedCategories.size === 0) {
      toast({
        title: "No Categories Selected",
        description: "Please select at least one category to cleanup",
        variant: "destructive"
      });
      return;
    }

    setIsCleaningUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('detect-orphaned-data', {
        body: {
          action: 'cleanup',
          dry_run: dryRun,
          categories: Array.from(selectedCategories)
        }
      });

      if (error) throw error;

      toast({
        title: dryRun ? "Dry Run Complete" : "Cleanup Complete",
        description: dryRun 
          ? "Preview showed what would be cleaned up"
          : `Cleaned ${data.total_records_cleaned} records, freed ${formatBytes(data.total_storage_freed)}`,
        variant: "default"
      });

      // Refresh detection after cleanup
      if (!dryRun && data.total_records_cleaned > 0) {
        setTimeout(detectOrphanedData, 1000);
      }
    } catch (error: any) {
      console.error('Cleanup error:', error);
      toast({
        title: "Cleanup Failed",
        description: error.message || "Failed to cleanup orphaned data",
        variant: "destructive"
      });
    } finally {
      setIsCleaningUp(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      case 'high': return <AlertTriangle className="h-4 w-4" />;
      case 'medium': return <Info className="h-4 w-4" />;
      case 'low': return <CheckCircle className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Storage': return <HardDrive className="h-4 w-4" />;
      case 'Database': return <Database className="h-4 w-4" />;
      default: return <FileX className="h-4 w-4" />;
    }
  };

  const toggleCategorySelection = (type: string) => {
    const newSelected = new Set(selectedCategories);
    if (newSelected.has(type)) {
      newSelected.delete(type);
    } else {
      newSelected.add(type);
    }
    setSelectedCategories(newSelected);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Orphaned Data Detection & Cleanup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                onClick={detectOrphanedData}
                disabled={isDetecting || isCleaningUp}
                className="flex items-center gap-2"
              >
                {isDetecting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {isDetecting ? 'Scanning...' : 'Detect Issues'}
              </Button>

              <div className="flex items-center gap-2">
                <Switch
                  id="include-items"
                  checked={includeItems}
                  onCheckedChange={setIncludeItems}
                />
                <label htmlFor="include-items" className="text-sm">
                  Include item details
                </label>
              </div>
            </div>

            {detectionResults && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="dry-run"
                    checked={dryRun}
                    onCheckedChange={setDryRun}
                  />
                  <label htmlFor="dry-run" className="text-sm">
                    Dry run mode
                  </label>
                </div>

                <Button
                  onClick={cleanupOrphanedData}
                  disabled={isDetecting || isCleaningUp || detectionResults.total_issues === 0}
                  variant={dryRun ? "outline" : "destructive"}
                  className="flex items-center gap-2"
                >
                  {isCleaningUp ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {isCleaningUp 
                    ? (dryRun ? 'Previewing...' : 'Cleaning...')
                    : (dryRun ? 'Preview Cleanup' : 'Execute Cleanup')
                  }
                </Button>
              </div>
            )}
          </div>

          {!dryRun && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Dry run is disabled! This will permanently delete orphaned data. 
                Make sure you've reviewed the detection results carefully.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Detection Results Summary */}
        {detectionResults && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{detectionResults.total_issues}</div>
                  <div className="text-sm text-muted-foreground">Total Issues</div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{detectionResults.critical_count}</div>
                  <div className="text-sm text-muted-foreground">Critical</div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{detectionResults.high_count}</div>
                  <div className="text-sm text-muted-foreground">High</div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{detectionResults.medium_count}</div>
                  <div className="text-sm text-muted-foreground">Medium</div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{detectionResults.low_count}</div>
                  <div className="text-sm text-muted-foreground">Low</div>
                </div>
              </Card>
            </div>

            {detectionResults.potential_storage_saved > 0 && (
              <Alert>
                <HardDrive className="h-4 w-4" />
                <AlertDescription>
                  Potential storage savings: <strong>{formatBytes(detectionResults.potential_storage_saved)}</strong>
                </AlertDescription>
              </Alert>
            )}

            {/* Detailed Results */}
            <div className="space-y-3">
              <h3 className="font-semibold">Detected Issues by Category</h3>
              
              {detectionResults.categories.map((result, index) => (
                <Card key={index} className={`${getSeverityColor(result.severity)} border`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getCategoryIcon(result.category)}
                          <span className="font-medium">{result.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                          <Badge variant="outline" className={`${getSeverityColor(result.severity)} border-0`}>
                            {getSeverityIcon(result.severity)}
                            {result.severity}
                          </Badge>
                          <Badge variant="secondary">{result.count} items</Badge>
                          {result.size_bytes && (
                            <Badge variant="secondary">{formatBytes(result.size_bytes)}</Badge>
                          )}
                        </div>
                        
                        <p className="text-sm mb-2">{result.description}</p>
                        
                        <div className="flex items-center gap-2 text-xs">
                          <Shield className="h-3 w-3" />
                          <span className="font-medium">Recommendation:</span>
                          <span>{result.recommendation}</span>
                        </div>

                        {result.items && result.items.length > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                              View {result.items.length} items...
                            </summary>
                            <div className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono max-h-32 overflow-y-auto">
                              <pre>{JSON.stringify(result.items.slice(0, 10), null, 2)}</pre>
                              {result.items.length > 10 && (
                                <div className="text-center text-muted-foreground mt-2">
                                  ... and {result.items.length - 10} more items
                                </div>
                              )}
                            </div>
                          </details>
                        )}
                      </div>

                      <div className="ml-4">
                        <Switch
                          checked={selectedCategories.has(result.type)}
                          onCheckedChange={() => toggleCategorySelection(result.type)}
                          disabled={dryRun}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {detectionResults.categories.length === 0 && (
                <Card className="p-8 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Orphaned Data Found</h3>
                  <p className="text-muted-foreground">
                    Your system is clean! All data appears to be properly linked and consistent.
                  </p>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Initial State */}
        {!detectionResults && !isDetecting && (
          <Card className="p-8 text-center">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Orphaned Data Detection</h3>
            <p className="text-muted-foreground mb-4">
              Scan your system for orphaned files, broken references, and stale data
              that can be safely cleaned up to improve performance and storage usage.
            </p>
            <Button onClick={detectOrphanedData} className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Start Detection Scan
            </Button>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};