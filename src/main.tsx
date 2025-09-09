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
      message.includes('An error occurred')) {
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
      reason.includes('An error occurred')) {
    console.warn('Third-party integration promise rejection handled:', event.reason);
    event.preventDefault(); // Prevent the error from showing in console
  }
});

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

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
