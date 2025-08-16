import { useState, useEffect, createContext, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { User, Session } from '@supabase/supabase-js';
import { 
  Home, 
  Search, 
  Library, 
  MessageSquare, 
  Upload, 
  BarChart3, 
  Users,
  User as UserIcon,
  LogOut,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Create a context for sidebar state
const SidebarContext = createContext<{
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}>({
  isCollapsed: false,
  setIsCollapsed: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

export const SidebarProvider = ({ children }: { children: React.ReactNode }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Navigation = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const { isCollapsed, setIsCollapsed } = useSidebar();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (!user) return null;

  const navItems = [
    { icon: Home, label: t('platform.nav.explore'), href: '/dashboard' },
    { icon: Library, label: t('platform.nav.library'), href: '/library' },
    { icon: MessageSquare, label: t('platform.nav.messages'), href: '/messages' },
    { icon: Users, label: 'All Fans', href: '/fans' },
    { icon: Upload, label: t('platform.nav.upload'), href: '/upload' },
    { icon: BarChart3, label: t('platform.nav.analytics'), href: '/analytics' },
  ];


  return (
    <nav className={`fixed left-0 top-0 bg-card border-r border-border h-screen flex flex-col z-40 transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
      <div className="p-6 flex items-center justify-between">
        {!isCollapsed && <h1 className="text-xl font-bold text-foreground">Fan Platform</h1>}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-muted-foreground hover:text-foreground"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
      
      <div className="flex-1 px-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                to={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-smooth"
                title={isCollapsed ? item.label : undefined}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            </li>
          ))}
          
          {/* Management Collapsible Menu */}
          {!isCollapsed && (
            <li>
              <Collapsible open={isManagementOpen} onOpenChange={setIsManagementOpen}>
                <CollapsibleTrigger className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-smooth">
                  <div className="flex items-center gap-3">
                    <UserIcon className="h-5 w-5" />
                    <span>Management</span>
                  </div>
                  {isManagementOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </CollapsibleTrigger>
                
                <CollapsibleContent className="mt-1 space-y-1">
                  <Link
                    to="/management/users"
                    className="flex items-center gap-3 px-6 py-2 ml-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-smooth"
                  >
                    <Users className="h-4 w-4" />
                    <span>Users</span>
                  </Link>
                </CollapsibleContent>
              </Collapsible>
            </li>
          )}
        </ul>
      </div>
      
      <div className="p-4 border-t border-border">
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              className={`w-full justify-start gap-3 text-muted-foreground hover:text-foreground ${
                isCollapsed ? 'px-2' : 'px-3'
              }`}
            >
              <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                <UserIcon className="h-4 w-4 text-primary-foreground" />
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-foreground truncate">
                    {user.email}
                  </p>
                </div>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" side="right" align="end">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSignOut}
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              {t('platform.auth.signOut')}
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    </nav>
  );
};