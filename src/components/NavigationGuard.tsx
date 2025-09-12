import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const NavigationGuard = () => {
  const location = useLocation();

  useEffect(() => {
    // Prevent default browser navigation behavior that might cause refreshes
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only show warning for actual page unload, not tab switches
      if (performance.navigation?.type === 1) { // TYPE_NAVIGATE
        e.preventDefault();
        return '';
      }
    };

    // Handle popstate to prevent full page reloads
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      console.log('🔄 Navigation intercepted, using React Router');
    };

    // Override window.location assignments that might cause refreshes
    const originalAssign = window.location.assign;
    const originalReplace = window.location.replace;
    
    window.location.assign = function(url: string) {
      console.log('🚫 Prevented location.assign, use React Router instead:', url);
      // Only allow external URLs
      if (url.startsWith('http') && !url.includes(window.location.origin)) {
        originalAssign.call(this, url);
      }
    };
    
    window.location.replace = function(url: string) {
      console.log('🚫 Prevented location.replace, use React Router instead:', url);
      // Only allow external URLs
      if (url.startsWith('http') && !url.includes(window.location.origin)) {
        originalReplace.call(this, url);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      window.location.assign = originalAssign;
      window.location.replace = originalReplace;
    };
  }, []);

  // Log route changes for debugging
  useEffect(() => {
    console.log('📍 Route changed to:', location.pathname);
  }, [location.pathname]);

  return null;
};