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
import { Search, Filter, Grid, Image, Video, FileAudio, FileText, Calendar, ArrowUpDown, BookOpen, Zap, MessageSquare, GripVertical } from 'lucide-react';
import { NewFolderDialog } from '@/components/NewFolderDialog';
import { ThemeToggle } from '@/components/ThemeToggle';

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
  const [selectedCategory, setSelectedCategory] = useState('all-files');
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  
  const [defaultCategories] = useState([
    { id: 'all-files', label: 'All Files', icon: Grid, description: 'All uploaded content', isDefault: true },
    { id: 'stories', label: 'Stories', icon: BookOpen, description: 'Content uploaded to stories', isDefault: true },
    { id: 'livestreams', label: 'LiveStreams', icon: Zap, description: 'Past live stream videos', isDefault: true },
    { id: 'messages', label: 'Messages', icon: MessageSquare, description: 'Content sent in messages', isDefault: true },
  ]);
  
  const [customFolders, setCustomFolders] = useState<Array<{
    id: string;
    label: string;
    icon: any;
    description: string;
    isDefault: false;
    count?: number;
  }>>([]);

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

        // Apply search filter with improved matching
        if (searchQuery) {
          const searchTerms = searchQuery.trim().split(/\s+/).map(term => term.toLowerCase());
          const searchConditions = searchTerms.map(term => 
            `title.ilike.%${term}%,description.ilike.%${term}%,tags.cs.{${term}}`
          ).join(',');
          query = query.or(searchConditions);
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

  // Fetch custom folders from database
  useEffect(() => {
    const fetchCustomFolders = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('file_folders')
          .select('*')
          .eq('creator_id', user.id)
          .order('name', { ascending: true });

        if (error) {
          console.error('Error fetching folders:', error);
        } else {
          const folders = data?.map(folder => ({
            id: folder.id,
            label: folder.name,
            icon: Grid,
            description: folder.description || 'Custom folder',
            isDefault: false as const,
            count: 0
          })) || [];
          setCustomFolders(folders);
        }
      } catch (error) {
        console.error('Error fetching folders:', error);
      }
    };

    fetchCustomFolders();
  }, [user]);

  // Sort custom folders based on sortOrder
  const sortedCustomFolders = sortOrder 
    ? [...customFolders].sort((a, b) => {
        if (sortOrder === 'asc') {
          return a.label.localeCompare(b.label);
        } else {
          return b.label.localeCompare(a.label);
        }
      })
    : customFolders;

  const handleCustomFolderDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleCustomFolderDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCustomFolderDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
    
    if (dragIndex === dropIndex) return;
    
    const newFolders = [...sortedCustomFolders];
    const draggedItem = newFolders[dragIndex];
    newFolders.splice(dragIndex, 1);
    newFolders.splice(dropIndex, 0, draggedItem);
    
    setCustomFolders(newFolders);
  };

  const handleSortFolders = () => {
    if (sortOrder === null) {
      setSortOrder('asc');
    } else if (sortOrder === 'asc') {
      setSortOrder('desc');
    } else {
      setSortOrder(null);
    }
  };

  const refreshCustomFolders = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('file_folders')
        .select('*')
        .eq('creator_id', user.id)
        .order('name', { ascending: true });
      if (!error && data) {
        const folders = data.map(folder => ({
          id: folder.id,
          label: folder.name,
          icon: Grid,
          description: folder.description || 'Custom folder',
          isDefault: false as const,
          count: 0
        }));
        setCustomFolders(folders);
      }
    } catch (error) {
      console.error('Error fetching folders:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="animate-pulse">
          {/* Skeleton Navigation */}
          <div className="fixed left-0 top-0 h-full w-64 bg-muted/20 border-r"></div>
          
          {/* Skeleton Layout */}
          <div className="ml-52 flex h-screen">
            {/* Categories Sidebar Skeleton */}
            <div className="w-96 bg-muted/10 border-r p-6">
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
      <ThemeToggle />
      
      <div className={`transition-all duration-300 ${isCollapsed ? 'ml-16' : 'ml-52'}`}>
        <div className="flex h-screen">
          {/* Categories Sidebar */}
          <div className="w-96 bg-card border-r border-border p-4 overflow-y-auto">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-foreground mb-3">Library</h2>
              <div className="flex items-center gap-1">
                <NewFolderDialog onFolderCreated={refreshCustomFolders} />
              </div>
            </div>
              
            {/* Default Categories */}
            <div className="space-y-1 mb-4">
              {defaultCategories.map((category) => {
                const IconComponent = category.icon;
                return (
                  <div key={category.id} className="relative">
                    <Button
                      variant={selectedCategory === category.id ? "default" : "ghost"}
                      className="w-full justify-start text-left p-2 h-auto pr-10"
                      onClick={() => {
                        setSelectedCategory(category.id);
                        if (category.id === 'all-files') {
                          setSelectedFilter('all');
                        } else {
                          setSelectedFilter('all');
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <IconComponent className="h-4 w-4 flex-shrink-0" />
                        <div className="flex flex-col items-start min-w-0 flex-1">
                          <span className="font-medium text-left w-full">{category.label}</span>
                          <span className="text-xs text-muted-foreground text-left w-full">{category.description}</span>
                        </div>
                      </div>
                    </Button>
                    <Badge variant="secondary" className="absolute top-1 right-2 text-xs pointer-events-none">
                      {category.id === 'all-files' ? content.length : 0}
                    </Badge>
                  </div>
                );
              })}
            </div>

            {/* Custom Folders */}
            {sortedCustomFolders.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-muted-foreground">Custom Folders</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsReorderMode(!isReorderMode)}
                    className="text-xs h-7 px-2"
                  >
                    <ArrowUpDown className="h-3 w-3 mr-1" />
                    Reorder
                  </Button>
                </div>
                {sortedCustomFolders.map((folder, index) => {
                  const IconComponent = folder.icon;
                  return (
                    <div
                      key={folder.id}
                      className={`relative ${isReorderMode ? 'cursor-move' : ''}`}
                      draggable={isReorderMode}
                      onDragStart={(e) => handleCustomFolderDragStart(e, index)}
                      onDragOver={handleCustomFolderDragOver}
                      onDrop={(e) => handleCustomFolderDrop(e, index)}
                    >
                      <Button
                        variant={selectedCategory === folder.id ? "default" : "ghost"}
                        className="w-full justify-start text-left p-2 h-auto pr-10"
                        onClick={() => {
                          if (!isReorderMode) {
                            setSelectedCategory(folder.id);
                            setSelectedFilter('all');
                          }
                        }}
                        disabled={isReorderMode}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {isReorderMode && <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                          <IconComponent className="h-4 w-4 flex-shrink-0" />
                          <div className="flex flex-col items-start min-w-0 flex-1">
                            <span className="font-medium text-left w-full">{folder.label}</span>
                            <span className="text-xs text-muted-foreground text-left w-full">{folder.description}</span>
                          </div>
                        </div>
                      </Button>
                      <Badge variant="secondary" className="absolute top-1 right-2 text-xs pointer-events-none">
                        {folder.count || 0}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="bg-card border-b border-border p-6">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-lg font-semibold text-foreground">
                  {defaultCategories.find(c => c.id === selectedCategory)?.label || 
                   customFolders.find(c => c.id === selectedCategory)?.label || 'Library'}
                </h1>
              </div>

              {/* Controls and Filters */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                {/* Filter Tabs */}
                <div className="flex items-center gap-2 flex-wrap order-2 lg:order-1">
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
                      className="whitespace-nowrap"
                    >
                      {filter.label}
                    </Button>
                  ))}
                </div>

                {/* Search and Sort Controls */}
                <div className="flex items-center gap-3 order-1 lg:order-2">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search content..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-40 focus:w-64 transition-all duration-200"
                    />
                  </div>

                  {/* Sort By */}
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-36">
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