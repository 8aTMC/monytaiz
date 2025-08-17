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

  // Smart manual prompt logic - only show if no native prompt and not recently dismissed
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
        platform 
      });
      
      // Show manual prompt if:
      // 1. App is not installed
      // 2. Native prompt is not showing
      // 3. No native install capability (no deferredPrompt)
      // 4. Manual prompt hasn't been recently dismissed
      // 5. Not already dismissed via main prompt
      if (!isInstalled && 
          !showPrompt && 
          !canInstall && 
          !isManualDismissalValid && 
          !isInstallPromptDismissed) {
        setShowManualPrompt(true);
        console.log('🔧 PWA Manual Prompt: Manual guidance shown');
      }
    }, 4000); // Show after native prompt opportunity

    return () => clearTimeout(timer);
  }, [isInstalled, showPrompt, canInstall, isInstallPromptDismissed, platform]);

  const handleInstall = async () => {
    const success = await installApp();
    if (success) {
      setShowPrompt(false);
      setShowManualPrompt(false);
    }
  };

  const handleManualInstall = () => {
    // Enhanced platform-specific installation instructions
    let instructions = '';
    let followUpAction = '';
    
    switch (platform) {
      case 'ios':
        instructions = 'To install this app on iOS:\n\n1. Tap the Share button (⬆) at the bottom\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add" to confirm';
        followUpAction = 'After installation, the app will appear on your home screen like a native app.';
        break;
        
      case 'android':
        const isChrome = /Chrome/.test(navigator.userAgent);
        if (isChrome) {
          instructions = 'To install this app on Android:\n\n1. Tap the menu (⋮) in the top-right corner\n2. Tap "Add to Home screen"\n3. Tap "Add" to confirm';
        } else {
          instructions = 'To install this app on Android:\n\n1. Look for "Add to Home Screen" or "Install App" in your browser menu\n2. Follow the prompts to install';
        }
        followUpAction = 'The app will be installed like a regular Android app.';
        break;
        
      case 'desktop':
        instructions = 'To install this app on desktop:\n\n1. Look for the install icon (⊕) in your browser\'s address bar\n2. Click it and select "Install"\n\nAlternatively:\n• Chrome: Menu → More tools → Create shortcut → Check "Open as window"\n• Edge: Menu → Apps → Install this site as an app';
        followUpAction = 'The app will open in its own window like a desktop application.';
        break;
        
      default:
        instructions = 'To install this app:\n\n• Mobile: Look for "Add to Home Screen" in your browser menu\n• Desktop: Look for an install icon in the address bar';
        followUpAction = 'Once installed, you can access the app directly from your device.';
    }
    
    // Show enhanced installation dialog
    const fullMessage = `${instructions}\n\n${followUpAction}\n\nWould you like to mark this app as installed once you complete these steps?`;
    
    const userConfirmed = confirm(fullMessage);
    if (userConfirmed) {
      // User confirmed they will/have installed manually
      markAsManuallyInstalled();
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

  // Show native install prompt if available
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
                  Install Monytaiz
                </h3>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                  Get the complete app experience with offline access, instant notifications, and lightning-fast performance.
                </p>
                
                <div className="flex gap-3">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleInstall}
                    className="flex-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Install App
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

  // Show manual install prompt if native prompt not available
  if (showManualPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
        <Card className="bg-gradient-card border-border shadow-card animate-in slide-in-from-bottom-2">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  Install App
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Add Monytaiz to your home screen for easy access.
                </p>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleManualInstall}
                    className="flex-1"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    How to Install
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleManualDismiss}
                    className="px-2"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};