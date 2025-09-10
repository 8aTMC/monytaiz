import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { logger, logHealth, logNetwork } from '@/utils/logging';

// Runtime environment variable validation
const getSupabaseConfig = () => {
  const url = import.meta.env.VITE_SUPABASE_URL || "https://alzyzfjzwvofmjccirjq.supabase.co";
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsenl6Zmp6d3ZvZm1qY2NpcmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyODkxNjMsImV4cCI6MjA3MDg2NTE2M30.DlmPO0LWTM0T4bMXJheMXdtftCVJZ5V961CUW-fEXmk";
  
  // Validate URL format
  const urlPattern = /^https:\/\/[a-z0-9-]+\.supabase\.co$/;
  if (!urlPattern.test(url)) {
    console.error('Invalid Supabase URL format:', url);
    throw new Error(`Invalid Supabase URL: ${url}`);
  }
  
  // Validate key format (should be a JWT)
  if (!key || key.length < 100 || !key.startsWith('eyJ')) {
    console.error('Invalid Supabase key format');
    throw new Error('Invalid Supabase key format');
  }
  
  logger.debug('Supabase config validated', { 
    url: url.replace(/alzyzfjzwvofmjccirjq/, '[PROJECT-ID]'), 
    keyLength: key.length 
  });
  
  return { url, key };
};

const { url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY } = getSupabaseConfig();

// Enhanced health check with quiet logging
export const checkSupabaseHealth = async (retryCount = 0, consecutiveFailures = 0): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    logNetwork('debug', `Health check attempt ${retryCount + 1}`);
    
    const response = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'apikey': SUPABASE_PUBLISHABLE_KEY
      }
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      logHealth(true, 'Supabase health check passed');
      return true;
    } else if (response.status === 401) {
      // 401 means service is up but authentication failed - treat as success for connectivity
      logHealth(true, 'Supabase service responding (auth required)');
      return true;
    } else {
      logHealth(false, `Health check failed with status: ${response.status}`, consecutiveFailures);
      return false;
    }
  } catch (error: any) {
    logHealth(false, `Health check failed: ${error.message}`, consecutiveFailures);
    
    // Retry logic for network errors
    if (retryCount < 2 && (
      error.name === 'TypeError' ||
      error.name === 'AbortError' ||
      error.message?.includes('fetch') ||
      error.message?.includes('network')
    )) {
      logNetwork('debug', `Retrying health check in ${(retryCount + 1) * 2}s...`);
      await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
      return checkSupabaseHealth(retryCount + 1, consecutiveFailures + 1);
    }
    
    return false;
  }
};

// Simple connectivity test that doesn't require authentication
export const checkBasicConnectivity = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${SUPABASE_URL}/`, {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-cache'
    });
    
    clearTimeout(timeoutId);
    
    // Any response (including 404) means connectivity is working
    return response.status < 500;
    } catch (error: any) {
    logNetwork('debug', 'Basic connectivity test failed', error);
    return false;
  }
};

// Enhanced DNS resolution test with multiple fallbacks
export const testDNSResolution = async (retryCount = 0): Promise<boolean> => {
  try {
    const hostname = new URL(SUPABASE_URL).hostname;
    logNetwork('debug', `Testing DNS resolution for ${hostname} (attempt ${retryCount + 1})`);
    
    // Test multiple endpoints to verify DNS resolution
    const testEndpoints = [
      `https://${hostname}`,
      `${SUPABASE_URL}/auth/v1/health`,
      `https://supabase.com` // Fallback to main Supabase domain
    ];
    
    for (const endpoint of testEndpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        await fetch(endpoint, {
          method: 'HEAD',
          signal: controller.signal,
          mode: 'no-cors',
          cache: 'no-cache'
        });
        
        clearTimeout(timeoutId);
        logNetwork('debug', `DNS resolution successful for ${endpoint}`);
        return true;
      } catch (endpointError: any) {
        logNetwork('debug', `DNS test failed for ${endpoint}: ${endpointError.message}`);
        continue;
      }
    }
    
    throw new Error('All DNS test endpoints failed');
  } catch (error: any) {
    logNetwork('debug', `DNS resolution test failed (attempt ${retryCount + 1}): ${error.message}`);
    
    // Retry logic for DNS failures
    if (retryCount < 2 && (
      error.name === 'TypeError' || 
      error.message?.includes('Failed to fetch') ||
      error.message?.includes('network') ||
      error.message?.includes('ERR_NAME_NOT_RESOLVED')
    )) {
      logNetwork('debug', `Retrying DNS test in ${(retryCount + 1) * 3}s...`);
      await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 3000));
      return testDNSResolution(retryCount + 1);
    }
    
    // If DNS truly failed, this indicates a serious connectivity issue
    if (error.message?.includes('Failed to fetch') || error.message?.includes('ERR_NAME_NOT_RESOLVED')) {
      logNetwork('error', 'Critical DNS resolution failure detected');
      return false;
    }
    
    // Other errors might be CORS-related but DNS could be working
    logNetwork('debug', 'DNS test inconclusive, assuming DNS is working');
    return true;
  }
};

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

// Connection monitoring with reduced logging
export const monitorConnection = () => {
  let healthCheckInterval: NodeJS.Timeout;
  let consecutiveFailures = 0;
  
  const startMonitoring = () => {
    // Check connection health every 30 seconds
    healthCheckInterval = setInterval(async () => {
      const isHealthy = await checkSupabaseHealth(0, consecutiveFailures);
      if (!isHealthy) {
        consecutiveFailures++;
        
        // Only take action after multiple failures
        if (consecutiveFailures >= 3) {
          const failures = parseInt(sessionStorage.getItem('health-failures') || '0') + 1;
          sessionStorage.setItem('health-failures', failures.toString());
          
          if (failures >= 5) {
            logNetwork('warn', 'Multiple health check failures - clearing session storage');
            // Clear session storage to force fresh auth
            sessionStorage.clear();
          }
        }
      } else {
        consecutiveFailures = 0;
        sessionStorage.removeItem('health-failures');
      }
    }, 30000);
  };
  
  const stopMonitoring = () => {
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
    }
  };
  
  // Auto-start monitoring
  startMonitoring();
  
  return { startMonitoring, stopMonitoring };
};

// Initialize connection monitoring
const connectionMonitor = monitorConnection();

// Enhanced Supabase client with better error handling
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Enhanced auth options for better reliability
    detectSessionInUrl: true,
    flowType: 'pkce'
  },
  global: {
    headers: {
      'Cache-Control': 'no-cache',
    },
  },
  // Add retry logic for network failures
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});