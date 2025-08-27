// Navigation component with collapsible sidebar functionality
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
  Receipt,
  Heart,
  UserCheck,
  ThumbsUp,
  Star,
  Grid,
  List,
  Settings,
  Brain,
  Tags
} from 'lucide-react';
import { ContentIcon } from './icons/ContentIcon';
import { CreatorProfileDialog } from '@/components/CreatorProfileDialog';
import { TagManagementDialog } from '@/components/TagManagementDialog';
// Force hot reload to fix cache issue
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { SettingsDialog } from '@/components/SettingsDialog';

// Create a context for sidebar state
const SidebarContext = createContext<{
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isNarrowScreen: boolean;
}>({
  isCollapsed: false,
  setIsCollapsed: () => {},
  isNarrowScreen: false,
});

export const useSidebar = () => useContext(SidebarContext);

export const SidebarProvider = ({ children }: { children: React.ReactNode }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [userCollapsed, setUserCollapsed] = useState(false);
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);
  const [wasNarrowScreen, setWasNarrowScreen] = useState(false);

  // Auto-collapse on narrow screens
  useEffect(() => {
    const handleResize = () => {
      const isNarrow = window.innerWidth < 1024; // lg breakpoint
      const wasNarrow = wasNarrowScreen;
      
      setIsNarrowScreen(isNarrow);
      setWasNarrowScreen(isNarrow);
      
      // Only auto-collapse when transitioning from wide to narrow
      if (isNarrow && !wasNarrow) {
        setIsCollapsed(true);
        setUserCollapsed(true);
      } else if (!isNarrow && wasNarrow && !userCollapsed) {
        // Auto-expand when transitioning from narrow to wide (if user didn't manually collapse)
        setIsCollapsed(false);
      }
    };

    // Check on mount
    handleResize();
    
    // Listen for resize
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [wasNarrowScreen, userCollapsed]);

  const handleSetCollapsed = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    // On narrow screens, don't set userCollapsed to false when manually opening
    // This prevents the auto-collapse logic from immediately closing it
    if (isNarrowScreen && !collapsed) {
      // Keep userCollapsed as true so auto-collapse doesn't interfere
      return;
    }
    setUserCollapsed(collapsed);
  };

  // Esc key to close sidebar on narrow screens
  useEffect(() => {
    if (!(isNarrowScreen && !isCollapsed)) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSetCollapsed(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isNarrowScreen, isCollapsed]);

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed: handleSetCollapsed, isNarrowScreen }}>
      <div className="flex min-h-screen w-full">
        {/* Optional: visual dim with no pointer capture */}
        {isNarrowScreen && !isCollapsed && (
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.20)', pointerEvents: 'none' }}
          />
        )}

        {/* Click-capture strip (does NOT cover content). 
           It sits at the sidebar's right edge; clicking it collapses the sidebar. */}
        {isNarrowScreen && !isCollapsed && (
          <button
            aria-label="Close sidebar"
            onClick={() => handleSetCollapsed(true)}
            className="fixed z-50 top-[var(--header-h)] bottom-0"
            style={{
              left: 'var(--sidebar-w)',   // exactly where main area starts
              width: '24px',              // small strip; adjust as you like
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          />
        )}

        {children}
      </div>
    </SidebarContext.Provider>
  );
};

