import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Filter out known third-party integration errors
    const isThirdPartyError = 
      error.message?.includes('OneTimePlugin') ||
      error.message?.includes('PixelML') ||
      error.message?.includes('RS SDK') ||
      error.stack?.includes('extension') ||
      error.stack?.includes('chrome-extension');

    if (isThirdPartyError) {
      // For third-party errors, just log and recover silently
      console.warn('Third-party integration error detected and handled:', error.message);
      this.setState({ hasError: false });
      return;
    }

    this.setState({
      hasError: true,
      error,
      errorInfo
    });
  }

  handleReload = () => {
    // Clear any cached data and reload
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName);
        });
      });
    }
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <CardTitle>Something went wrong</CardTitle>
              <CardDescription>
                An unexpected error occurred. This might be due to a browser extension or third-party integration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                <strong>Error:</strong> {this.state.error.message}
              </div>
              
              <div className="flex flex-col gap-2">
                <Button onClick={this.handleReset} variant="outline" className="w-full">
                  Try Again
                </Button>
                <Button onClick={this.handleReload} className="w-full">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reload Page
                </Button>
              </div>
              
              <div className="text-xs text-muted-foreground text-center">
                If this persists, try disabling browser extensions or clearing your browser cache.
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}