import { useState, useEffect } from 'react';

interface PageVisibilityState {
  isVisible: boolean;
  wasHidden: boolean;
  hiddenTime: number | null;
}

export const usePageVisibility = () => {
  const [state, setState] = useState<PageVisibilityState>({
    isVisible: !document.hidden,
    wasHidden: false,
    hiddenTime: null,
  });

  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      
      setState(prev => ({
        isVisible,
        wasHidden: prev.wasHidden || !isVisible,
        hiddenTime: !isVisible ? Date.now() : prev.hiddenTime,
      }));
    };

    // Add event listeners for various page visibility events
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    window.addEventListener('blur', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      window.removeEventListener('blur', handleVisibilityChange);
    };
  }, []);

  return state;
};