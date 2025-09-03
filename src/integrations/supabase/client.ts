import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

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
  
  console.log('Supabase config validated:', { 
    url: url.replace(/alzyzfjzwvofmjccirjq/, '[PROJECT-ID]'), 
    keyLength: key.length 
  });
  
  return { url, key };
};

const { url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY } = getSupabaseConfig();

// Health check function
export const checkSupabaseHealth = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.error('Supabase health check failed:', error);
    return false;
  }
};

// DNS resolution test
export const testDNSResolution = async (): Promise<boolean> => {
  try {
    // Extract hostname from URL
    const hostname = new URL(SUPABASE_URL).hostname;
    
    // Test DNS resolution by making a simple request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    await fetch(`https://${hostname}`, {
      method: 'HEAD',
      signal: controller.signal,
      mode: 'no-cors' // Bypass CORS for DNS test
    });
    
    clearTimeout(timeoutId);
    return true;
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      console.error('DNS resolution failed for Supabase URL:', SUPABASE_URL);
      return false;
    }
    // Other errors might be CORS-related but DNS is working
    return true;
  }
};

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});