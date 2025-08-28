import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Suppress third-party integration errors in console
const originalError = console.error;
console.error = (...args) => {
  const message = args[0]?.toString() || '';
  
  // Filter out known third-party integration errors
  if (message.includes('OneTimePlugin') || 
      message.includes('PixelML') || 
      message.includes('RS SDK') ||
      message.includes('chrome-extension')) {
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
      reason.includes('RS SDK')) {
    console.warn('Third-party integration promise rejection handled:', event.reason);
    event.preventDefault(); // Prevent the error from showing in console
  }
});

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
