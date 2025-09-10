import { supabase, checkSupabaseHealth, testDNSResolution } from '@/integrations/supabase/client';

export interface NetworkDiagnosticResult {
  test: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
  timestamp: number;
}

export interface ComprehensiveDiagnostic {
  overallStatus: 'healthy' | 'degraded' | 'critical';
  results: NetworkDiagnosticResult[];
  recommendations: string[];
  timestamp: number;
}

class NetworkDiagnostics {
  private static instance: NetworkDiagnostics;
  
  static getInstance(): NetworkDiagnostics {
    if (!NetworkDiagnostics.instance) {
      NetworkDiagnostics.instance = new NetworkDiagnostics();
    }
    return NetworkDiagnostics.instance;
  }

  async runComprehensiveDiagnostic(): Promise<ComprehensiveDiagnostic> {
    console.log('🔍 Starting comprehensive network diagnostic...');
    
    const results: NetworkDiagnosticResult[] = [];
    const recommendations: string[] = [];
    
    // Test 1: Basic connectivity
    try {
      const isOnline = navigator.onLine;
      results.push({
        test: 'Browser Online Status',
        status: isOnline ? 'success' : 'error',
        message: isOnline ? 'Browser reports online' : 'Browser reports offline',
        details: { onLine: isOnline },
        timestamp: Date.now()
      });
      
      if (!isOnline) {
        recommendations.push('Check your internet connection');
      }
    } catch (error) {
      results.push({
        test: 'Browser Online Status',
        status: 'error',
        message: 'Failed to check online status',
        details: { error: error.message },
        timestamp: Date.now()
      });
    }

    // Test 2: DNS Resolution
    try {
      const dnsWorking = await testDNSResolution();
      results.push({
        test: 'DNS Resolution',
        status: dnsWorking ? 'success' : 'error',
        message: dnsWorking ? 'DNS resolution working' : 'DNS resolution failed',
        details: { hostname: 'alzyzfjzwvofmjccirjq.supabase.co' },
        timestamp: Date.now()
      });
      
      if (!dnsWorking) {
        recommendations.push('Try flushing DNS cache or switching DNS servers');
        recommendations.push('Check if Supabase services are accessible');
      }
    } catch (error) {
      results.push({
        test: 'DNS Resolution',
        status: 'error',
        message: 'DNS test failed with error',
        details: { error: error.message },
        timestamp: Date.now()
      });
    }

    // Test 3: Supabase Health
    try {
      const healthOk = await checkSupabaseHealth();
      results.push({
        test: 'Supabase Health',
        status: healthOk ? 'success' : 'error',
        message: healthOk ? 'Supabase services responding' : 'Supabase services unreachable',
        details: { endpoint: '/auth/v1/health' },
        timestamp: Date.now()
      });
      
      if (!healthOk) {
        recommendations.push('Supabase services may be experiencing issues');
        recommendations.push('Try again in a few minutes');
      }
    } catch (error) {
      results.push({
        test: 'Supabase Health',
        status: 'error',
        message: 'Health check failed',
        details: { error: error.message },
        timestamp: Date.now()
      });
    }

    // Test 4: Local Storage Access
    try {
      const testKey = 'network-diagnostic-test';
      localStorage.setItem(testKey, 'test');
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      results.push({
        test: 'Local Storage',
        status: retrieved === 'test' ? 'success' : 'error',
        message: retrieved === 'test' ? 'Local storage working' : 'Local storage issues',
        details: { canWrite: true, canRead: retrieved === 'test' },
        timestamp: Date.now()
      });
    } catch (error) {
      results.push({
        test: 'Local Storage',
        status: 'error',
        message: 'Local storage access failed',
        details: { error: error.message },
        timestamp: Date.now()
      });
      recommendations.push('Browser storage may be corrupted - try clearing cache');
    }

    // Test 5: WebSocket Support
    try {
      const wsSupported = typeof WebSocket !== 'undefined';
      results.push({
        test: 'WebSocket Support',
        status: wsSupported ? 'success' : 'error',
        message: wsSupported ? 'WebSocket supported' : 'WebSocket not supported',
        details: { supported: wsSupported },
        timestamp: Date.now()
      });
    } catch (error) {
      results.push({
        test: 'WebSocket Support',
        status: 'error',
        message: 'WebSocket check failed',
        details: { error: error.message },
        timestamp: Date.now()
      });
    }

    // Test 6: CORS/Security Headers
    try {
      const testResponse = await fetch(window.location.origin + '/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      results.push({
        test: 'CORS/Headers',
        status: testResponse.ok ? 'success' : 'warning',
        message: testResponse.ok ? 'No CORS issues detected' : 'Possible CORS/header issues',
        details: { 
          status: testResponse.status,
          headers: Object.fromEntries(testResponse.headers.entries())
        },
        timestamp: Date.now()
      });
    } catch (error) {
      results.push({
        test: 'CORS/Headers',
        status: 'warning',
        message: 'CORS test inconclusive',
        details: { error: error.message },
        timestamp: Date.now()
      });
    }

