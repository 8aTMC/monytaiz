import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import { runOrphanedDataCleanup } from '@/utils/runOrphanedDataCleanup';
import { useToast } from '@/hooks/use-toast';

export const QuickOrphanedDataCleanup = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const handleCleanup = async () => {
    setIsRunning(true);
    setResults(null);

    try {
      const result = await runOrphanedDataCleanup();
      setResults(result.results);
      
      toast({
        title: "Cleanup Complete",
        description: result.message,
        variant: "default"
      });
    } catch (error: any) {
      console.error('Cleanup failed:', error);
      toast({
        title: "Cleanup Failed",
        description: error.message || "Failed to run orphaned data cleanup",
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-destructive" />
          Quick Orphaned Data Cleanup
        </CardTitle>
        <CardDescription>
          Fix the duplicate detection issue by cleaning up orphaned database records
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleCleanup}
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <AlertTriangle className="w-4 h-4 mr-2 animate-spin" />
              Running Cleanup...
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4 mr-2" />
              Run Orphaned Data Cleanup
            </>
          )}
        </Button>

        {results && (
          <div className="mt-4 p-3 rounded-md bg-muted">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="font-medium">Cleanup Results</span>
            </div>
            <div className="text-sm space-y-1">
              <p>Records cleaned: {results.total_records_cleaned || 0}</p>
              <p>Storage freed: {results.total_storage_freed ? `${(results.total_storage_freed / 1024 / 1024).toFixed(2)} MB` : '0 MB'}</p>
              {results.categories && results.categories.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium">Categories cleaned:</p>
                  <ul className="list-disc list-inside">
                    {results.categories.map((cat: any, idx: number) => (
                      <li key={idx}>{cat.description}: {cat.count} items</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          <p><strong>Note:</strong> This will detect and remove orphaned database records that reference deleted files, including the "Woman Horizontal Video 4 (4K).mov" record causing your duplicate detection issue.</p>
        </div>
      </CardContent>
    </Card>
  );
};