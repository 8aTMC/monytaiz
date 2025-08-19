import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navigation, useSidebar } from '@/components/Navigation';
import { User, Session } from '@supabase/supabase-js';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Grid, 
  Heart, 
  UserCheck, 
  ThumbsUp, 
  Star, 
  Users, 
  Edit3,
  GripVertical
} from 'lucide-react';

interface CategoryItem {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  color: string;
  count: number;
  query: string;
}

const FansCategories = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const { isCollapsed, isNarrowScreen } = useSidebar();

  const categories: CategoryItem[] = [
    {
      id: 'husband',
      name: 'Husbands',
      icon: Heart,
      color: 'text-red-500',
      count: categoryCounts.husband || 0,
      query: '?category=husband'
    },
    {
      id: 'boyfriend',
      name: 'Boyfriends',
      icon: UserCheck,
      color: 'text-pink-500',
      count: categoryCounts.boyfriend || 0,
      query: '?category=boyfriend'
    },
    {
      id: 'supporter',
      name: 'Supporters',
      icon: Star,
      color: 'text-yellow-500',
      count: categoryCounts.supporter || 0,
      query: '?category=supporter'
    },
    {
      id: 'friend',
      name: 'Friends',
      icon: ThumbsUp,
      color: 'text-green-500',
      count: categoryCounts.friend || 0,
      query: '?category=friend'
    },
    {
      id: 'fan',
      name: 'General Fans',
      icon: Users,
      color: 'text-blue-500',
      count: categoryCounts.fan || 0,
      query: '?category=fan'
    }
  ];

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session?.user) {
          navigate('/');
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session?.user) {
        navigate('/');
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const fetchCategoryCounts = async () => {
      try {
        // Get all fan user IDs
        const { data: fanRoles, error: roleError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'fan');

        if (roleError || !fanRoles) {
          console.error('Error fetching fan roles:', roleError);
          return;
        }

        const fanUserIds = fanRoles.map(role => role.user_id);

        // Get category counts
        const counts: Record<string, number> = {};
        
        for (const category of ['husband', 'boyfriend', 'supporter', 'friend', 'fan'] as const) {
          const { count, error } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .in('id', fanUserIds)
            .eq('fan_category', category);

          if (!error) {
            counts[category] = count || 0;
          }
        }

        setCategoryCounts(counts);
      } catch (error) {
        console.error('Error fetching category counts:', error);
      }
    };

    if (user) {
      fetchCategoryCounts();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className={`min-h-screen bg-background ${isNarrowScreen && !isCollapsed ? 'min-w-[calc(100vw+13rem)]' : ''}`}>
      <Navigation />
      
      <main className={`transition-all duration-300 p-8 ${isCollapsed ? 'ml-16' : 'ml-52'} overflow-x-auto`}>
        <div className="max-w-7xl mx-auto min-w-[700px]">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-2">
              <div className="flex items-center gap-3">
                <Grid className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold text-foreground">Fan Categories</h1>
              </div>
              <Button
                variant={isEditMode ? "default" : "outline"}
                onClick={() => setIsEditMode(!isEditMode)}
                className="gap-2"
              >
                <Edit3 className="h-4 w-4" />
                {isEditMode ? 'Done Editing' : 'Edit Order'}
              </Button>
            </div>
            <p className="text-muted-foreground">
              Manage and organize your fan categories. {isEditMode ? 'Drag and drop to reorder categories.' : 'Click on a category to view fans in that group.'}
            </p>
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category) => {
              const IconComponent = category.icon;
              return (
                <Card 
                  key={category.id} 
                  className={`bg-gradient-card border-border shadow-card transition-all ${
                    isEditMode 
                      ? 'cursor-move hover:shadow-lg' 
                      : 'cursor-pointer hover:shadow-lg hover:scale-105'
                  }`}
                >
                  {isEditMode ? (
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                        <IconComponent className={`h-8 w-8 ${category.color}`} />
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-foreground">{category.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {category.count} {category.count === 1 ? 'fan' : 'fans'}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-center">
                        <Badge variant="secondary" className="text-lg px-4 py-2">
                          {category.count}
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <Link to={`/fans${category.query}`}>
                      <CardHeader className="text-center pb-4">
                        <div className="flex justify-center mb-4">
                          <div className="p-4 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                            <IconComponent className={`h-12 w-12 ${category.color}`} />
                          </div>
                        </div>
                        <CardTitle className="text-foreground text-xl">{category.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="text-center">
                        <div className="mb-4">
                          <Badge variant="secondary" className="text-lg px-4 py-2">
                            {category.count} {category.count === 1 ? 'fan' : 'fans'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Click to view all {category.name.toLowerCase()}
                        </p>
                      </CardContent>
                    </Link>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Edit Mode Instructions */}
          {isEditMode && (
            <div className="mt-8 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Edit3 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Edit Mode Active</h4>
                  <p className="text-sm text-muted-foreground">
                    Drag and drop categories to change their order. This will affect how fans are displayed in the "All Fans" section, 
                    showing users from higher-priority categories first.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default FansCategories;