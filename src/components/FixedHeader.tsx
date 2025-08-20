import { useLocation } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/components/AuthProvider';
import { useSidebar } from '@/components/Navigation';

export const FixedHeader = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { isCollapsed, isNarrowScreen } = useSidebar();

  // Hide header on auth and onboarding pages
  if (location.pathname === '/' || location.pathname === '/onboarding') {
    return null;
  }

  if (!user) return null;

  // Calculate left offset based on sidebar state
  const leftOffset = isNarrowScreen ? '0' : isCollapsed ? '64px' : '256px';

  return (
    <header 
      className="fixed top-0 z-[100] bg-background border-b border-border h-[73px] transition-all duration-300"
      style={{ left: leftOffset, right: '0' }}
    >
      <div className="flex items-center justify-end px-4 h-full">
        <ThemeToggle />
      </div>
    </header>
  );
};