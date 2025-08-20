import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { Send, Search, MessageCircle, User as UserIcon, Mail, DollarSign, Star, Bell } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  conversation_id: string;
  sender?: {
    username?: string;
    display_name?: string;
  };
}

interface ConversationWithFan {
  id: string;
  fan_id: string;
  creator_id: string;
  last_message_at: string;
  fan: {
    id: string;
    username?: string;
    display_name?: string;
    fan_category?: string;
  };
  last_message?: {
    content: string;
    sender_id: string;
  };
  total_spent?: number;
  unread_count?: number;
}

const ManagementMessages = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<ConversationWithFan[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'priority' | 'with_tips'>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!activeConversation) return;

    // Set up real-time subscription for messages
    const channel = supabase
      .channel('management-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${activeConversation}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages(prev => [...prev, newMessage]);
          // Update conversation last message time
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversation]);

  const loadConversations = async () => {
    if (!user) return;

    try {
      // Get conversations where the current user is the creator
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          fan_id,
          creator_id,
          last_message_at,
          fan:profiles!conversations_fan_id_fkey(id, username, display_name, fan_category)
        `)
        .eq('creator_id', user.id)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      // Enhance with last message and spending data
      const enhancedConversations = await Promise.all(
        (data || []).map(async (conv) => {
          // Get last message
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, sender_id')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // Get total spending (mock for now)
          const totalSpent = Math.floor(Math.random() * 1000) + 50;

          // Get unread count (mock for now)
          const unreadCount = Math.floor(Math.random() * 5);

          return {
            ...conv,
            last_message: lastMsg,
            total_spent: totalSpent,
            unread_count: unreadCount,
          };
        })
      );

      setConversations(enhancedConversations);
    } catch (error) {
      console.error('Error loading conversations:', error);
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive",
      });
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          sender_id,
          conversation_id,
          sender:profiles!messages_sender_id_fkey(username, display_name)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeConversation || !user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversation,
          sender_id: user.id,
          content: newMessage.trim(),
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
      setLoading(false);
    }
  };

  const selectConversation = (conversationId: string) => {
    setActiveConversation(conversationId);
    loadMessages(conversationId);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getFanCategoryColor = (category?: string) => {
    switch (category) {
      case 'vip': return 'bg-yellow-500/20 text-yellow-700';
      case 'premium': return 'bg-purple-500/20 text-purple-700';
      case 'regular': return 'bg-blue-500/20 text-blue-700';
      default: return 'bg-gray-500/20 text-gray-700';
    }
  };

  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = searchQuery === '' || 
      (conv.fan.display_name || conv.fan.username || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    switch (filter) {
      case 'unread':
        return matchesSearch && (conv.unread_count || 0) > 0;
      case 'priority':
        return matchesSearch && conv.fan.fan_category === 'vip';
      case 'with_tips':
        return matchesSearch && (conv.total_spent || 0) > 200;
      default:
        return matchesSearch;
    }
  });

  const selectedConversation = conversations.find(conv => conv.id === activeConversation);

  return (
    <div className="h-[calc(100vh-var(--header-h))] flex">
      {/* Conversations Sidebar */}
      <div className="w-80 border-r flex flex-col bg-muted/30">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="h-5 w-5" />
            <h2 className="font-semibold">Messages</h2>
          </div>
          
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={filter === 'unread' ? 'default' : 'outline'}
              onClick={() => setFilter('unread')}
              className="gap-1"
            >
              <Mail className="h-3 w-3" />
              Unread
            </Button>
            <Button
              size="sm"
              variant={filter === 'priority' ? 'default' : 'outline'}
              onClick={() => setFilter('priority')}
              className="gap-1"
            >
              <Star className="h-3 w-3" />
              Priority
            </Button>
            <Button
              size="sm"
              variant={filter === 'with_tips' ? 'default' : 'outline'}
              onClick={() => setFilter('with_tips')}
              className="gap-1"
            >
              <DollarSign className="h-3 w-3" />
              Tips
            </Button>
          </div>
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => selectConversation(conversation.id)}
                className={`p-3 rounded-lg mb-2 cursor-pointer transition-colors ${
                  activeConversation === conversation.id 
                    ? 'bg-primary/20 border border-primary/30' 
                    : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {(conversation.fan.display_name || conversation.fan.username || 'F')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-sm truncate">
                        {conversation.fan.display_name || conversation.fan.username || 'Unknown Fan'}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(conversation.last_message_at)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={`text-xs ${getFanCategoryColor(conversation.fan.fan_category)}`}>
                        {conversation.fan.fan_category || 'fan'}
                      </Badge>
                      <span className="text-xs text-green-600 font-medium">
                        ${conversation.total_spent}
                      </span>
                      {conversation.unread_count && conversation.unread_count > 0 && (
                        <Badge className="bg-red-500 text-white text-xs">
                          {conversation.unread_count}
                        </Badge>
                      )}
                    </div>
                    
                    {conversation.last_message && (
                      <p className="text-xs text-muted-foreground truncate">
                        {conversation.last_message.sender_id === user?.id ? 'You: ' : ''}
                        {conversation.last_message.content}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {filteredConversations.length === 0 && (
              <div className="text-center py-8">
                <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-sm">
                  {searchQuery ? 'No conversations match your search' : 'No conversations yet'}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeConversation && selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b bg-background">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {(selectedConversation.fan.display_name || selectedConversation.fan.username || 'F')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">
                    {selectedConversation.fan.display_name || selectedConversation.fan.username || 'Unknown Fan'}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${getFanCategoryColor(selectedConversation.fan.fan_category)}`}>
                      {selectedConversation.fan.fan_category || 'fan'}
                    </Badge>
                    <span className="text-xs text-green-600 font-medium">
                      Total: ${selectedConversation.total_spent}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.sender_id === user?.id ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {message.sender_id !== user?.id && (
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {(message.sender?.display_name || message.sender?.username || 'F')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`max-w-[70%] rounded-lg px-3 py-2 ${
                        message.sender_id === user?.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <div className={`text-xs mt-1 ${
                        message.sender_id === user?.id
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground'
                      }`}>
                        {formatTime(message.created_at)}
                      </div>
                    </div>
                    {message.sender_id === user?.id && (
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          <UserIcon className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <Separator />

            {/* Message Input */}
            <div className="p-4 bg-background">
              <div className="flex gap-2">
                <Input
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  disabled={loading}
                />
                <Button onClick={sendMessage} disabled={loading || !newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-muted/10">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Select any conversation to start</h3>
              <p className="text-muted-foreground">
                Choose a conversation from the sidebar to begin chatting
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagementMessages;