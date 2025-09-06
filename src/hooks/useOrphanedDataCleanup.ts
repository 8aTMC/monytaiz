import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

export const useOrphanedDataCleanup = () => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [detectionResults, setDetectionResults] = useState<DetectionSummary | null>(null);
  const { toast } = useToast();

  const detectOrphanedData = async (includeItems: boolean = false) => {
    setIsDetecting(true);
    try {
      console.log('Starting orphaned data detection...');
      
      const { data, error } = await supabase.functions.invoke('detect-orphaned-data', {
        body: {
          action: 'detect',
          include_items: includeItems
        }
      });

      if (error) {
        console.error('Detection error:', error);
        throw error;
      }

      console.log('Detection results:', data);
      setDetectionResults(data);
      
      toast({
        title: "Detection Complete",
        description: `Found ${data.total_issues} potential issues across ${data.categories?.length || 0} categories`,
        variant: "default"
      });

      return { success: true, data };
    } catch (error: any) {
      console.error('Detection failed:', error);
      toast({
        title: "Detection Failed",
        description: error.message || "Failed to detect orphaned data",
        variant: "destructive"
      });
      return { success: false, error: error.message };
    } finally {
      setIsDetecting(false);
    }
  };

  const cleanupOrphanedData = async (dryRun: boolean = true, categories: string[] = []) => {
    setIsCleaningUp(true);
    try {
      console.log('Starting cleanup with dry_run:', dryRun, 'categories:', categories);
      
      const { data, error } = await supabase.functions.invoke('detect-orphaned-data', {
        body: {
          action: 'cleanup',
          dry_run: dryRun,
          categories
        }
      });

      if (error) {
        console.error('Cleanup error:', error);
        throw error;
      }

      console.log('Cleanup results:', data);
      
      toast({
        title: dryRun ? "Dry Run Complete" : "Cleanup Complete",
        description: dryRun 
          ? "Preview showed what would be cleaned up"
          : `Cleaned ${data.total_records_cleaned || 0} records, freed ${formatBytes(data.total_storage_freed || 0)}`,
        variant: "default"
      });

      // Refresh detection after actual cleanup
      if (!dryRun && data.total_records_cleaned > 0) {
        setTimeout(() => detectOrphanedData(false), 2000);
      }

      return { success: true, data };
    } catch (error: any) {
      console.error('Cleanup failed:', error);
      toast({
        title: "Cleanup Failed",
        description: error.message || "Failed to cleanup orphaned data",
        variant: "destructive"
      });
      return { success: false, error: error.message };
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

  const clearResults = () => {
    setDetectionResults(null);
  };

  return {
    detectOrphanedData,
    cleanupOrphanedData,
    clearResults,
    formatBytes,
    isDetecting,
    isCleaningUp,
    detectionResults,
    isLoading: isDetecting || isCleaningUp
  };
};