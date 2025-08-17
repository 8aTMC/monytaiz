import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, X, Smartphone, Monitor, Plus } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';

export const PWAInstallPrompt = () => {
  const { 
    canInstall, 
    isInstalled, 
    installApp, 
    deferredPrompt, 
    platform, 
    installationSource,
    markAsManuallyInstalled,
    isInstallPromptDismissed 
  } = usePWA();
  
  const [dismissed, setDismissed] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showManualPrompt, setShowManualPrompt] = useState(false);

  // Enhanced debug logging
  useEffect(() => {
    console.log('🎛️ PWA Install Prompt State:', { 
      canInstall, 
      isInstalled, 
      platform, 
      installationSource,
      deferredPrompt: !!deferredPrompt,
      isInstallPromptDismissed,
      showPrompt,
      showManualPrompt 
    });
  }, [canInstall, isInstalled, deferredPrompt, platform, installationSource, isInstallPromptDismissed, showPrompt, showManualPrompt]);

  useEffect(() => {
    // Enhanced prompt timing logic
    const timer = setTimeout(() => {
      console.log('🕐 PWA Install Timer: Checking if prompt should show...');
      
      if (canInstall && !isInstalled && !isInstallPromptDismissed) {
        setShowPrompt(true);
        console.log('✨ PWA Install Prompt: Native prompt shown');
      }
    }, 2000); // Reduced delay for better UX

    return () => clearTimeout(timer);
  }, [canInstall, isInstalled, isInstallPromptDismissed]);

  // Smart manual prompt logic - show for desktop when no native support
  useEffect(() => {
    const timer = setTimeout(() => {
      const manualDismissed = localStorage.getItem('pwa-manual-dismissed') === 'true';
      const manualDismissedTime = localStorage.getItem('pwa-manual-dismissed-timestamp');
      
      // Check if manual dismissal has expired (24 hours)
      let isManualDismissalValid = false;
      if (manualDismissed && manualDismissedTime) {
        const timeSinceDismissal = Date.now() - parseInt(manualDismissedTime, 10);
        isManualDismissalValid = timeSinceDismissal < 24 * 60 * 60 * 1000; // 24 hours
      }
      
      console.log('🔧 PWA Manual Prompt Check:', { 
        isInstalled, 
        showPrompt, 
        canInstall, 
        manualDismissed, 
        isManualDismissalValid,
        platform,
        deferredPrompt: !!deferredPrompt
      });
      
      // Show manual prompt if:
      // 1. App is not installed
      // 2. Native prompt is not showing  
      // 3. Manual prompt hasn't been recently dismissed
      // 4. Not already dismissed via main prompt
      // 5. Always show for desktop browsers to ensure installation option is available
      const shouldShowManual = !isInstalled && 
                              !showPrompt && 
                              !isManualDismissalValid && 
                              !isInstallPromptDismissed &&
                              (platform === 'desktop' || /windows|macintosh|linux/.test(navigator.userAgent.toLowerCase()));
      
      if (shouldShowManual) {
        setShowManualPrompt(true);
        console.log('🔧 PWA Manual Prompt: Manual guidance shown for', platform);
      }
    }, 2000); // Reduced delay for faster response

    return () => clearTimeout(timer);
  }, [isInstalled, showPrompt, canInstall, isInstallPromptDismissed, platform, deferredPrompt]);

  const handleInstall = async () => {
    const success = await installApp();
    if (success) {
      setShowPrompt(false);
      setShowManualPrompt(false);
    }
  };

  const handleManualInstall = async () => {
    // Always use the main installApp function which has enhanced desktop handling
    const success = await installApp();
    if (success) {
      setShowPrompt(false);
      setShowManualPrompt(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowPrompt(false);
    // Enhanced dismissal with timestamp
    localStorage.setItem('pwa-install-dismissed', 'true');
    localStorage.setItem('pwa-install-dismissed-timestamp', Date.now().toString());
    console.log('🚫 PWA Install Prompt: Dismissed by user');
  };

  const handleManualDismiss = () => {
    setShowManualPrompt(false);
    // Enhanced manual dismissal with timestamp
    localStorage.setItem('pwa-manual-dismissed', 'true');
    localStorage.setItem('pwa-manual-dismissed-timestamp', Date.now().toString());
    console.log('🚫 PWA Manual Prompt: Dismissed by user');
  };

  // Enhanced condition check - don't show if installed or dismissed
  if (dismissed || isInstalled) {
    console.log('🔒 PWA Install Prompt: Hidden due to', { dismissed, isInstalled, installationSource });
    return null;
  }

  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Show install prompt - prioritize native if available, fallback to manual
  if (showPrompt && canInstall) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-background to-secondary/10 backdrop-blur-xl border border-primary/20 shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
          {/* Animated background elements */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-50" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-pulse" />
          
          <CardContent className="relative p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 p-3 rounded-full bg-primary/20 backdrop-blur-sm">
                {isMobile ? (
                  <Smartphone className="h-6 w-6 text-primary" />
                ) : (
                  <Monitor className="h-6 w-6 text-primary" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-foreground mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  {isMobile ? 'Install Mobile App' : 'Install Desktop App'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                  {isMobile 
                    ? 'Add Monytaiz to your home screen for instant access, push notifications, and a native mobile experience.'
                    : 'Install Monytaiz on your desktop for offline access, notifications, and a seamless app experience.'
                  }
                </p>
                
                <div className="flex gap-3">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleInstall}
                    className="flex-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isMobile ? 'Add to Home Screen' : 'Install App'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDismiss}
                    className="px-3 hover:bg-destructive/10 hover:text-destructive transition-colors duration-200"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </div>
      </div>
    );
  }

  // Show install prompt even without native support but with enhanced install button
  if (showManualPrompt && !isInstalled) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-background to-secondary/10 backdrop-blur-xl border border-primary/20 shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
          {/* Animated background elements */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-50" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-pulse" />
          
          <CardContent className="relative p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 p-3 rounded-full bg-primary/20 backdrop-blur-sm">
                {isMobile ? (
                  <Smartphone className="h-6 w-6 text-primary" />
                ) : (
                  <Monitor className="h-6 w-6 text-primary" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-foreground mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  {isMobile ? 'Get Mobile App' : 'Install Desktop App'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                  {isMobile 
                    ? 'Add Monytaiz to your home screen for quick access and a mobile app experience.'
                    : 'Install Monytaiz on your desktop for better performance and app-like functionality.'
                  }
                </p>
                
                <div className="flex gap-3">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleManualInstall}
                    className={`flex-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 ${
                      !isMobile ? 'opacity-100' : ''
                    }`}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isMobile ? 'Add to Home' : 'Install App'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleManualDismiss}
                    className="px-3 hover:bg-destructive/10 hover:text-destructive transition-colors duration-200"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </div>
      </div>
    );
  }


  return null;
};