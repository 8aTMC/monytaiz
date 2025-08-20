import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Upload, 
  MessageSquare, 
  Users, 
  Bell,
  Search,
  Menu
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/components/AuthProvider';
import { useSidebar } from '@/components/Navigation';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export const FixedHeader = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { setIsCollapsed, isCollapsed } = useSidebar();
  const [searchQuery, setSearchQuery] = useState('');

  // Hide header on auth and onboarding pages
  if (location.pathname === '/' || location.pathname === '/onboarding') {
    return null;
  }

  if (!user) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // TODO: Implement search functionality
      console.log('Search:', searchQuery);
    }
  };

  const quickActions = [
    {
      icon: Upload,
      label: t('platform.nav.upload', 'Upload'),
      href: '/upload',
      variant: 'default' as const,
      className: 'bg-primary text-primary-foreground hover:bg-primary/90'
    },
    {
      icon: MessageSquare,
      label: t('platform.nav.messages', 'Messages'),
      href: '/messages',
      variant: 'outline' as const,
      badge: 3 // Mock notification count
    },
    {
      icon: Users,
      label: t('platform.nav.fans', 'Fans'),
      href: '/fans',
      variant: 'outline' as const
    }
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-[100] bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left side - Menu toggle and search */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          {/* Search bar */}
          <form onSubmit={handleSearch} className="hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t('platform.search.placeholder', 'Search fans, content...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64 bg-muted/50"
              />
            </div>
          </form>
        </div>

        {/* Center - Logo (on mobile) */}
        <div className="md:hidden">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img 
              src="/lovable-uploads/1bcee6fa-937a-4164-aecf-ef7d77f74bb8.png" 
              alt="Monytaiz Logo" 
              className="w-6 h-6 object-contain"
            />
            <span className="font-bold text-sm">Monytaiz</span>
          </Link>
        </div>

        {/* Right side - Quick actions and notifications */}
        <div className="flex items-center gap-2">
          {/* Quick action buttons */}
          {quickActions.map((action) => (
            <div key={action.href} className="relative">
              <Button
                variant={action.variant}
                size="sm"
                asChild
                className={action.className}
              >
                <Link to={action.href} className="flex items-center gap-2">
                  <action.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{action.label}</span>
                </Link>
              </Button>
              {action.badge && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {action.badge}
                </Badge>
              )}
            </div>
          ))}

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-xs"
            >
              2
            </Badge>
          </Button>
        </div>
      </div>
    </header>
  );
};