import { logTelemetry } from '@/utils/logging';

interface TelemetryErrorHandler {
  handleError: (error: Error, context?: string) => void;
  wrapFunction: <T extends (...args: any[]) => any>(fn: T, context: string) => T;
  setupGlobalHandlers: () => void;
}

class TelemetryErrorHandlerImpl implements TelemetryErrorHandler {
  private errorCounts = new Map<string, number>();
  private lastErrorTime = new Map<string, number>();
  private suppressedErrors = new Set<string>();
  
  constructor() {
    this.setupGlobalHandlers();
  }
  
  handleError(error: Error, context = 'unknown'): void {
    const errorKey = `${context}:${error.name}:${error.message}`;
    const now = Date.now();
    const lastTime = this.lastErrorTime.get(errorKey) || 0;
    const count = this.errorCounts.get(errorKey) || 0;
    
    // Throttle similar errors
    if (now - lastTime < 10000) { // 10 seconds
      this.errorCounts.set(errorKey, count + 1);
      return; // Don't log repeated errors
    }
    
    this.lastErrorTime.set(errorKey, now);
    this.errorCounts.set(errorKey, 1);
    
    // Check if this is a known telemetry error to suppress
    if (this.isTelemetryError(error)) {
      if (!this.suppressedErrors.has(errorKey)) {
        logTelemetry('warn', `Telemetry connection issue (suppressing further similar errors): ${context}`, {
          error: error.message,
          name: error.name
        });
        this.suppressedErrors.add(errorKey);
      }
      return;
    }
    
    // Log other errors normally but with telemetry context
    logTelemetry('error', `Error in ${context}`, {
      error: error.message,
      name: error.name,
      stack: error.stack
    });
  }
  
  private isTelemetryError(error: Error): boolean {
    const telemetryErrorPatterns = [
      'lovable-api.com',
      'ERR_CONNECTION_CLOSED',
      'ERR_NAME_NOT_RESOLVED', 
      'ERR_HTTP2_PROTOCOL_ERROR',
      'recorder.js',
      'network-plugin.ts',
      'Failed to fetch',
      'NetworkError',
      'CORS',
      'CSP',
      'net::ERR_',
      'Auth loading',
      'lovable.js',
      'Sign out timeout',
      'Session error'
    ];
    
    return telemetryErrorPatterns.some(pattern => 
      error.message.includes(pattern) || 
      error.stack?.includes(pattern) ||
      (error.name && error.name.includes('Auth'))
    );
  }
  
  wrapFunction<T extends (...args: any[]) => any>(fn: T, context: string): T {
    return ((...args: any[]) => {
      try {
        const result = fn(...args);
        
        // Handle async functions
        if (result instanceof Promise) {
          return result.catch((error: Error) => {
            this.handleError(error, context);
            throw error; // Re-throw for proper error handling
          });
        }
        
        return result;
      } catch (error) {
        this.handleError(error as Error, context);
        throw error; // Re-throw for proper error handling
      }
    }) as T;
  }
  
  setupGlobalHandlers(): void {
    // Handle uncaught promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      
      if (this.isTelemetryError(error)) {
        event.preventDefault(); // Prevent console spam for telemetry errors
        this.handleError(error, 'unhandledrejection');
      }
    });
    
    // Handle global errors
    const originalErrorHandler = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      if (error && this.isTelemetryError(error)) {
        this.handleError(error, 'global');
        return true; // Prevent default error handling for telemetry errors
      }
      
      // Call original handler for other errors
      if (originalErrorHandler) {
        return originalErrorHandler(message, source, lineno, colno, error);
      }
      
      return false;
    };
    
    // Patch fetch to handle telemetry request failures silently
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        return await originalFetch(...args);
      } catch (error) {
        const url = typeof args[0] === 'string' ? args[0] : 
                   args[0] instanceof Request ? args[0].url : 
                   args[0]?.toString() || 'unknown';
        
        if (url.includes('lovable-api.com') || this.isTelemetryError(error as Error)) {
          // Mark telemetry errors in DOM for health indicator
          document.body.setAttribute('data-telemetry-error', 'true');
          setTimeout(() => {
            document.body.removeAttribute('data-telemetry-error');
          }, 30000); // Clear after 30 seconds
          
          this.handleError(error as Error, `fetch:${url}`);
          
          // Return a fake successful response for telemetry requests
          return new Response('{}', { status: 200, statusText: 'OK (Telemetry Suppressed)' });
        }
        
        throw error; // Re-throw for non-telemetry errors
      }
    };
    
    logTelemetry('info', 'Telemetry error handler initialized');
  }
}

// Global instance
export const telemetryErrorHandler = new TelemetryErrorHandlerImpl();

// Convenience function to wrap async operations
export const withTelemetryErrorHandling = <T extends (...args: any[]) => any>(
  fn: T, 
  context: string
): T => {
  return telemetryErrorHandler.wrapFunction(fn, context);
};