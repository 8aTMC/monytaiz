import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/initials';
import { Send, MessageCircle, Bot, Smile, Library, Mic, FileText, Gift, DollarSign, AtSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSidebar } from '@/components/Navigation';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { MessageList } from '@/components/MessageList';

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
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Initialize typing indicator hook
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(
    conversation?.id || null, 
    user.id
  );

  // Load conversation only once when component mounts
  useEffect(() => {
    if (user && !conversation) {
      loadConversation();
    }
  }, [user]);

  // Auto-mark messages as read when received (separate effect)
  useEffect(() => {
    if (!conversation) return;

    const markAsReadChannel = supabase
      .channel(`fan-mark-read-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          
          // Auto-mark messages as read when received from other users
          if (newMessage.sender_id !== user.id) {
            setTimeout(async () => {
              try {
                await supabase
                  .from('messages')
                  .update({ 
                    read_by_recipient: true, 
                    read_at: new Date().toISOString() 
                  })
                  .eq('conversation_id', conversation.id)
                  .eq('read_by_recipient', false)
                  .neq('sender_id', user.id);
              } catch (error) {
                console.error('Error marking message as read:', error);
              }
            }, 1000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(markAsReadChannel);
    };
  }, [conversation?.id, user.id]);

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

  const sendMessage = async () => {
    if (!conversation || !newMessage.trim() || sending) return;

    try {
      setSending(true);
      stopTyping(); // Stop typing indicator when sending
      
      const { data: messageData, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: user.id,
          content: newMessage.trim(),
          status: 'active',
          delivered_at: new Date().toISOString() // Mark as delivered immediately
        })
        .select()
        .single();

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

  const handleEnterKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loading) {
    return (
      <div className="p-6 animate-pulse">
        <div className="h-8 w-32 bg-muted/30 rounded mb-4"></div>
        <div className="h-96 bg-muted/20 rounded-lg"></div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No conversation available</h3>
            <p className="text-muted-foreground text-center">
              Unable to start a conversation at this time. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-background">
      {/* Chat Header - Fixed height */}
      <div className="flex-none h-[73px] p-4 border-b border-border bg-background z-10 flex items-center">
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
      
      {/* Messages Area - Takes remaining space */}
      <div className="flex-1 min-h-0">
        {conversation ? (
          <MessageList
            conversationId={conversation.id}
            currentUserId={user.id}
            partnerProfile={conversation.creator_profile}
            className="h-full"
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground mb-4 mx-auto" />
              <h3 className="text-lg font-medium mb-2">Start the conversation</h3>
              <p className="text-muted-foreground">
                Send your first message to get started!
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Typing Indicator - Positioned above input */}
      {typingUsers.length > 0 && (
        <div className="flex-none px-4 pb-2">
          <div className="flex gap-3">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage src={conversation.creator_profile?.avatar_url} />
              <AvatarFallback>
                {getInitials(conversation.creator_profile?.display_name, conversation.creator_profile?.username)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 max-w-sm">
              <div className="inline-block p-3 rounded-lg bg-muted">
                <div className="flex items-center gap-1">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="text-xs text-muted-foreground ml-2">Typing...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Fixed Input Area - Always at bottom */}
      <div className="flex-none h-[81px] p-4 border-t border-border bg-background">
        {/* Action Buttons Row */}
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="sm" className="h-8 px-3" title="AI Assistant">
            <Bot className="h-4 w-4 text-purple-500" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-3" title="Emoji">
            <Smile className="h-4 w-4 text-amber-500" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-3" title="Library">
            <Library className="h-4 w-4 text-primary" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-3" title="Voice">
            <Mic className="h-4 w-4 text-purple-500" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-3" title="Tip">
            <Gift className="h-4 w-4 text-yellow-500" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-3" title="Price">
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-3" title="Scripts">
            <FileText className="h-4 w-4 text-orange-500" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-3" title="Tag Creator">
            <AtSign className="h-4 w-4 text-primary" />
          </Button>
        </div>
        
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex gap-2"
        >
          <Input
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              if (e.target.value.trim()) {
                startTyping();
              }
            }}
            onKeyDown={(e) => {
              handleEnterKey(e);
            }}
            placeholder="Type your message..."
            disabled={sending}
            className="flex-1"
          />
          <Button 
            type="submit" 
            disabled={!newMessage.trim() || sending}
            onClick={stopTyping} // Stop typing when send button is clicked
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default FanMessages;