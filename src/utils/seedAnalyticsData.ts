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

export const restoreRealData = async (mediaId: string) => {
  try {
    // Get the current timestamp for reference
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (31 * 24 * 60 * 60 * 1000));
    
    // Remove sample data by identifying patterns from the seed function:
    // - Multiple events created in rapid succession (within hours)
    // - Events created exactly 30+ days ago in regular intervals
    // - Events with specific amount patterns from sample data
    
    // First, get all analytics data for this media to analyze patterns
    const { data: allData } = await supabase
      .from('media_analytics')
      .select('*')
      .eq('media_id', mediaId)
      .order('created_at', { ascending: true });
    
    if (!allData || allData.length === 0) {
      return true; // No data to clean
    }
    
    // Identify likely sample data based on patterns
    const suspiciousBatches = [];
    const eventsByDate = new Map();
    
    // Group events by date
    allData.forEach(event => {
      const dateKey = event.created_at.split('T')[0];
      if (!eventsByDate.has(dateKey)) {
        eventsByDate.set(dateKey, []);
      }
      eventsByDate.get(dateKey).push(event);
    });
    
    // Look for sample data patterns
    eventsByDate.forEach((events, date) => {
      // Check if this looks like sample data:
      // 1. Multiple events on the same day with regular intervals
      // 2. Events created around the same time (within hours)
      // 3. Amount patterns that match sample generation
      
      if (events.length > 1) {
        const timestamps = events.map(e => new Date(e.created_at).getTime());
        timestamps.sort((a, b) => a - b);
        
        // Check for regular intervals (sample data creates events 2-3 hours apart)
        let regularIntervals = 0;
        for (let i = 1; i < timestamps.length; i++) {
          const timeDiff = timestamps[i] - timestamps[i-1];
          const hoursDiff = timeDiff / (1000 * 60 * 60);
          if (hoursDiff >= 1.5 && hoursDiff <= 3.5) {
            regularIntervals++;
          }
        }
        
        // If most intervals are regular, likely sample data
        if (regularIntervals >= timestamps.length * 0.5) {
          events.forEach(event => suspiciousBatches.push(event.id));
        }
      }
    });
    
    // Also identify sample data by looking for the specific amount patterns
    // Sample data uses amounts between 500-5500 cents ($5-$55)
    allData.forEach(event => {
      if (event.event_type === 'purchased' && 
          event.amount_cents >= 500 && 
          event.amount_cents <= 5500 &&
          event.amount_cents % 100 !== 0) { // Sample data rarely ends in exact dollars
        
        // Check if this event was created as part of a batch (close to other events)
        const eventTime = new Date(event.created_at).getTime();
        const nearbyEvents = allData.filter(other => {
          const otherTime = new Date(other.created_at).getTime();
          const timeDiff = Math.abs(eventTime - otherTime);
          return timeDiff < (4 * 60 * 60 * 1000) && other.id !== event.id; // Within 4 hours
        });
        
        if (nearbyEvents.length >= 2) {
          suspiciousBatches.push(event.id);
        }
      }
    });
    
    // Remove identified sample data
    if (suspiciousBatches.length > 0) {
      const { error } = await supabase
        .from('media_analytics')
        .delete()
        .in('id', suspiciousBatches);
      
      if (error) {
        console.error('Error removing sample analytics data:', error);
        return false;
      }
      
      console.log(`Successfully removed ${suspiciousBatches.length} sample analytics events for media ${mediaId}`);
    } else {
      console.log(`No sample data detected for media ${mediaId}`);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to restore real analytics data:', error);
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