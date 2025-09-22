import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Navigation, useSidebar } from '@/components/Navigation';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { isCollapsed, isNarrowScreen } = useSidebar();
  const location = useLocation();
  const mainRef = useRef<HTMLDivElement>(null);

  // Check if we're on the messages page to apply different padding
  const isMessagesPage = location.pathname === '/messages';
  const containerPadding = isMessagesPage ? 'p-0' : 'px-6';

  // Prevent window scroll; only main content scrolls
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { 
      document.body.style.overflow = prev; 
    };
  }, []);

  const expandedW = '224px';   // expanded sidebar width (matches w-56)
  const collapsedW = '64px';   // collapsed sidebar width (matches w-16)

  // Set CSS vars + reset horizontal scroll on toggle
  useLayoutEffect(() => {
    const w = isCollapsed ? collapsedW : expandedW;
    document.documentElement.style.setProperty('--sidebar-w', w);
    document.documentElement.style.setProperty('--sidebar-w-collapsed', collapsedW);

    // Reset horizontal scroll so the left edge is visible after the width change
    if (mainRef.current) mainRef.current.scrollLeft = 0;
  }, [isCollapsed]);

  return (
    <div className="h-screen w-screen overflow-hidden">
      {/* Fixed sidebar */}
      <Navigation />

      {/* Main content area: only this scrolls */}
      <main
        ref={mainRef}
        className="layout-main fixed overflow-auto z-10"
        style={{ 
          inset: '0 0 0 var(--sidebar-w)'  // top right bottom left
        }}
      >
        {/* Inner container enforces minimum width for horizontal scroll within main */}
        <div className={`min-w-[1024px] h-full box-border ${containerPadding} flex flex-col`}>
          <div className="flex-1 min-h-0 overflow-visible">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}