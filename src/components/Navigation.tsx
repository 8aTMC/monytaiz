import { useState, useEffect } from 'react';
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
  LogOut 
} from 'lucide-react';

export const Navigation = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

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
    <nav className="bg-card border-r border-border h-full w-64 flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold text-foreground">Fan Platform</h1>
      </div>
      
      <div className="flex-1 px-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                to={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-smooth"
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center">
            <UserIcon className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {user.email}
            </p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleSignOut}
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          {t('platform.auth.signOut')}
        </Button>
      </div>
    </nav>
  );
};