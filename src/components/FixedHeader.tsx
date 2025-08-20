import { useLocation } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/components/AuthProvider';

export const FixedHeader = () => {
  const { user } = useAuth();
  const location = useLocation();

  // Hide header on auth and onboarding pages
  if (location.pathname === '/' || location.pathname === '/onboarding') {
    return null;
  }

  if (!user) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-[100] bg-background border-b border-border">
      <div className="flex items-center justify-end px-4 py-4 h-[73px]">
        <ThemeToggle />
      </div>
    </header>
  );
};