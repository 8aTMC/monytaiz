import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navigation, useSidebar } from '@/components/Navigation';
import { User, Session } from '@supabase/supabase-js';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Grid, Image, Video, FileAudio, FileText, Calendar } from 'lucide-react';

interface ContentFile {
  id: string;
  title: string;
  description: string | null;
  content_type: 'image' | 'video' | 'audio' | 'document' | 'pack';
  thumbnail_url: string | null;
  file_path: string;
  base_price: number;
  is_active: boolean;
  is_pack: boolean;
  created_at: string;
  creator_id: string;
  profiles: {
    display_name: string | null;
    username: string | null;
  } | null;
}

const ContentLibrary = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<ContentFile[]>([]);
  const [loadingContent, setLoadingContent] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedCategory, setSelectedCategory] = useState('all-media');
  const { isCollapsed } = useSidebar();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session?.user) {
          navigate('/');
        } else {
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session?.user) {
        navigate('/');
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        let query = supabase
          .from('content_files')
          .select(`
            *,
            profiles:creator_id (
              display_name,
              username
            )
          `)
          .eq('is_active', true);

        // Apply content type filter
        if (selectedFilter !== 'all') {
          query = query.eq('content_type', selectedFilter as 'image' | 'video' | 'audio' | 'document' | 'pack');
        }

        // Apply search filter
        if (searchQuery) {
          query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
        }

        // Apply sorting
        if (sortBy === 'newest') {
          query = query.order('created_at', { ascending: false });
        } else if (sortBy === 'oldest') {
          query = query.order('created_at', { ascending: true });
        } else if (sortBy === 'price_high') {
          query = query.order('base_price', { ascending: false });
        } else if (sortBy === 'price_low') {
          query = query.order('base_price', { ascending: true });
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching content:', error);
        } else {
          setContent(data || []);
        }
      } catch (error) {
        console.error('Error fetching content:', error);
      } finally {
        setLoadingContent(false);
      }
    };

    if (user) {
      fetchContent();
    }
  }, [user, selectedFilter, searchQuery, sortBy]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="animate-pulse">
          {/* Skeleton Navigation */}
          <div className="fixed left-0 top-0 h-full w-64 bg-muted/20 border-r"></div>
          
          {/* Skeleton Layout */}
          <div className="ml-64 flex h-screen">
            {/* Categories Sidebar Skeleton */}
            <div className="w-80 bg-muted/10 border-r p-6">
              <div className="h-6 w-32 bg-muted/30 rounded mb-4"></div>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 bg-muted/20 rounded"></div>
                ))}
              </div>
            </div>
            
            {/* Main Content Skeleton */}
            <div className="flex-1 flex flex-col">
              {/* Header Skeleton */}
              <div className="bg-muted/10 border-b p-6">
                <div className="h-8 w-48 bg-muted/30 rounded mb-4"></div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-8 w-20 bg-muted/20 rounded"></div>
                  ))}
                </div>
              </div>
              
              {/* Content Grid Skeleton */}
              <div className="flex-1 p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="aspect-square bg-muted/20 rounded-lg"></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const categories = [
    { id: 'all-media', label: 'All Media', icon: Grid, count: content.length },
    { id: 'images', label: 'Photos', icon: Image, count: content.filter(c => c.content_type === 'image').length },
    { id: 'videos', label: 'Videos', icon: Video, count: content.filter(c => c.content_type === 'video').length },
    { id: 'audio', label: 'Audio', icon: FileAudio, count: content.filter(c => c.content_type === 'audio').length },
    { id: 'documents', label: 'Documents', icon: FileText, count: content.filter(c => c.content_type === 'document').length },
  ];

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      case 'audio': return <FileAudio className="h-4 w-4" />;
      case 'document': return <FileText className="h-4 w-4" />;
      default: return <Grid className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className={`transition-all duration-300 ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
        <div className="flex h-screen">
          {/* Categories Sidebar */}
          <div className="w-80 bg-card border-r border-border p-6 overflow-y-auto">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Content Library</h2>
              
              {/* Categories */}
              <div className="space-y-2">
                {categories.map((category) => {
                  const IconComponent = category.icon;
                  return (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id ? "default" : "ghost"}
                      className="w-full justify-between text-left"
                      onClick={() => {
                        setSelectedCategory(category.id);
                        if (category.id === 'all-media') {
                          setSelectedFilter('all');
                        } else if (category.id === 'images') {
                          setSelectedFilter('image');
                        } else if (category.id === 'videos') {
                          setSelectedFilter('video');
                        } else if (category.id === 'audio') {
                          setSelectedFilter('audio');
                        } else if (category.id === 'documents') {
                          setSelectedFilter('document');
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <IconComponent className="h-4 w-4" />
                        <span>{category.label}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {category.count}
                      </Badge>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col">
            {/* Header with Search and Filters */}
            <div className="bg-card border-b border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold text-foreground">
                  {categories.find(c => c.id === selectedCategory)?.label || 'All Media'}
                </h1>
                
                <div className="flex items-center gap-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search content..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>

                  {/* Sort By */}
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                      <SelectItem value="price_high">Price: High to Low</SelectItem>
                      <SelectItem value="price_low">Price: Low to High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-2">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'image', label: 'Photo' },
                  { id: 'video', label: 'Video' },
                  { id: 'audio', label: 'Audio' },
                  { id: 'document', label: 'Documents' }
                ].map((filter) => (
                  <Button
                    key={filter.id}
                    variant={selectedFilter === filter.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedFilter(filter.id)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Content Grid */}
            <div className="flex-1 p-6 overflow-y-auto">
              {loadingContent ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-pulse">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="aspect-square bg-muted/20 rounded-lg"></div>
                  ))}
                </div>
              ) : content.length === 0 ? (
                <div className="text-center py-12">
                  <Grid className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No content found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {content.map((item) => (
                    <Card key={item.id} className="bg-gradient-card border-border shadow-card hover:shadow-lg transition-shadow cursor-pointer">
                      <CardContent className="p-0">
                        {/* Thumbnail */}
                        <div className="aspect-square bg-muted rounded-t-lg flex items-center justify-center relative">
                          {item.thumbnail_url ? (
                            <img
                              src={item.thumbnail_url}
                              alt={item.title}
                              className="w-full h-full object-cover rounded-t-lg"
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              {getContentTypeIcon(item.content_type)}
                              <span className="text-xs text-muted-foreground capitalize">
                                {item.content_type}
                              </span>
                            </div>
                          )}
                          
                          {/* Content Type Badge */}
                          <Badge 
                            variant="secondary" 
                            className="absolute top-2 left-2 text-xs"
                          >
                            {item.content_type}
                          </Badge>
                          
                          {/* Pack Badge */}
                          {item.is_pack && (
                            <Badge 
                              variant="default" 
                              className="absolute top-2 right-2 text-xs"
                            >
                              Pack
                            </Badge>
                          )}
                        </div>
                        
                        {/* Content Info */}
                        <div className="p-3">
                          <h3 className="font-medium text-foreground text-sm truncate mb-1">
                            {item.title}
                          </h3>
                          {item.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                              {item.description}
                            </p>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-primary">
                              ${item.base_price}
                            </span>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {new Date(item.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          {item.profiles && (
                            <p className="text-xs text-muted-foreground mt-1">
                              by {item.profiles.display_name || item.profiles.username}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentLibrary;