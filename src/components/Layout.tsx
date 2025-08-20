import { useEffect } from 'react';
import { Navigation, useSidebar } from '@/components/Navigation';
import { FixedHeader } from '@/components/FixedHeader';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { isCollapsed, isNarrowScreen } = useSidebar();

  // Prevent window scroll; only main content scrolls
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { 
      document.body.style.overflow = prev; 
    };
  }, []);

  // Calculate layout dimensions
  const sidebarWidth = isNarrowScreen 
    ? (isCollapsed ? '0px' : '256px')  // On narrow screens, sidebar overlays or is hidden
    : (isCollapsed ? '64px' : '256px'); // On desktop, sidebar is always visible
  
  const headerHeight = '73px';

  return (
    <div
      className="h-screen w-screen overflow-hidden"
      style={{ 
        // Expose CSS variables for layout calculations
        ['--sidebar-w' as any]: sidebarWidth,
        ['--sidebar-w-collapsed' as any]: '64px',
        ['--header-h' as any]: headerHeight,
      }}
    >
      {/* Fixed header */}
      <FixedHeader />

      {/* Fixed sidebar */}
      <Navigation />

      {/* Main content area: only this scrolls */}
      <main
        className="fixed top-[var(--header-h)] right-0 bottom-0 overflow-auto z-10"
        style={{ 
          left: 'var(--sidebar-w)'  // Always offset by sidebar width
        }}
      >
        {/* Inner container enforces minimum width for horizontal scroll within main */}
        <div className="min-w-[1024px] min-h-[calc(100vh-var(--header-h))] p-6">
          {children}
        </div>
      </main>
    </div>
  );
}