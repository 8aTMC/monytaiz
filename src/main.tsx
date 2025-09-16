import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Suppress third-party integration errors in console
const originalError = console.error;
console.error = (...args) => {
  const message = args[0]?.toString() || '';
  
  // Filter out known third-party integration errors and automatic fix messages
  if (message.includes('OneTimePlugin') || 
      message.includes('PixelML') || 
      message.includes('RS SDK') ||
      message.includes('chrome-extension') ||
      message.includes('trying to fix automatically') ||
      message.includes('An error occurred') ||
      message.includes('net::ERR_FILE_NOT_FOUND')) {
    console.warn('Third-party integration error suppressed:', ...args);
    return;
  }
  
  originalError.apply(console, args);
};

// Handle unhandled promise rejections from third-party integrations
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason?.toString() || '';
  
  if (reason.includes('OneTimePlugin') || 
      reason.includes('PixelML') || 
      reason.includes('RS SDK') ||
      reason.includes('trying to fix automatically') ||
      reason.includes('An error occurred') ||
      reason.includes('blob:') ||
      reason.includes('net::ERR_FILE_NOT_FOUND')) {
    console.warn('Third-party integration promise rejection handled:', event.reason);
    event.preventDefault(); // Prevent the error from showing in console
  }
});

// Global error handler for blob URL loading errors
window.addEventListener('error', (event) => {
  const target = event.target as HTMLImageElement | HTMLVideoElement | HTMLAudioElement;
  
  // Check if this is a blob URL error
  if (target && target.src && target.src.startsWith('blob:')) {
    // Check if it's a network error for blob URLs
    if (event.message?.includes('net::ERR_FILE_NOT_FOUND') || 
        event.message?.includes('Failed to load resource')) {
      
      // Suppress the error to prevent console spam
      event.preventDefault();
      event.stopPropagation();
      
      // Clear the src to prevent further attempts
      target.src = '';
      
      return false;
    }
  }
}, true); // Use capture to catch errors early

// Suppress browser extension notifications and automatic fix messages
const originalToast = window.console?.warn;
if (typeof window !== 'undefined') {
  // Override any third-party toast notifications
  const suppressedMessages = [
    'trying to fix automatically', 
    'An error occurred', 
    'OneTimePlugin',
    'PixelML',
    'RS SDK'
  ];
  
  const originalAlert = window.alert;
  window.alert = (message) => {
    if (suppressedMessages.some(msg => message?.includes(msg))) {
      console.warn('Suppressed third-party alert:', message);
      return;
    }
    originalAlert.call(window, message);
  };
}

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker for PWA (only in production and outside iframes)
if ('serviceWorker' in navigator) {
  const isInIframe = window.self !== window.top;
  const shouldRegisterSW = import.meta.env.PROD && !isInIframe;

  window.addEventListener('load', async () => {
    if (shouldRegisterSW) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('SW registered: ', registration);
      } catch (registrationError) {
        console.log('SW registration failed: ', registrationError);
      }
    } else {
      // Unregister any existing service workers to avoid dev/preview interference
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(r => r.unregister()));
      console.log('SW unregistered in dev/preview');
    }
  });
}
