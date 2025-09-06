import { useEffect, useLayoutEffect, useRef } from 'react';
import { Navigation, useSidebar } from '@/components/Navigation';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { isCollapsed, isNarrowScreen } = useSidebar();
  const mainRef = useRef<HTMLDivElement>(null);

  // Prevent window scroll; only main content scrolls
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { 
      document.body.style.overflow = prev; 
    };
  }, []);

  const expandedW = '256px';   // expanded sidebar width
  const collapsedW = '64px';   // collapsed sidebar width

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
        <div className="min-w-[1024px] h-full box-border px-6 pb-6 pt-[30px] flex flex-col">
          <div className="flex-1 min-h-0 overflow-visible">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}