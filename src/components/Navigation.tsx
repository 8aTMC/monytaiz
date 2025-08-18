import { useState, useEffect, createContext, useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/components/AuthProvider';

interface UserProfile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_verified: boolean;
}
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
  ChevronRight,
  FileText,
  Receipt,
  Heart,
  UserCheck,
  ThumbsUp,
  Star,
  Grid,
  List
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
  const location = useLocation();
  const { t, loading: translationLoading } = useTranslation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [isContentOpen, setIsContentOpen] = useState(false);
  const [isFansOpen, setIsFansOpen] = useState(false);
  const { isCollapsed, setIsCollapsed } = useSidebar();

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, is_verified')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUserProfile(user.id);
    } else {
      setUserProfile(null);
    }
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (!user) return null;

  // Helper function to check if a route is active
  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    // Exact match for other routes
    return location.pathname === href;
  };

  // Helper function to check if fans section is active
  const isFansActive = () => {
    return location.pathname.startsWith('/fans');
  };

  // Helper function to check if content section is active
  const isContentActive = () => {
    return location.pathname === '/library' || location.pathname === '/upload';
  };

  // Helper function to check if management section is active
  const isManagementActive = () => {
    return location.pathname.startsWith('/management');
  };

  const navItems = [
    { icon: Home, label: t('platform.nav.dashboard', 'Dashboard'), href: '/dashboard' },
    { icon: MessageSquare, label: t('platform.nav.messages', 'Messages'), href: '/messages' },
    { icon: BarChart3, label: t('platform.nav.analytics', 'Analytics'), href: '/analytics' },
  ];


  return (
    <nav className={`fixed left-0 top-0 bg-card border-r border-border h-screen flex flex-col z-40 transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-52'
    }`}>
      {isCollapsed ? (
        /* Collapsed state - logo centered with arrow on right edge */
        <>
          <div className="p-4 flex items-center justify-center border-b border-border">
            <img 
              src="/lovable-uploads/1bcee6fa-937a-4164-aecf-ef7d77f74bb8.png" 
              alt="Monytaiz Logo" 
              className="w-8 h-8 object-contain"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute top-6 -right-2.5 text-muted-foreground hover:text-foreground bg-card border border-border rounded-full w-5 h-5 z-50"
          >
            <ChevronRight className="h-2.5 w-2.5" />
          </Button>
        </>
      ) : (
        /* Extended state - logo left, name center, close arrow on edge */
        <>
          <div className="p-4 flex items-center justify-between border-b border-border">
            <img 
              src="/lovable-uploads/1bcee6fa-937a-4164-aecf-ef7d77f74bb8.png" 
              alt="Monytaiz Logo" 
              className="w-8 h-8 object-contain flex-shrink-0"
            />
            <h1 className="text-lg font-bold text-foreground">Monytaiz</h1>
            <div className="w-8"></div> {/* Spacer for balance */}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute top-6 -right-2.5 text-muted-foreground hover:text-foreground bg-card border border-border rounded-full w-5 h-5 z-50"
          >
            <ChevronLeft className="h-2.5 w-2.5" />
          </Button>
        </>
      )}
      
      <div className="flex-1 px-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-smooth ${
                    active 
                      ? 'bg-primary/10 text-primary border border-primary/20' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
          
          {/* Fans Menu */}
          <li>
            {isCollapsed ? (
              <Link
                to="/fans"
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-smooth ${
                  isFansActive() 
                    ? 'bg-primary/10 text-primary border border-primary/20' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
                title="Fans"
              >
                <Users className="h-5 w-5 flex-shrink-0" />
              </Link>
            ) : (
              <Collapsible open={isFansOpen} onOpenChange={setIsFansOpen}>
                <CollapsibleTrigger className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-smooth ${
                  isFansActive() 
                    ? 'bg-primary/10 text-primary border border-primary/20' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}>
                  <div className="flex items-center gap-3 flex-1">
                    <Users className="h-5 w-5" />
                    <span>Fans</span>
                  </div>
                  <div className="ml-auto">
                    {isFansOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="mt-1 space-y-1">
                  <Link
                    to="/fans"
                    className={`flex items-center gap-3 px-6 py-2 ml-2 rounded-lg text-sm transition-smooth ${
                      location.pathname === '/fans' && !location.search
                        ? 'bg-primary/5 text-primary border border-primary/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    <span>All Fans</span>
                  </Link>
                  <Link
                    to="/fans/categories"
                    className={`flex items-center gap-3 px-6 py-2 ml-2 rounded-lg text-sm transition-smooth ${
                      location.pathname === '/fans/categories'
                        ? 'bg-primary/5 text-primary border border-primary/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    }`}
                  >
                    <Grid className="h-4 w-4" />
                    <span>Categories</span>
                  </Link>
                  <Link
                    to="/fans/lists"
                    className={`flex items-center gap-3 px-6 py-2 ml-2 rounded-lg text-sm transition-smooth ${
                      location.pathname === '/fans/lists'
                        ? 'bg-primary/5 text-primary border border-primary/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    }`}
                  >
                    <List className="h-4 w-4" />
                    <span>Lists</span>
                  </Link>
                </CollapsibleContent>
              </Collapsible>
            )}
          </li>
          
          {/* Content Menu */}
          <li>
            {isCollapsed ? (
              <Link
                to="/library"
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-smooth ${
                  isContentActive() 
                    ? 'bg-primary/10 text-primary border border-primary/20' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
                title="Content"
              >
                <FileText className="h-5 w-5 flex-shrink-0" />
              </Link>
            ) : (
              <Collapsible open={isContentOpen} onOpenChange={setIsContentOpen}>
                <CollapsibleTrigger className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-smooth ${
                  isContentActive() 
                    ? 'bg-primary/10 text-primary border border-primary/20' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}>
                  <div className="flex items-center gap-3 flex-1">
                    <FileText className="h-5 w-5" />
                    <span>Content</span>
                  </div>
                  <div className="ml-auto">
                    {isContentOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="mt-1 space-y-1">
                  <Link
                    to="/library"
                    className={`flex items-center gap-3 px-6 py-2 ml-2 rounded-lg text-sm transition-smooth ${
                      location.pathname === '/library'
                        ? 'bg-primary/5 text-primary border border-primary/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    }`}
                  >
                    <Library className="h-4 w-4" />
                    <span>Library</span>
                  </Link>
                  <Link
                    to="/upload"
                    className={`flex items-center gap-3 px-6 py-2 ml-2 rounded-lg text-sm transition-smooth ${
                      location.pathname === '/upload'
                        ? 'bg-primary/5 text-primary border border-primary/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    }`}
                  >
                    <Upload className="h-4 w-4" />
                    <span>Upload</span>
                  </Link>
                </CollapsibleContent>
              </Collapsible>
            )}
          </li>
          
          {/* Management Menu */}
          <li>
            {isCollapsed ? (
              <Link
                to="/management/users"
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-smooth ${
                  isManagementActive() 
                    ? 'bg-primary/10 text-primary border border-primary/20' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
                title="Management"
              >
                <UserIcon className="h-5 w-5 flex-shrink-0" />
              </Link>
            ) : (
              <Collapsible open={isManagementOpen} onOpenChange={setIsManagementOpen}>
                <CollapsibleTrigger className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-smooth ${
                  isManagementActive() 
                    ? 'bg-primary/10 text-primary border border-primary/20' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}>
                  <div className="flex items-center gap-3 flex-1">
                    <UserIcon className="h-5 w-5" />
                    <span>Management</span>
                  </div>
                  <div className="ml-auto">
                    {isManagementOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="mt-1 space-y-1">
                  <Link
                    to="/management/users"
                    className={`flex items-center gap-3 px-6 py-2 ml-2 rounded-lg text-sm transition-smooth ${
                      location.pathname === '/management/users'
                        ? 'bg-primary/5 text-primary border border-primary/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    <span>Users</span>
                  </Link>
                  <Link
                    to="/management/pending-deletions"
                    className={`flex items-center gap-3 px-6 py-2 ml-2 rounded-lg text-sm transition-smooth ${
                      location.pathname === '/management/pending-deletions'
                        ? 'bg-primary/5 text-primary border border-primary/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    }`}
                  >
                    <UserIcon className="h-4 w-4" />
                    <span>Pending Deletions</span>
                  </Link>
                </CollapsibleContent>
              </Collapsible>
            )}
          </li>
        </ul>
      </div>
      
      <div className="p-4 border-t border-border">
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              className={`w-full justify-start gap-3 hover:bg-secondary/50 transition-smooth p-3 ${
                isCollapsed ? 'justify-center' : ''
              }`}
            >
              <div className="relative">
                {userProfile?.avatar_url ? (
                  <img
                    src={userProfile.avatar_url}
                    alt="Profile"
                    className="h-10 w-10 rounded-full object-cover ring-2 ring-primary/20"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary flex items-center justify-center ring-2 ring-primary/20 font-bold">
                    {(() => {
                      const name = userProfile?.display_name || userProfile?.username || 'User';
                      const words = name.trim().split(/\s+/);
                      if (words.length >= 2) {
                        return (words[0][0] + words[1][0]).toUpperCase();
                      } else {
                        return name.slice(0, 2).toUpperCase();
                      }
                    })()}
                  </div>
                )}
                {userProfile?.is_verified && (
                  <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-card flex items-center justify-center">
                    <svg className="h-2 w-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {userProfile?.display_name || userProfile?.username || 'Anonymous'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </div>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" side="right" align="end">
            <div className="px-3 py-2 border-b border-border mb-2">
              <p className="text-sm font-medium text-foreground">
                {userProfile?.display_name || userProfile?.username || 'Anonymous'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email}
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/profile')}
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-accent mb-1"
            >
              <UserIcon className="h-4 w-4" />
              {t('platform.account.myAccount', 'My Account')}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSignOut}
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              {t('platform.auth.signOut', 'Sign Out')}
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    </nav>
  );
};