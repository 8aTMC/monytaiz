import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AuthFallbackProps {
  isVisible: boolean;
  onRetry: () => void;
}

export const AuthFallback: React.FC<AuthFallbackProps> = ({ isVisible, onRetry }) => {
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [retryCount, setRetryCount] = useState(0);

  const checkConnection = async () => {
    setConnectionStatus('checking');
    try {
      // Try a simple Supabase health check
      const { error } = await supabase.from('profiles').select('count').limit(1);
      if (error && error.message?.includes('JWT')) {
        // JWT errors mean connection is fine, just auth issues
        setConnectionStatus('online');
      } else if (error) {
        setConnectionStatus('offline');
      } else {
        setConnectionStatus('online');
      }
    } catch (error) {
      console.error('Connection check failed:', error);
      setConnectionStatus('offline');
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    checkConnection();
    onRetry();
  };

  useEffect(() => {
    if (isVisible) {
      checkConnection();
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <div className="flex items-center gap-2">
        {connectionStatus === 'offline' ? (
          <WifiOff className="h-4 w-4" />
        ) : connectionStatus === 'checking' ? (
          <Wifi className="h-4 w-4 animate-pulse" />
        ) : (
          <AlertTriangle className="h-4 w-4" />
        )}
        
        <div className="flex-1">
          <AlertDescription>
            {connectionStatus === 'offline' && (
              <>
                <strong>Connection Issue:</strong> Unable to reach authentication servers. 
                Please check your internet connection.
              </>
            )}
            {connectionStatus === 'online' && (
              <>
                <strong>Service Issue:</strong> Authentication services are temporarily unavailable. 
                Our team has been notified and is working on a fix.
              </>
            )}
            {connectionStatus === 'checking' && (
              <>
                <strong>Checking Connection:</strong> Verifying service availability...
              </>
            )}
          </AlertDescription>
        </div>
        
        {connectionStatus !== 'checking' && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRetry}
            className="border-red-300 text-red-600 hover:bg-red-50"
          >
            Retry {retryCount > 0 && `(${retryCount})`}
          </Button>
        )}
      </div>
    </Alert>
  );
};