export const Navigation = () => {
  const location = useLocation();
  const { t, loading: translationLoading } = useTranslation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [isFan, setIsFan] = useState(false);
  const [openSection, setOpenSection] = useState<'fans' | 'content' | 'management' | null>(null);
  const { isCollapsed, setIsCollapsed, isNarrowScreen = false } = useSidebar();

  // Determine which section should be open based on current route
  const getCurrentSection = (): 'fans' | 'content' | 'management' | null => {
    if (location.pathname.startsWith('/fans')) return 'fans';
    if (location.pathname === '/library' || location.pathname === '/upload') return 'content';
    if (location.pathname.startsWith('/management')) return 'management';
    return null;
  };

  // Update open section when route changes
  useEffect(() => {
    const currentSection = getCurrentSection();
    if (currentSection) {
      setOpenSection(currentSection);
    }
  }, [location.pathname]);

  // Handle section toggle with accordion behavior
  const handleSectionToggle = (section: 'fans' | 'content' | 'management') => {
    setOpenSection(openSection === section ? null : section);
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, is_verified')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUserProfile(data);

      // Fetch user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError) throw rolesError;
      
      const roles = rolesData?.map(r => r.role) || [];
      setUserRoles(roles);
      
      // Check if user is a fan (has only fan role)
      setIsFan(roles.length === 1 && roles.includes('fan'));
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  useEffect(() => {
    if (user?.id && (!userProfile || userProfile.id !== user.id)) {
      fetchUserProfile(user.id);
    } else if (!user) {
      setUserProfile(null);
      setUserRoles([]);
      setIsFan(false);
    }
  }, [user?.id]);

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

  // Helper function to check if a section is active
  const isSectionActive = (section: 'fans' | 'content' | 'management') => {
    switch (section) {
      case 'fans':
        return location.pathname.startsWith('/fans');
      case 'content':
        return location.pathname === '/library' || location.pathname === '/upload';
      case 'management':
        return location.pathname.startsWith('/management');
      default:
        return false;
    }
  };

  // Different nav items for fans vs management users
  const fanNavItems = [
    { icon: Home, label: 'Home', href: '/dashboard' },
    { icon: MessageSquare, label: 'Messages', href: '/messages' },
  ];

  const managementNavItems = [
    { icon: Home, label: t('platform.nav.dashboard', 'Dashboard'), href: '/dashboard' },
    { icon: MessageSquare, label: t('platform.nav.messages', 'Messages'), href: '/messages' },
    { icon: BarChart3, label: t('platform.nav.analytics', 'Analytics'), href: '/analytics' },
  ];

  const navItems = isFan ? fanNavItems : managementNavItems;


  return (
    <>
      <nav 
        className={`fixed left-0 top-0 ${isNarrowScreen && !isCollapsed ? 'z-50' : 'z-[60]'} bg-card border-r border-border flex flex-col transition-all duration-300 ${
          isCollapsed ? 'w-16' : 'w-64'
        } ${isNarrowScreen && !isCollapsed ? 'shadow-2xl' : ''} h-screen`}
        data-auto-collapse
        {...(isNarrowScreen && !isCollapsed ? { 'data-manually-opened': 'true' } : {})}
      >
      {isCollapsed ? (
        /* Collapsed state - logo centered with arrow on right edge */
        <>
          <div className="h-[73px] flex items-center justify-center border-b border-border">
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
            data-collapse-trigger
          >
            <ChevronRight className="h-2.5 w-2.5" />
          </Button>
        </>
      ) : (
        /* Extended state - logo left, name center, close arrow on edge */
        <>
          <div className="h-[73px] flex items-center justify-between px-4 border-b border-border">
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
            data-collapse-trigger
          >
            <ChevronLeft className="h-2.5 w-2.5" />
          </Button>
        </>
      )}
      
      <div className="flex-1 px-4 pt-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={`flex items-center rounded-lg transition-smooth ${
                    isCollapsed ? 'justify-center px-3 py-2' : 'gap-3 px-3 py-2'
                  } ${
                    active 
                      ? isCollapsed 
                        ? 'bg-primary/20 text-primary' 
                        : 'bg-primary/10 text-primary border border-primary/20'
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
          
          {/* AI Management - standalone button for non-fan users */}
          {!isFan && (
            <li>
              <Link
                to="/ai-management"
                className={`flex items-center rounded-lg transition-smooth ${
                  isCollapsed ? 'justify-center px-3 py-2' : 'gap-3 px-3 py-2'
                } ${
                  isActive('/ai-management') 
                    ? isCollapsed 
                      ? 'bg-primary/20 text-primary' 
                      : 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
                title={isCollapsed ? 'AI Management' : undefined}
              >
                <Brain className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && <span>AI Management</span>}
              </Link>
            </li>
          )}
          
          {/* Show expanded menus only for management users */}
          {!isFan && (
            <>
              {/* Fans Menu */}
              <li>
            {isCollapsed ? (
              <HoverCard openDelay={150} closeDelay={150}>
                <HoverCardTrigger asChild>
                  <Link
                    to="/fans"
                     className={`flex items-center rounded-lg transition-smooth ${
                       isCollapsed ? 'justify-center px-3 py-2' : 'gap-3 px-3 py-2'
                     } ${
                       isSectionActive('fans') 
                         ? isCollapsed 
                           ? 'bg-primary/20 text-primary' 
                           : 'bg-primary/10 text-primary border border-primary/20'
                         : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                     }`}
                    title="Fans"
                  >
                    <Users className="h-5 w-5 flex-shrink-0" />
                  </Link>
                </HoverCardTrigger>
                <HoverCardContent side="right" className="w-48 p-2 ml-2" sideOffset={8}>
                  <div className="space-y-1">
                    <div className="px-2 py-1 text-sm font-medium text-foreground border-b border-border mb-2">
                      Fans
                    </div>
                    <Link
                      to="/fans"
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-smooth ${
                        location.pathname === '/fans' && !location.search
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                      }`}
                    >
                      <Users className="h-4 w-4" />
                      <span>All Fans</span>
                    </Link>
                    <Link
                      to="/fans/categories"
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-smooth ${
                        location.pathname === '/fans/categories'
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                      }`}
                    >
                      <Grid className="h-4 w-4" />
                      <span>Categories</span>
                    </Link>
                    <Link
                      to="/fans/lists"
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-smooth ${
                        location.pathname === '/fans/lists'
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                      }`}
                    >
                      <List className="h-4 w-4" />
                      <span>Lists</span>
                    </Link>
                  </div>
                </HoverCardContent>
              </HoverCard>
            ) : (
              <Collapsible open={openSection === 'fans'} onOpenChange={() => handleSectionToggle('fans')}>
                <CollapsibleTrigger className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-smooth ${
                  isSectionActive('fans') 
                    ? 'bg-primary/10 text-primary border border-primary/20' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}>
                  <div className="flex items-center gap-3 flex-1">
                    <Users className="h-5 w-5" />
                    <span>Fans</span>
                  </div>
                  <div className="ml-auto pr-1">
                    {openSection === 'fans' ? (
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
                        ? 'bg-primary/3 text-primary/90'
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
                        ? 'bg-primary/3 text-primary/90'
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
                        ? 'bg-primary/3 text-primary/90'
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
              <HoverCard openDelay={150} closeDelay={150}>
                <HoverCardTrigger asChild>
                  <Link
                    to="/library"
                     className={`flex items-center rounded-lg transition-smooth ${
                       isCollapsed ? 'justify-center px-3 py-2' : 'gap-3 px-3 py-2'
                     } ${
                       isSectionActive('content') 
                         ? isCollapsed 
                           ? 'bg-primary/20 text-primary' 
                           : 'bg-primary/10 text-primary border border-primary/20'
                         : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                     }`}
                    title="Content"
                  >
                    <ContentIcon className="h-5 w-5 flex-shrink-0" />
                  </Link>
                </HoverCardTrigger>
                <HoverCardContent side="right" className="w-48 p-2 ml-2" sideOffset={8}>
                  <div className="space-y-1">
                    <div className="px-2 py-1 text-sm font-medium text-foreground border-b border-border mb-2">
                      Content
                    </div>
                     <Link
                       to="/library"
                       className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 hover:scale-[1.02] ${
                         location.pathname === '/library'
                           ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
                           : 'text-muted-foreground hover:text-foreground hover:bg-accent/80 hover:shadow-sm'
                       }`}
                     >
                       <Library className={`h-4 w-4 transition-transform duration-200 ${location.pathname === '/library' ? '' : 'group-hover:scale-110'}`} />
                       <span className="font-medium">Library</span>
                     </Link>
                     <Link
                       to="/upload"
                       className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 hover:scale-[1.02] ${
                         location.pathname === '/upload'
                           ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
                           : 'text-muted-foreground hover:text-foreground hover:bg-accent/80 hover:shadow-sm'
                       }`}
                     >
                      <Upload className={`h-4 w-4 transition-transform duration-200 ${location.pathname === '/upload' ? '' : 'group-hover:scale-110'}`} />
                      <span className="font-medium">Upload</span>
                    </Link>
                    <TagManagementDialog>
                      <button className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 hover:scale-[1.02] w-full text-left text-muted-foreground hover:text-foreground hover:bg-accent/80 hover:shadow-sm">
                        <Tags className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                        <span className="font-medium">Tags</span>
                      </button>
                    </TagManagementDialog>
                 </div>
               </HoverCardContent>
              </HoverCard>
            ) : (
              <Collapsible open={openSection === 'content'} onOpenChange={() => handleSectionToggle('content')}>
                <CollapsibleTrigger className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-smooth ${
                  isSectionActive('content') 
                    ? 'bg-primary/10 text-primary border border-primary/20' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}>
                  <div className="flex items-center gap-3 flex-1">
                    <ContentIcon className="h-5 w-5" />
                    <span>Content</span>
                  </div>
                  <div className="ml-auto pr-1">
                    {openSection === 'content' ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </CollapsibleTrigger>
                
                 <CollapsibleContent className="mt-1 space-y-1">
                   <Link
                     to="/library"
                     className={`group flex items-center gap-3 px-6 py-2.5 ml-2 rounded-lg text-sm transition-all duration-200 hover:scale-[1.02] ${
                       location.pathname === '/library'
                         ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
                         : 'text-muted-foreground hover:text-foreground hover:bg-accent/80 hover:shadow-sm'
                     }`}
                   >
                     <Library className={`h-4 w-4 transition-transform duration-200 ${location.pathname === '/library' ? '' : 'group-hover:scale-110'}`} />
                     <span className="font-medium">Library</span>
                   </Link>
                   <Link
                     to="/upload"
                     className={`group flex items-center gap-3 px-6 py-2.5 ml-2 rounded-lg text-sm transition-all duration-200 hover:scale-[1.02] ${
                       location.pathname === '/upload'
                         ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
                         : 'text-muted-foreground hover:text-foreground hover:bg-accent/80 hover:shadow-sm'
                     }`}
                    >
                      <Upload className={`h-4 w-4 transition-transform duration-200 ${location.pathname === '/upload' ? '' : 'group-hover:scale-110'}`} />
                      <span className="font-medium">Upload</span>
                    </Link>
                    <TagManagementDialog>
                      <button className="group flex items-center gap-3 px-6 py-2.5 ml-2 rounded-lg text-sm transition-all duration-200 hover:scale-[1.02] text-muted-foreground hover:text-foreground hover:bg-accent/80 hover:shadow-sm w-full text-left">
                        <Tags className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                        <span className="font-medium">Tags</span>
                      </button>
                    </TagManagementDialog>
                  </CollapsibleContent>
               </Collapsible>
            )}
          </li>
          
          {/* Management Menu */}
          <li>
            {isCollapsed ? (
              <HoverCard openDelay={150} closeDelay={150}>
                <HoverCardTrigger asChild>
                  <Link
                    to="/management/users"
                     className={`flex items-center rounded-lg transition-smooth ${
                       isCollapsed ? 'justify-center px-3 py-2' : 'gap-3 px-3 py-2'
                     } ${
                       isSectionActive('management') 
                         ? isCollapsed 
                           ? 'bg-primary/20 text-primary' 
                           : 'bg-primary/10 text-primary border border-primary/20'
                         : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                     }`}
                    title="Management"
                  >
                    <UserIcon className="h-5 w-5 flex-shrink-0" />
                  </Link>
                </HoverCardTrigger>
                 <HoverCardContent side="right" className="w-48 p-2 ml-2" sideOffset={8}>
                   <div className="space-y-1">
                     <div className="px-2 py-1 text-sm font-medium text-foreground border-b border-border mb-2">
                       Management
                     </div>
                     <CreatorProfileDialog>
                       <button className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-smooth w-full text-left text-muted-foreground hover:text-foreground hover:bg-secondary/50">
                         <UserIcon className="h-4 w-4" />
                         <span>Creator Profile</span>
                       </button>
                     </CreatorProfileDialog>
                     <Link
                       to="/management/users"
                       className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-smooth ${
                         location.pathname === '/management/users'
                           ? 'bg-primary/10 text-primary'
                           : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                       }`}
                     >
                       <Users className="h-4 w-4" />
                       <span>Users</span>
                     </Link>
                   </div>
                 </HoverCardContent>
              </HoverCard>
            ) : (
              <Collapsible open={openSection === 'management'} onOpenChange={() => handleSectionToggle('management')}>
                <CollapsibleTrigger className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-smooth ${
                  isSectionActive('management') 
                    ? 'bg-primary/10 text-primary border border-primary/20' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}>
                  <div className="flex items-center gap-3 flex-1">
                    <UserIcon className="h-5 w-5" />
                    <span>Management</span>
                  </div>
                  <div className="ml-auto pr-1">
                    {openSection === 'management' ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </CollapsibleTrigger>
                
                 <CollapsibleContent className="mt-1 space-y-1">
                   <CreatorProfileDialog>
                     <button className="flex items-center gap-3 px-6 py-2 ml-2 rounded-lg text-sm transition-smooth w-full text-left text-muted-foreground hover:text-foreground hover:bg-secondary/50">
                       <UserIcon className="h-4 w-4" />
                       <span>Creator Profile</span>
                     </button>
                   </CreatorProfileDialog>
                   <Link
                     to="/management/users"
                     className={`flex items-center gap-3 px-6 py-2 ml-2 rounded-lg text-sm transition-smooth ${
                       location.pathname === '/management/users'
                         ? 'bg-primary/3 text-primary/90'
                         : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                     }`}
                   >
                     <Users className="h-4 w-4" />
                     <span>Users</span>
                   </Link>
                 </CollapsibleContent>
              </Collapsible>
            )}
           </li>
            </>
          )}
        </ul>
      </div>
      
      <div className="p-4 border-t border-border">
        <Popover>
          <PopoverTrigger asChild>
             <Button 
               variant="ghost" 
               className={`w-full justify-start gap-4 hover:bg-secondary/50 transition-smooth p-2 ${
                 isCollapsed ? 'justify-center' : ''
               }`}
             >
               <div className="relative flex-shrink-0 -ml-1">
                 {userProfile?.avatar_url ? (
                   <img
                     src={userProfile.avatar_url}
                     alt="Profile"
                     className="h-9 w-9 rounded-full object-cover ring-2 ring-primary/20"
                   />
                 ) : (
                   <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary flex items-center justify-center ring-2 ring-primary/20 font-bold text-xs">
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
                   <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-green-500 rounded-full border-2 border-card flex items-center justify-center">
                     <svg className="h-1.5 w-1.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                       <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                     </svg>
                   </div>
                 )}
               </div>
               {!isCollapsed && (
                 <div className="flex-1 min-w-0 text-left">
                   <p className="text-sm font-semibold text-foreground truncate leading-tight">
                     {userProfile?.display_name || userProfile?.username || 'Anonymous'}
                   </p>
                   <p className="text-xs text-muted-foreground truncate leading-tight">
                     @{userProfile?.username || 'username'}
                   </p>
                 </div>
               )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2 z-[100] bg-background border border-border shadow-lg" side="right" align="end">
            <div className="px-3 py-2 border-b border-border mb-2">
              <p className="text-sm font-medium text-foreground">
                {userProfile?.display_name || userProfile?.username || 'Anonymous'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                @{userProfile?.username || 'username'}
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
            <SettingsDialog>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-accent mb-1"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </SettingsDialog>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSignOut}
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-destructive/10 hover:text-destructive mt-1"
            >
              <LogOut className="h-4 w-4" />
              {t('platform.auth.signOut', 'Sign Out')}
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    </nav>
  </>
  );
};