import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { logger } from '@/utils/logging';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://alzyzfjzwvofmjccirjq.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsenl6Zmp6d3ZvZm1qY2NpcmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyODkxNjMsImV4cCI6MjA3MDg2NTE2M30.DlmPO0LWTM0T4bMXJheMXdtftCVJZ5V961CUW-fEXmk";

// Validate configuration
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Log configuration (without sensitive details)
logger.debug('Supabase client initialized', { 
  url: supabaseUrl.replace(/alzyzfjzwvofmjccirjq/, '[PROJECT-ID]'), 
  keyLength: supabaseAnonKey.length 
});

// Simple retry wrapper for Supabase operations
const withRetry = async <T>(operation: () => Promise<T>, maxRetries = 2): Promise<T> => {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries) throw error;
      
      // Simple exponential backoff
      const delay = Math.min(1000 * Math.pow(2, i), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      logger.warn(`Supabase operation retry ${i + 1}/${maxRetries}`, { error });
    }
  }
  
  throw new Error('Retry exhausted'); // This should never be reached
};

// Create the Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  },
  global: {
    headers: {
      'Cache-Control': 'no-cache',
    },
  }
});

// Enhanced supabase client with retry logic (for critical operations)
export const supabaseWithRetry = {
  ...supabase,
  withRetry
};

export default supabase;