import { supabase } from '@/integrations/supabase/client';

export const runOrphanedDataCleanup = async () => {
  console.log('🔍 Starting orphaned data detection...');
  
  // First, detect orphaned data
  const { data: detectData, error: detectError } = await supabase.functions.invoke('detect-orphaned-data', {
    body: {
      action: 'detect',
      include_items: true
    }
  });

  if (detectError) {
    console.error('❌ Detection failed:', detectError);
    throw detectError;
  }

  console.log('📊 Detection results:', detectData);
  
  if (detectData.total_issues === 0) {
    console.log('✅ No orphaned data found!');
    return { message: 'No orphaned data found', results: detectData };
  }

  console.log(`🧹 Found ${detectData.total_issues} orphaned records. Starting cleanup...`);
  
  // Now run the actual cleanup (not dry run)
  const { data: cleanupData, error: cleanupError } = await supabase.functions.invoke('detect-orphaned-data', {
    body: {
      action: 'cleanup',
      dry_run: false,
      categories: [] // Clean all categories
    }
  });

  if (cleanupError) {
    console.error('❌ Cleanup failed:', cleanupError);
    throw cleanupError;
  }

  console.log('✅ Cleanup completed:', cleanupData);
  return { 
    message: `Cleaned up ${cleanupData.total_records_cleaned || 0} orphaned records`, 
    results: cleanupData 
  };
};