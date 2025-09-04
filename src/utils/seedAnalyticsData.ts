import { supabase } from '@/integrations/supabase/client';

export const seedAnalyticsData = async (mediaId: string, userId: string) => {
  try {
    // Generate sample analytics data for the past 30 days
    const events = [];
    const now = new Date();
    
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
      
      // Generate random sent events (1-5 per day)
      const sentCount = Math.floor(Math.random() * 5) + 1;
      for (let j = 0; j < sentCount; j++) {
        events.push({
          media_id: mediaId,
          event_type: 'sent',
          amount_cents: 0,
          user_id: userId,
          created_at: new Date(date.getTime() + (j * 2 * 60 * 60 * 1000)).toISOString()
        });
      }
      
      // Generate random purchase events (0-2 per day, less frequent than sent)
      const purchaseCount = Math.random() > 0.7 ? Math.floor(Math.random() * 2) + 1 : 0;
      for (let k = 0; k < purchaseCount; k++) {
        const price = Math.floor(Math.random() * 5000) + 500; // $5-$55
        events.push({
          media_id: mediaId,
          event_type: 'purchased',
          amount_cents: price,
          user_id: userId,
          created_at: new Date(date.getTime() + (k * 3 * 60 * 60 * 1000)).toISOString()
        });
      }
    }
    
    const { error } = await supabase
      .from('media_analytics')
      .insert(events);
    
    if (error) {
      console.error('Error seeding analytics data:', error);
      return false;
    }
    
    console.log(`Successfully seeded ${events.length} analytics events for media ${mediaId}`);
    return true;
  } catch (error) {
    console.error('Failed to seed analytics data:', error);
    return false;
  }
};

export const clearAnalyticsData = async (mediaId: string) => {
  try {
    const { error } = await supabase
      .from('media_analytics')
      .delete()
      .eq('media_id', mediaId);
    
    if (error) {
      console.error('Error clearing analytics data:', error);
      return false;
    }
    
    console.log(`Successfully cleared analytics data for media ${mediaId}`);
    return true;
  } catch (error) {
    console.error('Failed to clear analytics data:', error);
    return false;
  }
};