import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAState {
  isInstalled: boolean;
  isInstallable: boolean;
  isOnline: boolean;
  canInstall: boolean;
  deferredPrompt: BeforeInstallPromptEvent | null;
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
}

const PWA_DISMISSED_KEY = 'pwa-dismissed';
const PWA_INSTALLED_KEY = 'pwa-installed';

export const usePWA = () => {
  // Detect platform
  const detectPlatform = (): PWAState['platform'] => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
    if (/android/.test(userAgent)) return 'android';
    return 'desktop';
  };

  // Check if app is installed
  const checkInstallation = (): boolean => {
    // Strategy 1: Display mode detection (works for all platforms)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
    const isMinimalUi = window.matchMedia('(display-mode: minimal-ui)').matches;
    
    console.log('🔍 PWA Detection:', {
      isStandalone,
      isFullscreen,
      isMinimalUi,
      displayMode: window.matchMedia('(display-mode: standalone)').media,
      userAgent: navigator.userAgent,
      referrer: document.referrer
    });
    
    if (isStandalone || isFullscreen || isMinimalUi) {
      console.log('✅ PWA: App is running in standalone mode');
      return true;
    }

    // Strategy 2: iOS Safari detection
    const isIOSStandalone = (window.navigator as any).standalone === true;
    if (isIOSStandalone) {
      console.log('✅ PWA: iOS standalone detected');
      return true;
    }

    // Strategy 3: Check if we're in a PWA window (additional checks)
    // Check if the referrer indicates PWA launch
    if (document.referrer.includes('android-app://')) {
      console.log('✅ PWA: Android app referrer detected');
      return true;
    }

    // Strategy 4: Check localStorage as fallback
    const storedInstalled = localStorage.getItem(PWA_INSTALLED_KEY) === 'true';
    if (storedInstalled) {
      console.log('✅ PWA: LocalStorage indicates installed');
    }
    
    console.log('❌ PWA: Not detected as installed');
    return storedInstalled;
  };

  // Check if user dismissed the prompt recently
  const isDismissed = (): boolean => {
    const dismissed = localStorage.getItem(PWA_DISMISSED_KEY);
    if (!dismissed) return false;
    
    const dismissTime = parseInt(dismissed, 10);
    const now = Date.now();
    const thirtyMinutes = 30 * 60 * 1000;
    
    return (now - dismissTime) < thirtyMinutes;
  };
  const [pwaState, setPwaState] = useState<PWAState>(() => {
    const platform = detectPlatform();
    const isInstalled = checkInstallation();
    const dismissed = isDismissed();
    
    return {
      isInstalled,
      isInstallable: false,
      isOnline: navigator.onLine,
      canInstall: !isInstalled && !dismissed,
      deferredPrompt: null,
      platform,
    };
  });

  useEffect(() => {
    const platform = detectPlatform();
    const isInstalled = checkInstallation();
    const dismissed = isDismissed();

    setPwaState(prev => ({
      ...prev,
      platform,
      isInstalled,
      canInstall: !isInstalled && !dismissed,
      isOnline: navigator.onLine,
    }));

    // Handle beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      const event = e as BeforeInstallPromptEvent;
      e.preventDefault();
      
      setPwaState(prev => ({
        ...prev,
        isInstallable: true,
        deferredPrompt: event,
        canInstall: !prev.isInstalled && !isDismissed(),
      }));
    };

    // Handle app installed event
    const handleAppInstalled = () => {
      localStorage.setItem(PWA_INSTALLED_KEY, 'true');
      localStorage.removeItem(PWA_DISMISSED_KEY);
      
      setPwaState(prev => ({
        ...prev,
        isInstalled: true,
        canInstall: false,
        deferredPrompt: null,
      }));
    };

    // Handle online/offline
    const handleOnline = () => setPwaState(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setPwaState(prev => ({ ...prev, isOnline: false }));

    // Add event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Force installability for desktop browsers after delay
    const timer = setTimeout(() => {
      if (platform === 'desktop' && !isInstalled && !dismissed) {
        setPwaState(prev => ({
          ...prev,
          isInstallable: true,
          canInstall: true,
        }));
      }
    }, 1000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(timer);
    };
  }, []);

  // Install app function
  const installApp = async (): Promise<boolean> => {
    if (pwaState.isInstalled) {
      return false;
    }

    // Try native installation first
    if (pwaState.deferredPrompt) {
      try {
        await pwaState.deferredPrompt.prompt();
        const { outcome } = await pwaState.deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          localStorage.setItem(PWA_INSTALLED_KEY, 'true');
          localStorage.removeItem(PWA_DISMISSED_KEY);
          
          setPwaState(prev => ({
            ...prev,
            isInstalled: true,
            canInstall: false,
            deferredPrompt: null,
          }));
          return true;
        } else {
          localStorage.setItem(PWA_DISMISSED_KEY, Date.now().toString());
          setPwaState(prev => ({
            ...prev,
            canInstall: false,
            deferredPrompt: null,
          }));
          return false;
        }
      } catch (error) {
        console.error('PWA installation failed:', error);
      }
    }

    // Manual installation for desktop
    if (pwaState.platform === 'desktop') {
      const result = confirm(`Install Monytaiz as a desktop app?

✅ Faster loading
✅ Works offline  
✅ App-like experience
✅ Desktop shortcuts

Click OK after you've completed the installation.`);
      
      if (result) {
        localStorage.setItem(PWA_INSTALLED_KEY, 'true');
        localStorage.removeItem(PWA_DISMISSED_KEY);
        
        setPwaState(prev => ({
          ...prev,
          isInstalled: true,
          canInstall: false,
        }));
        return true;
      }
    }
    
    return false;
  };

  // Dismiss prompt
  const dismissPrompt = useCallback(() => {
    localStorage.setItem(PWA_DISMISSED_KEY, Date.now().toString());
    setPwaState(prev => ({
      ...prev,
      canInstall: false,
    }));
  }, []);

  // Share app
  const shareApp = async (): Promise<boolean> => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Monytaiz - Premium Fan Platform',
          text: 'Join the ultimate platform for creators and fans',
          url: window.location.origin,
        });
        return true;
      } catch (error) {
        console.error('Error sharing:', error);
        return false;
      }
    }
    return false;
  };

  return {
    ...pwaState,
    installApp,
    shareApp,
    dismissPrompt,
    isDismissed: isDismissed(),
  };
};