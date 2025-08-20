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

  return (
    <header 
      className="absolute top-0 right-0 h-[73px] bg-background border-b border-border transition-all duration-300 flex-shrink-0 z-50"
      style={{ 
        left: isNarrowScreen ? '0' : isCollapsed ? '64px' : '256px'
      }}
    >
      <div className="flex items-center justify-end px-4 h-full w-full">
        <ThemeToggle />
      </div>
    </header>
  );
};