    // Test 7: Auth Session Recovery
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      results.push({
        test: 'Auth Session',
        status: error ? 'error' : 'success',
        message: error ? `Auth error: ${error.message}` : 'Auth session accessible',
        details: { hasSession: !!session, error: error?.message },
        timestamp: Date.now()
      });
      
      if (error && error.message.includes('fetch')) {
        recommendations.push('Network connectivity issues affecting authentication');
      }
    } catch (error) {
      results.push({
        test: 'Auth Session',
        status: 'error',
        message: 'Auth session test failed',
        details: { error: error.message },
        timestamp: Date.now()
      });
    }

    // Determine overall status
    const errorCount = results.filter(r => r.status === 'error').length;
    const warningCount = results.filter(r => r.status === 'warning').length;
    
    let overallStatus: 'healthy' | 'degraded' | 'critical';
    if (errorCount === 0) {
      overallStatus = warningCount === 0 ? 'healthy' : 'degraded';
    } else if (errorCount <= 2) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'critical';
    }

    // Add general recommendations
    if (overallStatus !== 'healthy') {
      recommendations.push('Try refreshing the page');
      recommendations.push('Clear browser cache and cookies');
      recommendations.push('Disable browser extensions temporarily');
      recommendations.push('Try incognito/private browsing mode');
    }

    const diagnostic: ComprehensiveDiagnostic = {
      overallStatus,
      results,
      recommendations: [...new Set(recommendations)], // Remove duplicates
      timestamp: Date.now()
    };

    console.log('🔍 Network diagnostic complete:', diagnostic);
    return diagnostic;
  }

  async quickHealthCheck(): Promise<boolean> {
    try {
      const [isOnline, dnsOk, healthOk] = await Promise.all([
        Promise.resolve(navigator.onLine),
        testDNSResolution(),
        checkSupabaseHealth()
      ]);
      
      return isOnline && dnsOk && healthOk;
    } catch (error) {
      console.error('Quick health check failed:', error);
      return false;
    }
  }

  async clearNetworkCache(): Promise<void> {
    try {
      // Clear auth-related storage
      const authKeys = [
        'supabase.auth.token',
        'sb-alzyzfjzwvofmjccirjq-auth-token',
        'supabase.auth.refresh_token',
        'sb-alzyzfjzwvofmjccirjq-auth-token-code-verifier'
      ];
      
      authKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value === 'undefined' || value === 'null' || !value) {
          localStorage.removeItem(key);
        }
      });

      // Clear problematic session storage
      sessionStorage.clear();

      console.log('🧹 Network cache cleared');
    } catch (error) {
      console.error('Failed to clear network cache:', error);
    }
  }
}

export const networkDiagnostics = NetworkDiagnostics.getInstance();
export default networkDiagnostics;