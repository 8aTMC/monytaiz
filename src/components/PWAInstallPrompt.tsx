import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, X, Smartphone, Monitor } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';

export const PWAInstallPrompt = () => {
  const { 
    canInstall, 
    isInstalled, 
    installApp, 
    dismissPrompt,
    deferredPrompt, 
    platform, 
    isDismissed
  } = usePWA();
  
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    console.log('🎛️ PWA Prompt State:', { 
      canInstall, 
      isInstalled, 
      platform, 
      hasDeferredPrompt: !!deferredPrompt,
      isDismissed,
      showPrompt 
    });

    // Show prompt after a short delay if conditions are met
    const timer = setTimeout(() => {
      if (canInstall && !isInstalled && !isDismissed) {
        setShowPrompt(true);
        console.log('✨ PWA: Showing install prompt');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [canInstall, isInstalled, isDismissed, deferredPrompt, platform]);

  const handleInstall = async () => {
    console.log('📱 PWA: Install button clicked');
    const success = await installApp();
    if (success) {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    console.log('🚫 PWA: Prompt dismissed');
    dismissPrompt();
    setShowPrompt(false);
  };

  // Don't show if not ready or already installed
  if (!showPrompt || isInstalled || isDismissed || !canInstall) {
    return null;
  }

  const isMobile = platform === 'ios' || platform === 'android';

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <Card className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-secondary/10 backdrop-blur-xl border border-primary/20 shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
        {/* Animated background */}
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
                  ? 'Add Monytaiz to your home screen for instant access and notifications.'
                  : 'Install Monytaiz on your desktop for offline access and a seamless app experience.'
                }
              </p>
              
              <div className="flex gap-3">
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleInstall}
                  className="flex-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isMobile ? 'Add to Home Screen' : 'Install App'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDismiss}
                  className="px-3 hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};