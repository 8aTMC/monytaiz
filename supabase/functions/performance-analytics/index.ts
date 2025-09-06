import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PerformanceMetric {
  mediaId?: string;
  userId?: string;
  sessionId?: string;
  metricType: string;
  value: number;
  unit: string;
  metadata?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { method } = req;
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Route handling
    if (method === 'POST' && pathname.endsWith('/metrics')) {
      return await handleMetricsIngestion(req, supabaseClient);
    }
    
    if (method === 'GET' && pathname.endsWith('/analytics')) {
      return await handleAnalyticsQuery(req, supabaseClient);
    }
    
    if (method === 'POST' && pathname.endsWith('/alerts')) {
      return await handleAlertCreation(req, supabaseClient);
    }
    
    if (method === 'GET' && pathname.endsWith('/health')) {
      return await handleHealthCheck(supabaseClient);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });

  } catch (error) {
    console.error('Performance Analytics Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function handleMetricsIngestion(req: Request, supabase: any) {
  const { metrics }: { metrics: PerformanceMetric[] } = await req.json();
  
  if (!metrics || !Array.isArray(metrics)) {
    return new Response(JSON.stringify({ error: 'Invalid metrics data' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results = [];
  
  for (const metric of metrics) {
    try {
      // Store video performance metrics
      if (metric.metricType === 'video_performance') {
        const { error } = await supabase
          .from('video_performance_metrics')
          .insert({
            media_id: metric.mediaId,
            user_id: metric.userId,
            session_id: metric.sessionId,
            load_time_ms: metric.metadata?.loadTimeMs || 0,
            buffer_events: metric.metadata?.bufferEvents || 0,
            quality_switches: metric.metadata?.qualitySwitches || 0,
            initial_quality: metric.metadata?.initialQuality || 'auto',
            final_quality: metric.metadata?.finalQuality || 'auto',
            watch_duration_seconds: metric.metadata?.watchDurationSeconds || 0,
            completion_percentage: metric.metadata?.completionPercentage || 0,
            network_quality: metric.metadata?.networkQuality || 'unknown',
            cache_hit: metric.metadata?.cacheHit || false,
            error_count: metric.metadata?.errorCount || 0
          });

        if (error) throw error;
      }
      
      // Store system health metrics
      else if (metric.metricType.startsWith('system_')) {
        const { error } = await supabase
          .from('system_health_metrics')
          .insert({
            metric_type: metric.metricType,
            metric_value: metric.value,
            metric_unit: metric.unit,
            metadata: metric.metadata || {}
          });

        if (error) throw error;
      }
      
      // Store user behavior analytics
      else if (metric.metricType === 'user_behavior') {
        const { error } = await supabase
          .from('user_behavior_analytics')
          .insert({
            user_id: metric.userId,
            session_id: metric.sessionId,
            event_type: metric.metadata?.eventType || 'unknown',
            media_id: metric.mediaId,
            interaction_data: metric.metadata?.interactionData || {},
            timestamp_ms: Date.now(),
            page_url: metric.metadata?.pageUrl,
            device_info: metric.metadata?.deviceInfo || {}
          });

        if (error) throw error;
      }

      results.push({ success: true, metricType: metric.metricType });

    } catch (error) {
      console.error(`Failed to store metric ${metric.metricType}:`, error);
      results.push({ success: false, metricType: metric.metricType, error: error.message });
    }
  }

  // Check for performance issues and create alerts
  await checkPerformanceThresholds(supabase, metrics);

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleAnalyticsQuery(req: Request, supabase: any) {
  const url = new URL(req.url);
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const mediaId = url.searchParams.get('mediaId');
  const metricType = url.searchParams.get('metricType');

  try {
    if (metricType === 'performance_summary') {
      const { data, error } = await supabase.rpc('get_performance_analytics', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_media_id: mediaId
      });

      if (error) throw error;

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (metricType === 'system_health') {
      const { data, error } = await supabase
        .from('system_health_metrics')
        .select('*')
        .gte('recorded_at', startDate || '2024-01-01')
        .lte('recorded_at', endDate || new Date().toISOString())
        .order('recorded_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid metric type' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Analytics Query Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function handleAlertCreation(req: Request, supabase: any) {
  const { alertType, severity, title, description, metadata } = await req.json();

  try {
    const { data, error } = await supabase
      .from('performance_alerts')
      .insert({
        alert_type: alertType,
        severity,
        title,
        description,
        metadata: metadata || {}
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ alert: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Alert Creation Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function handleHealthCheck(supabase: any) {
  try {
    // Check database connectivity
    const { data, error } = await supabase
      .from('system_health_metrics')
      .select('count')
      .limit(1);

    if (error) throw error;

    // Record health check metric
    await supabase
      .from('system_health_metrics')
      .insert({
        metric_type: 'system_health_check',
        metric_value: 1,
        metric_unit: 'status',
        metadata: { 
          timestamp: new Date().toISOString(),
          status: 'healthy' 
        }
      });

    return new Response(JSON.stringify({ 
      status: 'healthy', 
      timestamp: new Date().toISOString() 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Health Check Error:', error);
    return new Response(JSON.stringify({ 
      status: 'unhealthy', 
      error: error.message,
      timestamp: new Date().toISOString() 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function checkPerformanceThresholds(supabase: any, metrics: PerformanceMetric[]) {
  for (const metric of metrics) {
    if (metric.metricType === 'video_performance') {
      const { loadTimeMs, bufferEvents, errorCount } = metric.metadata || {};

      // High load time alert
      if (loadTimeMs > 5000) {
        await supabase
          .from('performance_alerts')
          .insert({
            alert_type: 'high_load_time',
            severity: 'high',
            title: 'High Video Load Time Detected',
            description: `Video load time of ${loadTimeMs}ms exceeds threshold (5000ms)`,
            metadata: { 
              mediaId: metric.mediaId,
              loadTime: loadTimeMs,
              threshold: 5000 
            }
          });
      }

      // Excessive buffering alert
      if (bufferEvents > 5) {
        await supabase
          .from('performance_alerts')
          .insert({
            alert_type: 'excessive_buffering',
            severity: 'medium',
            title: 'Excessive Video Buffering',
            description: `${bufferEvents} buffer events detected in single session`,
            metadata: { 
              mediaId: metric.mediaId,
              bufferEvents,
              threshold: 5 
            }
          });
      }

      // High error rate alert
      if (errorCount > 3) {
        await supabase
          .from('performance_alerts')
          .insert({
            alert_type: 'high_error_rate',
            severity: 'critical',
            title: 'High Video Error Rate',
            description: `${errorCount} errors occurred during video playback`,
            metadata: { 
              mediaId: metric.mediaId,
              errorCount,
              threshold: 3 
            }
          });
      }
    }
  }
}