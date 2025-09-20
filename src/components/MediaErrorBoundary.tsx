import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class MediaErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log media-specific errors for debugging
    if (error.message.includes('blob:') || error.message.includes('ERR_FILE_NOT_FOUND')) {
      console.warn('Media loading error caught:', error.message);
    } else {
      console.error('Media Error Boundary caught an error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-4 text-center bg-muted/20 rounded-md">
          <AlertTriangle className="w-6 h-6 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Media could not be loaded
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}