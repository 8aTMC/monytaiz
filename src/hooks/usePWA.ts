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
  const [pwaState, setPwaState] = useState<PWAState>({
    isInstalled: false,
    isInstallable: false,
    isOnline: navigator.onLine,
    canInstall: false,
    deferredPrompt: null,
    platform: 'unknown',
  });

  // Detect platform
  const detectPlatform = useCallback((): PWAState['platform'] => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
    if (/android/.test(userAgent)) return 'android';
    return 'desktop';
  }, []);

  // Check if app is installed
  const checkInstallation = useCallback((): boolean => {
    // Strategy 1: Display mode detection
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
    const isMinimalUi = window.matchMedia('(display-mode: minimal-ui)').matches;
    
    if (isStandalone || isFullscreen || isMinimalUi) {
      console.log('✅ PWA: Installed via display mode');
      return true;
    }

    // Strategy 2: iOS Safari detection
    const isIOSStandalone = (window.navigator as any).standalone === true;
    if (isIOSStandalone) {
      console.log('✅ PWA: Installed on iOS');
      return true;
    }

    // Strategy 3: Check localStorage
    const storedInstalled = localStorage.getItem(PWA_INSTALLED_KEY) === 'true';
    if (storedInstalled) {
      console.log('✅ PWA: Marked as installed in storage');
      return true;
    }

    console.log('❌ PWA: Not installed');
    return false;
  }, []);

  // Check if user dismissed the prompt recently
  const isDismissed = useCallback((): boolean => {
    const dismissed = localStorage.getItem(PWA_DISMISSED_KEY);
    if (!dismissed) return false;
    
    const dismissTime = parseInt(dismissed, 10);
    const now = Date.now();
    const thirtyMinutes = 30 * 60 * 1000;
    
    return (now - dismissTime) < thirtyMinutes;
  }, []);

  useEffect(() => {
    const platform = detectPlatform();
    const isInstalled = checkInstallation();
    const dismissed = isDismissed();

    console.log('🔍 PWA Initial Check:', { platform, isInstalled, dismissed });

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
      
      console.log('🎯 PWA: beforeinstallprompt event received');
      
      setPwaState(prev => ({
        ...prev,
        isInstallable: true,
        deferredPrompt: event,
        canInstall: !prev.isInstalled && !isDismissed(),
      }));
    };

    // Handle app installed event
    const handleAppInstalled = () => {
      console.log('🎉 PWA: App installed');
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
        console.log('🖥️ PWA: Force enabling desktop installation');
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
  }, [detectPlatform, checkInstallation, isDismissed]);

  // Install app function
  const installApp = async (): Promise<boolean> => {
    console.log('📱 PWA: Install attempt started', { 
      platform: pwaState.platform,
      hasDeferredPrompt: !!pwaState.deferredPrompt,
      isInstalled: pwaState.isInstalled 
    });

    if (pwaState.isInstalled) {
      console.log('⚠️ PWA: Already installed');
      return false;
    }

    // Try native installation first
    if (pwaState.deferredPrompt) {
      try {
        console.log('📱 PWA: Using native prompt');
        await pwaState.deferredPrompt.prompt();
        const { outcome } = await pwaState.deferredPrompt.userChoice;
        
        console.log('📊 PWA: User choice:', outcome);
        
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
        console.error('❌ PWA: Native installation failed:', error);
      }
    }

    // Manual installation for desktop
    if (pwaState.platform === 'desktop') {
      console.log('🖥️ PWA: Manual desktop installation');
      
      const isChrome = /Chrome/.test(navigator.userAgent) && !/Edge|OPR/.test(navigator.userAgent);
      const isEdge = /Edge/.test(navigator.userAgent);
      
      let instructions = '';
      if (isChrome) {
        instructions = `Chrome: Look for the install icon (⊕) in your address bar, or use Menu → More tools → Create shortcut`;
      } else if (isEdge) {
        instructions = `Edge: Look for the install icon (+) in your address bar, or use Menu → Apps → Install this site as an app`;
      } else {
        instructions = `Your browser: Look for an install option in your browser menu or address bar`;
      }
      
      const result = confirm(`Install Monytaiz as a desktop app?

✅ Faster loading
✅ Works offline  
✅ App-like experience
✅ Desktop shortcuts

${instructions}

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