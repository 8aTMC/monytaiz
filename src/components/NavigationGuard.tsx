import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const NavigationGuard = () => {
  const location = useLocation();

  useEffect(() => {
    // Prevent full page reloads on back/forward navigation
    const handlePopState = (e: PopStateEvent) => {
      console.log('🔄 Navigation intercepted, using React Router');
    };

    // Intercept link clicks that might cause full page reloads
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      
      if (link && link.href) {
        const url = new URL(link.href);
        // Only intercept same-origin links
        if (url.origin === window.location.origin) {
          console.log('🔗 Intercepted same-origin link click:', url.pathname);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    document.addEventListener('click', handleLinkClick);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleLinkClick);
    };
  }, []);

  // Track library exits and clear filters
  useEffect(() => {
    const previousPath = sessionStorage.getItem('previousPath');
    
    // If we're leaving the library page, clear all library filters
    if (previousPath && (previousPath.includes('/library') || previousPath.includes('/simple-library')) && 
        !location.pathname.includes('/library')) {
      console.log('🧹 NavigationGuard: Detected library exit, clearing filters');
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('library-filters-')) {
          localStorage.removeItem(key);
        }
      });
    }
    
    // Store current path for next navigation
    sessionStorage.setItem('previousPath', location.pathname);
    
    console.log('📍 Route changed to:', location.pathname);
  }, [location.pathname]);

  return null;
};