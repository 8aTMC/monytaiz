import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, X, Smartphone, Monitor, Plus } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';

export const PWAInstallPrompt = () => {
  const { canInstall, isInstalled, installApp, deferredPrompt } = usePWA();
  const [dismissed, setDismissed] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showManualPrompt, setShowManualPrompt] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('PWA State:', { canInstall, isInstalled, deferredPrompt: !!deferredPrompt });
  }, [canInstall, isInstalled, deferredPrompt]);

  useEffect(() => {
    // Show prompt after 3 seconds if installable and not dismissed
    const timer = setTimeout(() => {
      const wasDismissed = localStorage.getItem('pwa-install-dismissed') === 'true';
      console.log('PWA Install Check:', { canInstall, isInstalled, wasDismissed });
      if (canInstall && !isInstalled && !wasDismissed) {
        setShowPrompt(true);
        console.log('PWA Install Prompt shown');
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [canInstall, isInstalled]);

  // Always show manual prompt after 5 seconds for testing
  useEffect(() => {
    const timer = setTimeout(() => {
      const wasDismissed = localStorage.getItem('pwa-manual-dismissed') === 'true';
      if (!isInstalled && !wasDismissed && !showPrompt) {
        setShowManualPrompt(true);
        console.log('Manual PWA Install Prompt shown');
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [isInstalled, showPrompt]);

  const handleInstall = async () => {
    const success = await installApp();
    if (success) {
      setShowPrompt(false);
      setShowManualPrompt(false);
    }
  };

  const handleManualInstall = () => {
    // Show instructions for manual installation
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isChrome = /Chrome/.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !isChrome;

    let instructions = '';
    if (isMobile) {
      if (isChrome) {
        instructions = 'Tap the menu (⋮) and select "Add to Home screen"';
      } else if (isSafari) {
        instructions = 'Tap the share button (⬆) and select "Add to Home Screen"';
      } else {
        instructions = 'Look for "Add to Home Screen" in your browser menu';
      }
    } else {
      instructions = 'Look for the install icon (⊕) in your browser\'s address bar';
    }

    alert(`To install this app:\n\n${instructions}`);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  const handleManualDismiss = () => {
    setShowManualPrompt(false);
    localStorage.setItem('pwa-manual-dismissed', 'true');
  };

  if (dismissed || isInstalled) {
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