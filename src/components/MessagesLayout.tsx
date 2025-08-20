import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getInitials } from '@/lib/initials';
import { useToast } from '@/hooks/use-toast';
import { useSidebar } from '@/components/Navigation';
import { 
  Send, 
  Search, 
  Settings, 
  MoreHorizontal,
  Smile,
  Paperclip,
  Gift,
  Heart,
  DollarSign,
  Camera,
  Mic,
  Image as ImageIcon,
  FileText,
  Star,
  Calendar,
  Check,
  CheckCheck
} from 'lucide-react';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  conversation_id: string;
  message_type: string;
  delivered_at?: string;
  read_by_recipient: boolean;
  read_at?: string;
}

interface Conversation {
  id: string;
  fan_id: string;
  creator_id: string;
  last_message_at: string;
  unread_count: number;
  latest_message_content: string;
  latest_message_sender_id: string;
  fan_profile?: {
    display_name: string;
    username: string;
    avatar_url?: string;
  };
  creator_profile?: {
    display_name: string;
    username: string;
    avatar_url?: string;
  };
  latest_message?: string;
  total_spent?: number;
}

interface MessagesLayoutProps {
  user: User;
  isCreator: boolean;
}

export const MessagesLayout = ({ user, isCreator }: MessagesLayoutProps) => {
  const { toast } = useToast();
  const { setIsCollapsed } = useSidebar();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-collapse sidebar to give more space for chat
  useEffect(() => {
    setIsCollapsed(true);
  }, [setIsCollapsed]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Scroll to bottom when conversation changes
  useEffect(() => {
    if (activeConversation) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 200);
    }
  }, [activeConversation]);

  useEffect(() => {
    loadConversations();
    
    // Set up real-time subscription for conversation updates
    const conversationsChannel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          console.log('Conversation updated:', payload);
          // Reload conversations to get latest message info
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationsChannel);
    };
  }, [user]);

  useEffect(() => {
    if (activeConversation) {
      loadMessages();
      
      // Set up real-time subscription for messages
      const messagesChannel = supabase
        .channel(`conversation-messages-${activeConversation.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${activeConversation.id}`,
          },
          (payload) => {
            console.log('New message received:', payload);
            const newMessage = payload.new as Message;
            setMessages((current) => {
              // Avoid duplicates
              if (current.find(msg => msg.id === newMessage.id)) {
                return current;
              }
              return [...current, newMessage];
            });
            // Update conversations list to reflect new message
            loadConversations();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(messagesChannel);
      };
    }
  }, [activeConversation]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      
      // Check if user has admin/management role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      const roles = roleData?.map(r => r.role) || [];
      const isAdmin = roles.some(role => ['admin', 'owner', 'superadmin'].includes(role));
      
      const query = supabase
        .from('conversations')
        .select(`
          id,
          fan_id,
          creator_id,
          last_message_at,
          unread_count,
          latest_message_content,
          latest_message_sender_id,
          fan_profile:profiles!conversations_fan_id_fkey(display_name, username, avatar_url),
          creator_profile:profiles!conversations_creator_id_fkey(display_name, username, avatar_url)
        `)
        .eq('status', 'active')
        .order('last_message_at', { ascending: false });

      // Admin users can see all conversations, others see only their own
      if (!isAdmin) {
        if (isCreator) {
          query.eq('creator_id', user.id);
        } else {
          query.eq('fan_id', user.id);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Process conversations to add fallback data
      const processedConversations = data?.map(conv => ({
        ...conv,
        latest_message: conv.latest_message_content || 'No messages yet',
        total_spent: Math.floor(Math.random() * 500), // Mock data for now
        unread_count: conv.unread_count || 0,
        latest_message_content: conv.latest_message_content || '',
        latest_message_sender_id: conv.latest_message_sender_id || ''
      })) || [];

      setConversations(processedConversations);
      
      // Auto-select first conversation if none selected
      if (processedConversations.length > 0 && !activeConversation) {
        setActiveConversation(processedConversations[0]);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!activeConversation) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', activeConversation.id)
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!activeConversation || !newMessage.trim() || sending) return;

    try {
      setSending(true);
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversation.id,
          sender_id: user.id,
          content: newMessage.trim(),
          status: 'active'
        });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return formatTime(timestamp);
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else if (date.getFullYear() === today.getFullYear()) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const filteredConversations = conversations.filter(conv => {
    const profile = isCreator ? conv.fan_profile : conv.creator_profile;
    const name = profile?.display_name || profile?.username || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getProfileForConversation = (conv: Conversation) => {
    return isCreator ? conv.fan_profile : conv.creator_profile;
  };

  // Mark messages as read when conversation is opened
  const markConversationAsRead = async (conversationId: string) => {
    try {
      await supabase.rpc('mark_conversation_as_read', {
        conv_id: conversationId,
        reader_user_id: user.id
      });
      
      // Update local state
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, unread_count: 0 }
          : conv
      ));
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  };

  // Get delivery status icon for messages
  const getDeliveryStatusIcon = (message: Message) => {
    if (message.sender_id !== user.id) return null;
    
    if (message.read_by_recipient) {
      return <CheckCheck className="h-3 w-3 text-blue-500" />;
    } else if (message.delivered_at) {
      return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
    } else {
      return <Check className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const actionButtons = [
    { icon: Paperclip, label: 'Attach', color: 'text-muted-foreground' },
    { icon: ImageIcon, label: 'Photo', color: 'text-blue-500' },
    { icon: Camera, label: 'Camera', color: 'text-green-500' },
    { icon: Mic, label: 'Voice', color: 'text-purple-500' },
    // Only show tip button for fans, not for creators/admin
    ...(!isCreator ? [{ icon: Gift, label: 'Tip', color: 'text-yellow-500' }] : []),
    { icon: Heart, label: 'Like', color: 'text-red-500' },
    { icon: DollarSign, label: 'Price', color: 'text-emerald-500' },
    { icon: FileText, label: 'Note', color: 'text-orange-500' },
    { icon: Smile, label: 'Emoji', color: 'text-amber-500' },
  ];

  if (loading) {
    return (
      <div className="flex h-full">
        <div className="w-80 border-r border-border bg-background">
          <div className="animate-pulse p-4 space-y-4">
            <div className="h-10 bg-muted rounded"></div>
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center space-x-3">
                  <div className="h-12 w-12 bg-muted rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded"></div>
                    <div className="h-3 bg-muted/60 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading messages...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background">
      {/* Conversations Sidebar */}
      <div className="w-80 border-r border-border bg-background flex flex-col flex-shrink-0 h-screen">
        {/* Header */}
        <div className="flex-none p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Messages</h2>
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search conversations..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-2">
              {filteredConversations.map((conversation) => {
                const profile = getProfileForConversation(conversation);
                const isActive = activeConversation?.id === conversation.id;
                
                return (
                  <div
                    key={conversation.id}
                    className={`relative p-3 rounded-lg cursor-pointer transition-colors mb-1 ${
                      isActive ? 'bg-primary/10' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => {
                      setActiveConversation(conversation);
                      if (conversation.unread_count > 0) {
                        markConversationAsRead(conversation.id);
                      }
                    }}
                  >
                    {/* Unread Badge */}
                    {conversation.unread_count > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute top-2 right-2 h-5 px-2 text-xs font-medium"
                      >
                        Unread
                      </Badge>
                    )}
                    
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={profile?.avatar_url} />
                          <AvatarFallback>
                            {getInitials(profile?.display_name, profile?.username)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-background"></div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <h4 className="font-medium text-sm truncate pr-2">
                            {profile?.display_name || profile?.username || 'Unknown User'}
                          </h4>
                          <div className="flex flex-col items-end text-right flex-shrink-0 ml-auto">
                            <span className="text-xs text-muted-foreground">
                              {formatDate(conversation.last_message_at)}
                            </span>
                            <span className="text-xs font-medium text-primary">
                              ${conversation.total_spent || 0}
                            </span>
                          </div>
                        </div>
                        <p className={`text-xs truncate mt-1 ${
                          conversation.unread_count > 0 
                            ? 'text-foreground font-semibold' 
                            : 'text-muted-foreground'
                        }`}>
                          {conversation.latest_message_content || 'No messages yet'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Main Chat Area - Responsive width */}
      <div className={`flex flex-col min-w-0 ${
        activeConversation && isCreator ? 'flex-1' : 'flex-1'
      }`} style={{ height: '100vh' }}>
        {activeConversation ? (
          <>
            {/* Chat Header - Fixed */}
            <div className="flex-none h-[73px] p-4 border-b border-border bg-background flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={getProfileForConversation(activeConversation)?.avatar_url} />
                  <AvatarFallback>
                    {getInitials(
                      getProfileForConversation(activeConversation)?.display_name,
                      getProfileForConversation(activeConversation)?.username
                    )}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">
                    {getProfileForConversation(activeConversation)?.display_name || 'Unknown User'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    @{getProfileForConversation(activeConversation)?.username || 'unknown'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  VIP
                </Badge>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages Area - Takes remaining space, scrollable */}
            <div className="flex-1 min-h-0 overflow-hidden" style={{ height: 'calc(100vh - 73px - 140px)' }}>
              <ScrollArea className="h-full px-6 py-4">
                <div className="space-y-4 max-w-4xl mx-auto pb-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 px-4 ${
                        message.sender_id === user.id ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {message.sender_id !== user.id && (
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage src={getProfileForConversation(activeConversation)?.avatar_url} />
                          <AvatarFallback>
                            {getInitials(
                              getProfileForConversation(activeConversation)?.display_name,
                              getProfileForConversation(activeConversation)?.username
                            )}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className={`flex-1 max-w-sm ${message.sender_id === user.id ? 'text-right' : ''}`}>
                        <div
                          className={`inline-block p-3 rounded-lg ${
                            message.sender_id === user.id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          <div className="flex items-center justify-end gap-1">
                            <span>{formatTime(message.created_at)}</span>
                            {getDeliveryStatusIcon(message)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </div>

            {/* Message Input Area - Fixed at bottom */}
            <div className="flex-none border-t border-border bg-background" style={{ height: '140px' }}>
              <div className="p-4">
                {/* Action Buttons */}
                <div className="flex items-center gap-2 mb-3 overflow-x-auto">
                  {actionButtons.map((button, index) => (
                    <button
                      key={index}
                      type="button"
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 px-3 flex-shrink-0"
                      title={button.label}
                      onClick={(e) => e.preventDefault()}
                    >
                      <button.icon className={`h-4 w-4 ${button.color}`} />
                    </button>
                  ))}
                </div>

                {/* Message Input */}
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMessage();
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Type a message..."
                    disabled={sending}
                    className="flex-1"
                  />
                  <Button 
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Send className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No conversation selected</h3>
              <p className="text-muted-foreground">
                Choose a conversation from the sidebar to start messaging
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Fan Insights Sidebar */}
      {activeConversation && isCreator && (
        <div className="w-80 border-l border-border bg-background flex-shrink-0 h-screen">
          <div className="p-4 h-full flex flex-col">
            <h3 className="font-semibold mb-4">Fan Insights</h3>
            
            <ScrollArea className="flex-1">
              <div className="space-y-4 pr-3">
                {/* Subscription Status */}
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Subscription</span>
                      <Badge variant="outline">0 months</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold">$0.00</span>
                      <span className="text-sm text-muted-foreground">Total spent</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Purchase History */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Last purchase:</span>
                    <span>Never</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Highest purchase:</span>
                    <span>$0.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subscription status:</span>
                    <Badge variant="outline">Free</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Auto-renew:</span>
                    <span>Off</span>
                  </div>
                </div>

                <Separator />

                {/* Fan Info */}
                <div className="space-y-2">
                  <h4 className="font-medium">Fan info:</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Join date:</span>
                      <span>{new Date().toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last active:</span>
                      <span>Today</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Messages sent:</span>
                      <span>{messages.filter(m => m.sender_id !== user.id).length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Device:</span>
                      <span>Web</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Fan Lists */}
                <div className="space-y-2">
                  <h4 className="font-medium">Fan lists:</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">New Fans</Badge>
                    <Badge variant="outline">Free Users</Badge>
                  </div>
                </div>

                <Separator />

                {/* Fan Notes */}
                <div className="space-y-2">
                  <h4 className="font-medium">Fan notes:</h4>
                  <textarea
                    placeholder="Add notes about this fan..."
                    className="w-full h-32 p-2 text-sm border border-input rounded-md resize-none bg-background"
                    defaultValue=""
                  />
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
};