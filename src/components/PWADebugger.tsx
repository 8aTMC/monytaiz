import { Button } from '@/components/ui/button';

export const PWADebugger = () => {
  const clearPWAState = () => {
    localStorage.removeItem('pwa-install-dismissed');
    localStorage.removeItem('pwa-install-dismissed-timestamp');
    localStorage.removeItem('pwa-manual-dismissed');
    localStorage.removeItem('pwa-manual-dismissed-timestamp');
    localStorage.removeItem('pwa-installation-status');
    localStorage.removeItem('pwa-installation-timestamp');
    
    console.log('🧹 PWA: All states cleared - page will reload');
    window.location.reload();
  };

  const forcePWAInstall = () => {
    console.log('🚀 PWA: Force triggering installation check');
    
    // Dispatch a custom event to force PWA check
    window.dispatchEvent(new CustomEvent('forcePWACheck'));
    
    // Also try to trigger beforeinstallprompt manually
    const event = new Event('beforeinstallprompt');
    window.dispatchEvent(event);
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex gap-2">
      <Button 
        onClick={clearPWAState}
        variant="outline"
        size="sm"
        className="bg-red-100 hover:bg-red-200 text-red-700"
      >
        Clear PWA State
      </Button>
      <Button 
        onClick={forcePWAInstall}
        variant="outline"
        size="sm"
        className="bg-blue-100 hover:bg-blue-200 text-blue-700"
      >
        Force PWA Install
      </Button>
    </div>
  );
};