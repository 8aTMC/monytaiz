import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FanAnalytics {
  totalSpentCents: number;
  thisMonthSpentCents: number;
  messagesSent: number;
  contentPurchased: number;
  tipsGiven: number;
}

export const useFanAnalytics = (fanId: string | null, conversationId: string | null) => {
  const [analytics, setAnalytics] = useState<FanAnalytics>({
    totalSpentCents: 0,
    thisMonthSpentCents: 0,
    messagesSent: 0,
    contentPurchased: 0,
    tipsGiven: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fanId) {
      setLoading(false);
      return;
    }

    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get fan purchase analytics
        const { data: purchaseAnalytics } = await supabase
          .from('fan_purchase_analytics')
          .select('total_spent_cents, last_purchase_at')
          .eq('fan_id', fanId)
          .maybeSingle();

        // Calculate this month spending (simplified - would need to query individual purchases for accurate monthly data)
        const thisMonthStart = new Date();
        thisMonthStart.setDate(1);
        thisMonthStart.setHours(0, 0, 0, 0);

        // Get message count for this conversation
        let messageCount = 0;
        if (conversationId) {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conversationId)
            .eq('sender_id', fanId)
            .eq('status', 'active');
          messageCount = count || 0;
        }

        // Get content purchase count
        const { count: purchaseCount } = await supabase
          .from('ppv_transactions')
          .select('*', { count: 'exact', head: true })
          .eq('buyer_id', fanId)
          .eq('status', 'completed');

        // Get tips count (PPV transactions that are tips)
        const { count: tipCount } = await supabase
          .from('ppv_transactions')
          .select('*', { count: 'exact', head: true })
          .eq('buyer_id', fanId)
          .eq('status', 'completed')
          .neq('payment_method', 'demo');

        setAnalytics({
          totalSpentCents: purchaseAnalytics?.total_spent_cents || 0,
          thisMonthSpentCents: 0, // Would need more complex query for accurate monthly spending
          messagesSent: messageCount,
          contentPurchased: purchaseCount || 0,
          tipsGiven: tipCount || 0,
        });
      } catch (err) {
        console.error('Error fetching fan analytics:', err);
        setError('Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [fanId, conversationId]);

  return { analytics, loading, error };
};