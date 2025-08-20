import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/initials';
import { Send, MessageCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { Navigation, useSidebar } from '@/components/Navigation';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  conversation_id: string;
}

interface Conversation {
  id: string;
  creator_id: string;
  fan_id: string;
  creator_profile?: {
    display_name: string;
    username: string;
    avatar_url?: string;
  };
}

interface FanMessagesProps {
  user: User;
}

export const FanMessages = ({ user }: FanMessagesProps) => {
  const { toast } = useToast();
  const { isCollapsed, isNarrowScreen } = useSidebar();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [messagesOffset, setMessagesOffset] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const MESSAGES_PER_PAGE = 100;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadConversation();
  }, [user]);

  useEffect(() => {
    if (conversation) {
      loadMessages();
      
      // Set up real-time subscription for messages
      const messagesChannel = supabase
        .channel(`fan-messages-${conversation.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversation.id}`,
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
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(messagesChannel);
      };
    }
  }, [conversation]);

  const loadConversation = async () => {
    try {
      setLoading(true);
      
      // First, check if fan already has an active conversation with ANY management user
      const { data: existingConv, error: convError } = await supabase
        .from('conversations')
        .select(`
          id,
          creator_id,
          fan_id,
          creator_profile:profiles!conversations_creator_id_fkey(display_name, username, avatar_url)
        `)
        .eq('fan_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (convError && convError.code !== 'PGRST116') {
        throw convError;
      }

      if (existingConv) {
        console.log('✅ Found existing conversation for fan:', existingConv.id);
        setConversation(existingConv);
        return;
      }

      // No existing conversation found, get creator profile and create conversation
      const { data: creatorProfile, error: creatorError } = await supabase
        .from('creator_profile')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (creatorError) throw creatorError;

      if (!creatorProfile) {
        console.log('❌ No creator profile found');
        toast({
          title: "Creator profile needed",
          description: "Please ask management to set up the creator profile first",
          variant: "destructive",
        });
        return;
      }

      // Find a management user to represent the creator
      const { data: managementUsers, error: mgmtError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['owner', 'superadmin', 'admin', 'manager'])
        .order('role_level', { ascending: true })
        .limit(1);

      if (mgmtError) throw mgmtError;

      if (!managementUsers || managementUsers.length === 0) {
        console.log('❌ No management users found');
        toast({
          title: "No management available",
          description: "There are no management users to chat with at the moment",
          variant: "destructive",
        });
        return;
      }

      const managementUserId = managementUsers[0].user_id;
      console.log('🎯 Creating new conversation with management user:', managementUserId, 'as creator:', creatorProfile.display_name);

      // Create new conversation
      const { data: newConv, error: createError } = await supabase
        .from('conversations')
        .insert({
          fan_id: user.id,
          creator_id: managementUserId,
          status: 'active'
        })
        .select(`
          id,
          creator_id,
          fan_id,
          creator_profile:profiles!conversations_creator_id_fkey(display_name, username, avatar_url)
        `)
        .single();

      if (createError) throw createError;
      
      console.log('✨ Created new conversation for fan:', newConv.id);
      setConversation({
        ...newConv,
        // Override profile data with creator profile for display
        creator_profile: {
          display_name: creatorProfile.display_name,
          username: creatorProfile.username || null,
          avatar_url: creatorProfile.avatar_url || null
        }
      });
      
    } catch (error) {
      console.error('❌ Error loading conversation:', error);
      toast({
        title: "Error",
        description: "Failed to load conversation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!conversation) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PER_PAGE);

      if (error) throw error;
      
      const reversedMessages = (data || []).reverse();
      setMessages(reversedMessages);
      setMessagesOffset(data?.length || 0);
      setHasMoreMessages((data?.length || 0) === MESSAGES_PER_PAGE);
      
      // Scroll to bottom for initial load
      setTimeout(() => scrollToBottom(), 100);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    }
  };

  const loadMoreMessages = async () => {
    if (!conversation || loadingMoreMessages || !hasMoreMessages) return;

    try {
      setLoadingMoreMessages(true);
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .range(messagesOffset, messagesOffset + MESSAGES_PER_PAGE - 1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        const reversedNewMessages = data.reverse();
        setMessages(prev => [...reversedNewMessages, ...prev]);
        setMessagesOffset(prev => prev + data.length);
        setHasMoreMessages(data.length === MESSAGES_PER_PAGE);
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
      toast({
        title: "Error",
        description: "Failed to load more messages",
        variant: "destructive",
      });
    } finally {
      setLoadingMoreMessages(false);
    }
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop } = messagesContainerRef.current;
    
    // Load more messages when scrolled to top
    if (scrollTop === 0 && hasMoreMessages && !loadingMoreMessages) {
      loadMoreMessages();
    }
  };

  const sendMessage = async () => {
    if (!conversation || !newMessage.trim() || sending) return;

    try {
      setSending(true);
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
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

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Navigation />
        <main className={`flex-1 transition-all duration-300 p-6 pt-[73px] ${isNarrowScreen && !isCollapsed ? 'ml-0' : ''}`}>
          <div className="animate-pulse">
            <div className="h-8 w-32 bg-muted/30 rounded mb-4"></div>
            <div className="h-96 bg-muted/20 rounded-lg"></div>
          </div>
        </main>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex min-h-screen bg-background">
        <Navigation />
        <main className={`flex-1 transition-all duration-300 p-6 pt-[73px] ${isNarrowScreen && !isCollapsed ? 'ml-0' : ''}`}>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No conversation available</h3>
              <p className="text-muted-foreground text-center">
                Unable to start a conversation at this time. Please try again later.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Navigation />
      <main className={`flex-1 flex flex-col transition-all duration-300 h-full overflow-hidden ${isNarrowScreen && !isCollapsed ? 'ml-0' : ''}`}>
        {/* Chat Header */}
        <div className="flex-shrink-0 p-4 border-b border-border bg-background z-10">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={conversation.creator_profile?.avatar_url} />
              <AvatarFallback>
                {getInitials(conversation.creator_profile?.display_name, conversation.creator_profile?.username)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">
                {conversation.creator_profile?.display_name || 'Management'}
              </div>
              {conversation.creator_profile?.username && (
                <div className="text-sm text-muted-foreground">
                  @{conversation.creator_profile.username}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Messages Area */}
        <div className="flex-1 min-h-0 relative">
          <div 
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="absolute inset-0 overflow-y-auto p-4"
          >
            {loadingMoreMessages && (
              <div className="text-center py-4">
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  Loading more messages...
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              {messages.length === 0 && !loadingMoreMessages ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Start the conversation</h3>
                  <p className="text-muted-foreground">
                    Send your first message to get started!
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.sender_id === user.id ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {message.sender_id !== user.id && (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={conversation.creator_profile?.avatar_url} />
                        <AvatarFallback>
                          {getInitials(conversation.creator_profile?.display_name, conversation.creator_profile?.username)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`flex-1 max-w-xs ${message.sender_id === user.id ? 'text-right' : ''}`}>
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
                        {formatTime(message.created_at)}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
        
        {/* Fixed Input Area */}
        <div className="flex-shrink-0 p-4 border-t border-border bg-background">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={sending}
              className="flex-1"
            />
            <Button onClick={sendMessage} disabled={!newMessage.trim() || sending}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FanMessages;