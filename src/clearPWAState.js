// Clear any existing PWA dismissal states
localStorage.removeItem('pwa-install-dismissed');
localStorage.removeItem('pwa-install-dismissed-timestamp');
localStorage.removeItem('pwa-manual-dismissed');
localStorage.removeItem('pwa-manual-dismissed-timestamp');
localStorage.removeItem('pwa-installation-status');
localStorage.removeItem('pwa-installation-timestamp');

console.log('🧹 PWA: Cleared all dismissal states for fresh installation attempt');