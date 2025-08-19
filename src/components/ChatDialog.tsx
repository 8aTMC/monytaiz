import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Send, MessageCircle, User, Plus } from 'lucide-react';
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

interface Conversation {
  id: string;
  fan_id: string;
  creator_id: string;
  last_message_at: string;
  creator: {
    username?: string;
    display_name?: string;
  };
}

interface ChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChatDialog = ({ open, onOpenChange }: ChatDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [creatorsForNewChat, setCreatorsForNewChat] = useState<any[]>([]);
  const [showNewChatForm, setShowNewChatForm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (open && user) {
      loadConversations();
      loadCreators();
    }
  }, [open, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!activeConversation) return;

    // Set up real-time subscription for messages
    const channel = supabase
      .channel('message-updates')
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
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          fan_id,
          creator_id,
          last_message_at,
          creator:profiles!conversations_creator_id_fkey(username, display_name)
        `)
        .eq('fan_id', user.id)
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive",
      });
    }
  };

  const loadCreators = async () => {
    try {
      // First get creator user IDs
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['owner', 'creator']);

      if (roleError) throw roleError;
      
      const creatorIds = roleData?.map(r => r.user_id) || [];
      
      if (creatorIds.length === 0) {
        setCreatorsForNewChat([]);
        return;
      }

      // Then get creator profiles
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .in('id', creatorIds);

      if (error) throw error;
      setCreatorsForNewChat(data || []);
    } catch (error) {
      console.error('Error loading creators:', error);
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

  const startNewConversation = async (creatorId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          fan_id: user.id,
          creator_id: creatorId,
        })
        .select(`
          id,
          fan_id,
          creator_id,
          last_message_at,
          creator:profiles!conversations_creator_id_fkey(username, display_name)
        `)
        .single();

      if (error) throw error;

      setConversations(prev => [data, ...prev]);
      setActiveConversation(data.id);
      setShowNewChatForm(false);
      loadMessages(data.id);
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast({
        title: "Error",
        description: "Failed to start conversation",
        variant: "destructive",
      });
    }
  };

  const selectConversation = (conversationId: string) => {
    setActiveConversation(conversationId);
    loadMessages(conversationId);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Chat
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex min-h-0">
          {/* Conversations Sidebar */}
          <div className="w-80 border-r flex flex-col">
            <div className="p-4 border-b">
              <Button 
                onClick={() => setShowNewChatForm(true)}
                className="w-full gap-2"
                variant="outline"
              >
                <Plus className="h-4 w-4" />
                New Chat
              </Button>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2">
                {showNewChatForm && (
                  <Card className="mb-4">
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-3">Start a new conversation</h4>
                      <div className="space-y-2">
                        {creatorsForNewChat.map((creator) => (
                          <Button
                            key={creator.id}
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => startNewConversation(creator.id)}
                          >
                            <Avatar className="h-8 w-8 mr-3">
                              <AvatarFallback>
                                {(creator.display_name || creator.username || 'U')[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {creator.display_name || creator.username || 'Unknown'}
                          </Button>
                        ))}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full mt-3"
                        onClick={() => setShowNewChatForm(false)}
                      >
                        Cancel
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {conversations.map((conversation) => (
                  <Button
                    key={conversation.id}
                    variant={activeConversation === conversation.id ? "secondary" : "ghost"}
                    className="w-full justify-start mb-2 h-auto p-3"
                    onClick={() => selectConversation(conversation.id)}
                  >
                    <Avatar className="h-10 w-10 mr-3">
                      <AvatarFallback>
                        {(conversation.creator.display_name || conversation.creator.username || 'U')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">
                        {conversation.creator.display_name || conversation.creator.username || 'Unknown Creator'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatTime(conversation.last_message_at)}
                      </div>
                    </div>
                  </Button>
                ))}

                {conversations.length === 0 && !showNewChatForm && (
                  <div className="text-center py-8">
                    <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground text-sm">No conversations yet</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {activeConversation ? (
              <>
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
                              {(message.sender?.display_name || message.sender?.username || 'U')[0].toUpperCase()}
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
                              <User className="h-4 w-4" />
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
                <div className="p-4">
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
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No conversation selected</h3>
                  <p className="text-muted-foreground">
                    Choose a conversation from the sidebar or start a new one
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};