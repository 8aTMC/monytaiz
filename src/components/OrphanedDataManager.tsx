import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Trash2, Search } from 'lucide-react';
import { useOrphanedDataCleanup } from '@/hooks/useOrphanedDataCleanup';

export const OrphanedDataManager = () => {
  const { 
    detectOrphanedData, 
    cleanupOrphanedData, 
    detectionResults, 
    isDetecting, 
    isCleaningUp, 
    formatBytes 
  } = useOrphanedDataCleanup();

  const handleDetect = () => {
    detectOrphanedData(true);
  };

  const handleCleanup = () => {
    if (detectionResults?.total_issues > 0) {
      cleanupOrphanedData(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" />
          Database Cleanup Manager
        </CardTitle>
        <CardDescription>
          Clean up orphaned database records that point to deleted storage files (like the HEIC file issue)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={handleDetect}
            disabled={isDetecting || isCleaningUp}
            variant="outline"
            size="sm"
          >
            <Search className="w-4 h-4 mr-2" />
            {isDetecting ? 'Scanning...' : 'Scan for Orphaned Data'}
          </Button>

          {detectionResults?.total_issues > 0 && (
            <Button 
              onClick={handleCleanup}
              disabled={isDetecting || isCleaningUp}
              variant="destructive" 
              size="sm"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {isCleaningUp ? 'Cleaning...' : `Clean ${detectionResults.total_issues} Issues`}
            </Button>
          )}
        </div>

        {detectionResults && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center p-2 rounded bg-muted">
                <div className="font-semibold text-destructive">{detectionResults.critical_count}</div>
                <div className="text-muted-foreground">Critical</div>
              </div>
              <div className="text-center p-2 rounded bg-muted">
                <div className="font-semibold text-orange-500">{detectionResults.high_count}</div>
                <div className="text-muted-foreground">High</div>
              </div>
              <div className="text-center p-2 rounded bg-muted">
                <div className="font-semibold text-yellow-500">{detectionResults.medium_count}</div>
                <div className="text-muted-foreground">Medium</div>
              </div>
              <div className="text-center p-2 rounded bg-muted">
                <div className="font-semibold text-blue-500">{detectionResults.low_count}</div>
                <div className="text-muted-foreground">Low</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-sm font-medium mb-2">Issues Found:</div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {detectionResults.categories.map((category, index) => (
                  <div key={index} className="flex justify-between items-center p-2 rounded bg-muted/50">
                    <div>
                      <div className="font-medium">{category.description}</div>
                      <div className="text-xs text-muted-foreground">{category.recommendation}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{category.count}</div>
                      {category.size_bytes && (
                        <div className="text-xs text-muted-foreground">
                          {formatBytes(category.size_bytes)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {detectionResults.potential_storage_saved > 0 && (
              <div className="text-sm text-muted-foreground">
                Potential storage saved: {formatBytes(detectionResults.potential_storage_saved)}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};