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
  installationSource: 'unknown' | 'auto' | 'manual' | 'detected';
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
}

// Enhanced detection constants
const PWA_INSTALL_KEY = 'pwa-installation-status';
const PWA_INSTALL_TIMESTAMP = 'pwa-installation-timestamp';
const PWA_DISMISS_KEY = 'pwa-install-dismissed';
const PWA_DISMISS_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

export const usePWA = () => {
  const [pwaState, setPwaState] = useState<PWAState>({
    isInstalled: false,
    isInstallable: false,
    isOnline: navigator.onLine,
    canInstall: false,
    deferredPrompt: null,
    installationSource: 'unknown',
    platform: 'unknown',
  });

  // Enhanced platform detection
  const detectPlatform = useCallback((): PWAState['platform'] => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
    if (/android/.test(userAgent)) return 'android';
    if (/windows|macintosh|linux/.test(userAgent)) return 'desktop';
    return 'unknown';
  }, []);

  // Enhanced installation detection with multiple strategies
  const detectInstallation = useCallback((): { isInstalled: boolean; source: PWAState['installationSource'] } => {
    console.log('🔍 PWA Detection: Running enhanced installation check...');
    
    // Strategy 1: Display mode detection (most reliable)
    const displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const displayModeFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
    const displayModeMinimalUi = window.matchMedia('(display-mode: minimal-ui)').matches;
    
    if (displayModeStandalone || displayModeFullscreen || displayModeMinimalUi) {
      console.log('✅ PWA Detection: Installed via display mode:', { displayModeStandalone, displayModeFullscreen, displayModeMinimalUi });
      return { isInstalled: true, source: 'detected' };
    }

    // Strategy 2: iOS Safari specific detection
    const isIOSStandalone = (window.navigator as any).standalone === true;
    if (isIOSStandalone) {
      console.log('✅ PWA Detection: Installed on iOS Safari');
      return { isInstalled: true, source: 'detected' };
    }

    // Strategy 3: URL parameter detection (launched from installed app)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('source') === 'pwa' || urlParams.get('utm_source') === 'homescreen') {
      console.log('✅ PWA Detection: Installed via URL parameters');
      return { isInstalled: true, source: 'detected' };
    }

    // Strategy 4: Only trust stored status if we can actually verify installation
    const storedStatus = localStorage.getItem(PWA_INSTALL_KEY);
    const storedTimestamp = localStorage.getItem(PWA_INSTALL_TIMESTAMP);
    
    // Check if we have real installation indicators before trusting stored status
    const hasRealInstallIndicators = displayModeStandalone || displayModeFullscreen || displayModeMinimalUi || isIOSStandalone;
    
    if (storedStatus === 'installed' && storedTimestamp && hasRealInstallIndicators) {
      const installTime = parseInt(storedTimestamp, 10);
      const daysSinceInstall = (Date.now() - installTime) / (1000 * 60 * 60 * 24);
      
      if (daysSinceInstall <= 30) {
        console.log('✅ PWA Detection: Installed via stored status with verification (', Math.round(daysSinceInstall), 'days ago)');
        return { isInstalled: true, source: 'manual' };
      }
    } else if (storedStatus === 'installed' && !hasRealInstallIndicators) {
      // Clear false installation status
      console.log('🧹 PWA Detection: Clearing false installation status - no real indicators found');
      localStorage.removeItem(PWA_INSTALL_KEY);
      localStorage.removeItem(PWA_INSTALL_TIMESTAMP);
    }

    console.log('❌ PWA Detection: Not installed');
    return { isInstalled: false, source: 'unknown' };
  }, []);

  // Check if user dismissed install prompt recently
  const isInstallPromptDismissed = useCallback((): boolean => {
    const dismissedTimestamp = localStorage.getItem(`${PWA_DISMISS_KEY}-timestamp`);
    if (!dismissedTimestamp) return false;
    
    const timeSinceDismissal = Date.now() - parseInt(dismissedTimestamp, 10);
    return timeSinceDismissal < PWA_DISMISS_EXPIRY;
  }, []);

  useEffect(() => {
    // Enhanced installation check with multiple strategies
    const checkInstallation = () => {
      const { isInstalled, source } = detectInstallation();
      const platform = detectPlatform();
      
      setPwaState(prev => ({ 
        ...prev, 
        isInstalled, 
        installationSource: source,
        platform,
        canInstall: (prev.deferredPrompt !== null || platform === 'desktop') && !isInstalled && !isInstallPromptDismissed()
      }));
    };

    // Enhanced beforeinstallprompt event handling
    const handleBeforeInstallPrompt = (e: Event) => {
      const event = e as BeforeInstallPromptEvent;
      e.preventDefault();
      console.log('🎯 PWA: beforeinstallprompt event received', event.platforms);
      
      const { isInstalled } = detectInstallation();
      const isDismissed = isInstallPromptDismissed();
      
      setPwaState(prev => ({
        ...prev,
        isInstallable: true,
        canInstall: !isInstalled && !isDismissed,
        deferredPrompt: event,
      }));
    };

    // Force installability check for browsers that support PWA but may not trigger beforeinstallprompt
    const forceInstallabilityCheck = () => {
      const { isInstalled } = detectInstallation();
      const isDismissed = isInstallPromptDismissed();
      const platform = detectPlatform();
      
      // Enhanced browser support detection
      const isInstallSupported = 
        'serviceWorker' in navigator && 
        window.matchMedia('(display-mode: browser)').matches &&
        !isInstalled;
      
      // For desktop browsers, check for specific PWA install capabilities
      const hasInstallCapability = platform === 'desktop' && (
        // Chrome/Edge has install prompt support
        'getInstalledRelatedApps' in navigator ||
        // Check if we're in a PWA-capable browser
        window.matchMedia('(display-mode: browser)').matches
      );
      
      console.log('🔧 PWA: Force installability check', { 
        isInstallSupported, 
        isInstalled, 
        isDismissed, 
        platform, 
        hasInstallCapability 
      });
      
      // Set canInstall based on platform capabilities
      if (isInstallSupported && !isDismissed) {
        setPwaState(prev => ({
          ...prev,
          isInstallable: true,
          canInstall: true,
        }));
      } else if (platform === 'desktop' && !isInstalled && !isDismissed) {
        // Desktop browsers can still install even without beforeinstallprompt
        setPwaState(prev => ({
          ...prev,
          isInstallable: true,
          canInstall: true,
        }));
      }
    };

    // Enhanced app installation event handling
    const handleAppInstalled = () => {
      console.log('🎉 PWA: App installation detected');
      
      // Store installation status persistently
      localStorage.setItem(PWA_INSTALL_KEY, 'installed');
      localStorage.setItem(PWA_INSTALL_TIMESTAMP, Date.now().toString());
      localStorage.removeItem(PWA_DISMISS_KEY);
      localStorage.removeItem(`${PWA_DISMISS_KEY}-timestamp`);
      
      setPwaState(prev => ({
        ...prev,
        isInstalled: true,
        isInstallable: false,
        canInstall: false,
        deferredPrompt: null,
        installationSource: 'auto',
      }));
    };

    // Listen for online/offline status
    const handleOnline = () => {
      setPwaState(prev => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setPwaState(prev => ({ ...prev, isOnline: false }));
    };

    // Enhanced display mode change detection
    const handleDisplayModeChange = () => {
      console.log('🔄 PWA: Display mode changed, re-checking installation');
      checkInstallation();
    };

    // Enhanced resize detection for installation state changes
    const handleResize = () => {
      // Debounce resize events
      clearTimeout((window as any).resizeTimeout);
      (window as any).resizeTimeout = setTimeout(() => {
        checkInstallation();
      }, 100);
    };

    // Initial check
    checkInstallation();
    
    // Force installability check after a delay if beforeinstallprompt hasn't fired
    const installabilityTimer = setTimeout(() => {
      if (!pwaState.canInstall && !pwaState.isInstalled) {
        console.log('🚀 PWA: Forcing installability check');
        forceInstallabilityCheck();
      }
    }, 3000);

    // Add event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('resize', handleResize);
    
    // Listen for display mode changes
    const mediaQueryStandalone = window.matchMedia('(display-mode: standalone)');
    const mediaQueryFullscreen = window.matchMedia('(display-mode: fullscreen)');
    
    if (mediaQueryStandalone.addEventListener) {
      mediaQueryStandalone.addEventListener('change', handleDisplayModeChange);
      mediaQueryFullscreen.addEventListener('change', handleDisplayModeChange);
    }

    // Re-check installation status periodically (every 5 minutes)
    const installCheckInterval = setInterval(checkInstallation, 5 * 60 * 1000);

    // Cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('resize', handleResize);
      
      if (mediaQueryStandalone.removeEventListener) {
        mediaQueryStandalone.removeEventListener('change', handleDisplayModeChange);
        mediaQueryFullscreen.removeEventListener('change', handleDisplayModeChange);
      }
      
      clearInterval(installCheckInterval);
      clearTimeout(installabilityTimer);
      clearTimeout((window as any).resizeTimeout);
    };
  }, [detectInstallation, detectPlatform, isInstallPromptDismissed]);

  // Enhanced install app function with better error handling and desktop support
  const installApp = async () => {
    console.log('📱 PWA: Install attempt started', { 
      hasDeferredPrompt: !!pwaState.deferredPrompt, 
      platform: pwaState.platform 
    });

    if (!pwaState.deferredPrompt) {
      console.warn('🚫 PWA: No deferred prompt available for installation');
      
      // For desktop browsers without deferred prompt, try alternative approaches
      if (pwaState.platform === 'desktop') {
        console.log('🖥️ PWA: Attempting desktop installation fallback');
        
        // Try to trigger a manual installation flow
        const userWantsInstructions = confirm('This app can be installed on your desktop for a better experience.\n\nWould you like to see installation instructions?');
        
        if (userWantsInstructions) {
          const instructions = `To install this app on your desktop:

1. Look for the install icon (⊕) in your browser's address bar and click it
2. If no install icon is visible:
   • Chrome: Menu (⋮) → More tools → Create shortcut → Check "Open as window"
   • Edge: Menu (⋯) → Apps → Install this site as an app
   • Firefox: Menu (☰) → Page → Install page as app

The app will then open in its own window like a desktop application.

Would you like to mark the app as installed after completing these steps?`;

          const markAsInstalled = confirm(instructions);
          if (markAsInstalled) {
            // Mark as manually installed
            localStorage.setItem(PWA_INSTALL_KEY, 'installed');
            localStorage.setItem(PWA_INSTALL_TIMESTAMP, Date.now().toString());
            
            setPwaState(prev => ({
              ...prev,
              isInstalled: true,
              canInstall: false,
              installationSource: 'manual',
            }));
            return true;
          }
        }
        return false;
      }
      
      return false;
    }

    try {
      console.log('📱 PWA: Prompting user for installation...');
      await pwaState.deferredPrompt.prompt();
      const { outcome } = await pwaState.deferredPrompt.userChoice;
      
      console.log('📊 PWA: User choice outcome:', outcome);
      
      if (outcome === 'accepted') {
        // Store installation status
        localStorage.setItem(PWA_INSTALL_KEY, 'installed');
        localStorage.setItem(PWA_INSTALL_TIMESTAMP, Date.now().toString());
        localStorage.removeItem(PWA_DISMISS_KEY);
        localStorage.removeItem(`${PWA_DISMISS_KEY}-timestamp`);
        
        setPwaState(prev => ({
          ...prev,
          canInstall: false,
          deferredPrompt: null,
          installationSource: 'auto',
        }));
        return true;
      } else {
        // User dismissed the prompt
        localStorage.setItem(PWA_DISMISS_KEY, 'true');
        localStorage.setItem(`${PWA_DISMISS_KEY}-timestamp`, Date.now().toString());
        
        setPwaState(prev => ({
          ...prev,
          canInstall: false,
          deferredPrompt: null,
        }));
      }
      
      return false;
    } catch (error) {
      console.error('❌ PWA: Error during installation:', error);
      return false;
    }
  };

  // Enhanced manual installation tracking
  const markAsManuallyInstalled = useCallback(() => {
    localStorage.setItem(PWA_INSTALL_KEY, 'installed');
    localStorage.setItem(PWA_INSTALL_TIMESTAMP, Date.now().toString());
    localStorage.removeItem(PWA_DISMISS_KEY);
    localStorage.removeItem(`${PWA_DISMISS_KEY}-timestamp`);
    
    setPwaState(prev => ({
      ...prev,
      isInstalled: true,
      canInstall: false,
      installationSource: 'manual',
    }));
  }, []);

  const shareApp = async () => {
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
    markAsManuallyInstalled,
    isInstallPromptDismissed: isInstallPromptDismissed(),
  };
};