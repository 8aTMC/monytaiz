import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getInitials } from '@/lib/initials';
import { formatSubscriptionDuration } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useSidebar } from '@/components/Navigation';
import { FileUploadButton } from '@/components/FileUploadButton';
import { UploadProgressBar } from '@/components/UploadProgressBar';
import { MessageFilesPack } from '@/components/MessageFilesPack';
import { PaymentConfirmationDialog } from '@/components/PaymentConfirmationDialog';
import { AddCardDialog } from '@/components/AddCardDialog';
import { AIPersonaDialog } from '@/components/AIPersonaDialog';
import { AISettingsDialog } from '@/components/AISettingsDialog';
import { FanNotesManager } from '@/components/FanNotesManager';
import { GlobalAIControl } from '@/components/GlobalAIControl';
import { ConversationPinButton } from '@/components/ConversationPinButton';
import { MessageFilters, ExtendedFilterType } from '@/components/MessageFilters';
import { useMessageFileUpload } from '@/hooks/useMessageFileUpload';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useUserPresence } from '@/hooks/useUserPresence';
import { useAIChat } from '@/hooks/useAIChat';
import { EmojiPicker } from '@/components/EmojiPicker';
import { toast as sonnerToast } from 'sonner';
import { MessageList } from '@/components/MessageList';
import { ChatLibraryDialog } from '@/components/ChatLibraryDialog';
import { PPVPricingDialog } from '@/components/PPVPricingDialog';
import { 
  Send, 
  Search, 
  Settings, 
  MoreHorizontal,
  Smile,
  Paperclip,
  Gift,
  DollarSign,
  Mic,
  Library,
  FileText,
  Star,
  Calendar,
  Bot,
  AtSign,
  Pin
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
  is_pinned?: boolean;
  has_ai_active?: boolean;
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
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ExtendedFilterType>('all');
  const [globalAIActive, setGlobalAIActive] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showAddCardDialog, setShowAddCardDialog] = useState(false);
  const [showAIPersonaDialog, setShowAIPersonaDialog] = useState(false);
  const [showAISettingsDialog, setShowAISettingsDialog] = useState(false);
  const [showFanNotesDialog, setShowFanNotesDialog] = useState(false);
  const [showLibraryDialog, setShowLibraryDialog] = useState(false);
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<any[]>([]);
  const [aiSettings, setAiSettings] = useState<any>(null);
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Hooks
  useUserPresence(user.id);

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    const textarea = messageTextareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const newValue = newMessage.slice(0, start) + emoji + newMessage.slice(end);
      setNewMessage(newValue);
      
      // Set cursor position after the emoji
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    }
  };

  const {
    uploadingFiles,
    isUploading,
    addFiles,
    removeFile,
    uploadFiles,
    clearFiles,
    allFilesUploaded,
    hasFiles
  } = useMessageFileUpload();

  // Initialize typing indicator hook
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(
    activeConversation?.id || null, 
    user.id
  );

  // Initialize AI chat hook
  const { generateAIResponseWithTyping, sendAIMessage, isProcessing, isTyping } = useAIChat();

  // Process AI reply into multiple messages
  const processAIReply = async (reply: string, conversationId: string) => {
    try {
      // Split response into multiple messages
      let responses: string[];
      if (reply.includes('---')) {
        responses = reply.split('---').map((msg: string) => msg.trim()).filter((msg: string) => msg.length > 0);
      } else {
        // Fallback: split by sentences and group into smaller messages
        const sentences = reply.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
        responses = [];
        let currentMsg = '';
        
        for (const sentence of sentences) {
          if ((currentMsg + sentence).length > 80) {
            if (currentMsg) responses.push(currentMsg.trim());
            currentMsg = sentence.trim();
          } else {
            currentMsg += (currentMsg ? '. ' : '') + sentence.trim();
          }
        }
        if (currentMsg) responses.push(currentMsg.trim());
      }

      // Send each message part with realistic delays
      for (let i = 0; i < responses.length; i++) {
        const messagePart = responses[i];
        
        if (!messagePart || typeof messagePart !== 'string') continue;
        
        // Calculate realistic typing delay for this message part
        const wordCount = messagePart.split(' ').length;
        const baseTypingDelay = Math.max(wordCount / 0.8, 1.5);
        const typingDelay = baseTypingDelay + (Math.random() * 2);
        
        // Add delay between messages
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, typingDelay * 1000));
        }
        
        // Send this message part
        await sendAIMessage(conversationId, messagePart);
        
        // Short pause between messages (except for the last one)
        if (i < responses.length - 1) {
          await new Promise(resolve => {
            setTimeout(resolve, 500 + Math.random() * 1000);
          });
        }
      }
    } catch (error) {
      console.error('Error processing AI reply:', error);
    }
  };

  // Load AI settings when conversation changes
  const loadAISettings = async (conversationId: string) => {
    try {
      console.log('🔄 Loading AI settings for conversation:', conversationId);
      const { data, error } = await supabase
        .from('ai_conversation_settings')
        .select('*')
        .eq('conversation_id', conversationId)
        .maybeSingle();
      
      if (error) {
        console.log('⚠️ No AI settings found, will use defaults:', error.message);
        setAiSettings(null);
      } else {
        console.log('✅ AI settings loaded:', data);
        setAiSettings(data);
      }
    } catch (error) {
      console.error('❌ Error loading AI settings:', error);
      setAiSettings(null);
    }
  };

  useEffect(() => {
    if (activeConversation?.id) {
      loadAISettings(activeConversation.id);
    }
  }, [activeConversation?.id]);



  useEffect(() => {
    loadConversations();
    
    // Set up real-time subscription for conversation updates (less frequent)
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
          // Update conversation locally instead of reloading all
          const updatedConv = payload.new as any;
          if (updatedConv.latest_message_content || updatedConv.last_message_at) {
            setConversations(prev => prev.map(conv =>
              conv.id === updatedConv.id
                ? {
                    ...conv,
                    latest_message_content: updatedConv.latest_message_content,
                    latest_message_sender_id: updatedConv.latest_message_sender_id,
                    last_message_at: updatedConv.last_message_at,
                    unread_count: updatedConv.unread_count
                  }
                : conv
            ));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationsChannel);
    };
  }, [user.id, isCreator]); // Depend on user ID and creator status

  useEffect(() => {
    if (activeConversation) {
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
            
            // Only update conversations if this is from another user to avoid loops
            if (newMessage.sender_id !== user.id) {
              console.log('📨 Message from another user:', {
                currentUserId: user.id,
                messageFromId: newMessage.sender_id,
                isCreator,
                userRole: 'checking...'
              });
              
              // Update just this conversation's latest message info instead of reloading all
              setConversations(prev => prev.map(conv => 
                conv.id === activeConversation.id 
                  ? {
                      ...conv,
                      latest_message_content: newMessage.content,
                      latest_message_sender_id: newMessage.sender_id,
                      last_message_at: newMessage.created_at,
                      // Only increment unread count if it's not from the current user
                      unread_count: newMessage.sender_id === user.id ? 0 : (conv.unread_count || 0) + 1
                    }
                  : conv
              ));
              
              // Auto-mark as read after a short delay
              setTimeout(() => {
                markConversationAsRead(activeConversation.id);
              }, 1000);
              
              // Check if AI should respond to this fan message (only for creators)
              if (isCreator && activeConversation.fan_id === newMessage.sender_id) {
                // Call the server-side edge function for AI processing
                setTimeout(async () => {
                  try {
                    console.log('🤖 Calling server-side AI processing...');
                    const { data, error } = await supabase.functions.invoke('xai-chat-assistant', {
                      body: {
                        creatorId: user.id, // Current user is the creator
                        conversationId: activeConversation.id,
                        fanId: activeConversation.fan_id,
                        messageText: newMessage.content
                      },
                    });

                    if (error) {
                      console.error('❌ AI processing error:', error);
                      return;
                    }

                    if (data?.skipped) {
                      console.log('ℹ️ AI response skipped:', data.reason);
                      return;
                    }

                    console.log('✅ AI processing completed:', data);
                  } catch (error) {
                    console.error('💥 AI edge function error:', error);
                  }
                }, 1000 + Math.random() * 2000); // Random delay between 1-3 seconds
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(messagesChannel);
      };
    }
  }, [activeConversation?.id]);

  // Load conversations with pin status and AI status
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
      
      // Load pin status from localStorage
      const pinnedConversations = JSON.parse(localStorage.getItem('pinned_conversations') || '[]');
      
      // Use optimized single query with lateral joins to get all data at once
      const { data: optimizedData, error: optimizedError } = await supabase.rpc('get_user_conversations', {
        user_id: user.id,
        is_creator_param: isCreator
      });
      
      if (optimizedError) {
        console.error('Failed to fetch optimized conversations, falling back to original method:', optimizedError);
        
        // Fallback to original method if RPC function doesn't exist yet
        const processedConversations = await Promise.all(
          (data || []).map(async (conv) => {
            // Get the actual latest message for this conversation
            const { data: latestMessage } = await supabase
              .from('messages')
              .select('content, sender_id, created_at')
              .eq('conversation_id', conv.id)
              .eq('status', 'active')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            // Check if AI is active for this conversation
            const { data: aiSettings } = await supabase
              .from('ai_conversation_settings')
              .select('is_ai_enabled')
              .eq('conversation_id', conv.id)
              .maybeSingle();

            // Get actual unread count - count messages from the other user that haven't been read
            const otherUserId = isCreator ? conv.fan_id : conv.creator_id;
            const { data: unreadData } = await supabase
              .from('messages')
              .select('id', { count: 'exact' })
              .eq('conversation_id', conv.id)
              .eq('status', 'active')
              .eq('sender_id', otherUserId)
              .eq('read_by_recipient', false);
            
            const actualUnreadCount = unreadData?.length || 0;

            return {
              ...conv,
              latest_message: latestMessage?.content || conv.latest_message_content || '',
              latest_message_content: latestMessage?.content || conv.latest_message_content || '',
              latest_message_sender_id: latestMessage?.sender_id || conv.latest_message_sender_id || '',
              total_spent: 0,
              unread_count: actualUnreadCount,
              is_pinned: pinnedConversations.includes(conv.id),
              has_ai_active: aiSettings?.is_ai_enabled || false,
            };
          })
        );
        
        setConversations(processedConversations);
        return;
      }

      // Use optimized data if available
      const processedConversations = (optimizedData as any[] || []).map((conv: any) => {
        // Create partner profile data
        const partnerProfile = {
          username: conv.partner_username,
          display_name: conv.partner_display_name,
          fan_category: conv.partner_fan_category,
          avatar_url: conv.partner_avatar_url
        };

        return {
          ...conv,
          partner: partnerProfile,
          // Create proper profile objects based on user role
          fan_profile: isCreator ? partnerProfile : null,
          creator_profile: !isCreator ? partnerProfile : null,
          latest_message: conv.latest_message_content || '',
          latest_message_content: conv.latest_message_content || '',
          latest_message_sender_id: conv.latest_message_sender_id || '',
          total_spent: 0,
          unread_count: conv.unread_count || 0,
          is_pinned: pinnedConversations.includes(conv.id),
          has_ai_active: conv.has_ai_active || false,
        };
      });

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


  const sendMessage = async () => {
    if (!activeConversation || !newMessage.trim() || sending) return;

    try {
      setSending(true);
      stopTyping(); // Stop typing indicator when sending
      
      const messageContent = newMessage.trim();
      const { data: messageData, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversation.id,
          sender_id: user.id,
          content: messageContent,
          status: 'active'
          // Note: delivered_at will be set when recipient comes online
        })
        .select()
        .single();

      if (error) throw error;
      
      setNewMessage('');
      
      // AI responses are now handled in the real-time message subscription
      // This prevents the AI from responding to its own messages
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
      // Don't call sendMessage here since form submission will handle it
      const form = e.currentTarget.closest('form') as HTMLFormElement;
      if (form) {
        form.requestSubmit();
      }
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

  // Helper function to get profile based on user role
  const getProfileForConversation = (conv: Conversation) => {
    return isCreator ? conv.fan_profile : conv.creator_profile;
  };

  // Determine if a conversation needs a reply (last message is from the other party)
  const needsReply = (conv: Conversation) => {
    if (!conv.latest_message_sender_id) return false;
    return conv.latest_message_sender_id !== user.id;
  };
  // Filter conversations based on active filter
  const filteredConversations = conversations.filter((conversation) => {
    // First apply text search filter
    const profile = getProfileForConversation(conversation);
    const searchTerm = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      profile?.display_name?.toLowerCase().includes(searchTerm) ||
      profile?.username?.toLowerCase().includes(searchTerm) ||
      conversation.latest_message_content?.toLowerCase().includes(searchTerm);

    if (!matchesSearch) return false;

    // Then apply active filter
    switch (activeFilter) {
      case 'all':
        return true;
      case 'ai':
        return conversation.has_ai_active;
      case 'pinned':
        return conversation.is_pinned;
      case 'unread':
        return conversation.unread_count > 0;
      case 'unreplied':
        return needsReply(conversation);
      default:
        return true;
    }
  });

  // Mark messages as read when conversation is opened and auto-mark when messages are viewed
  const markConversationAsRead = async (conversationId: string) => {
    try {
      // Use RPC function to properly mark conversation and messages as read
      const { error } = await supabase.rpc('mark_conversation_as_read', {
        conv_id: conversationId,
        reader_user_id: user.id
      });

      if (error) {
        console.error('Error marking conversation as read:', error);
        return;
      }
      
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

  // Auto-mark messages as read when conversation changes
  useEffect(() => {
    if (activeConversation) {
      const timer = setTimeout(() => {
        markConversationAsRead(activeConversation.id);
      }, 1000); // Mark as read after 1 second of viewing

      return () => clearTimeout(timer);
    }
  }, [activeConversation?.id]);


  const handleLibraryAttach = (files: any[]) => {
    setAttachedFiles(files);
    setShowLibraryDialog(false);
    toast({
      title: "Files attached",
      description: `${files.length} file${files.length !== 1 ? 's' : ''} attached to message`,
    });
  };

  const handlePricingConfirm = (totalPriceCents: number, filePrices: Record<string, number>) => {
    // Update the attached files with pricing info
    const updatedFiles = attachedFiles.map(file => ({
      ...file,
      price_cents: filePrices[file.id] || 0
    }));
    setAttachedFiles(updatedFiles);
    
    toast({
      title: "Pricing set",
      description: `Total price: $${(totalPriceCents / 100).toFixed(2)}`,
    });
  };

  const actionButtons = [
    { icon: Bot, label: 'AI', color: 'text-purple-500', onClick: () => setShowAISettingsDialog(true) },
    { icon: Library, label: 'Library', color: 'text-primary', onClick: () => setShowLibraryDialog(true) },
    { icon: Mic, label: 'Voice', color: 'text-purple-500', onClick: () => {} },
    // Only show tip button for fans, not for creators/admin
    ...(!isCreator ? [{ icon: Gift, label: 'Tip', color: 'text-yellow-500', onClick: () => {} }] : []),
    { icon: DollarSign, label: 'Price', color: 'text-emerald-500', onClick: () => setShowPricingDialog(true), disabled: () => attachedFiles.length === 0 },
    { icon: FileText, label: 'Scripts', color: 'text-orange-500', onClick: () => {} },
    { icon: AtSign, label: 'Tag Creator', color: 'text-primary', onClick: () => {} },
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
    <>
      <div className="flex h-full bg-background" data-messages-layout>
        {/* Conversation Sidebar */}
        <div className="w-80 border-r border-border bg-background flex-shrink-0">
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex-none p-4 border-b border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Messages</h2>
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setSearchQuery(searchQuery ? '' : 'search')} // Toggle search functionality
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowAIPersonaDialog(true)}
                    title="AI Persona Settings"
                  >
                    <Bot className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Search Input */}
              <div className="relative mb-4">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>

              {/* Message Filters */}
              <MessageFilters 
                activeFilter={activeFilter} 
                onFilterChange={setActiveFilter}
                aiChatCount={0}
                pinnedCount={0}
                unreadCount={0}
                unrepliedCount={0}
                userId={user.id}
              />
            </div>

            {/* Conversations List */}
            <ScrollArea className="flex-1 scrollarea-viewport">
              <div className="p-2 space-y-1">
                {filteredConversations.map((conversation) => {
                  const profile = getProfileForConversation(conversation);
                  const isOnline = false; // TODO: Implement user presence
                  
                  return (
                    <div
                      key={conversation.id}
                      className={`p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                        activeConversation?.id === conversation.id
                          ? 'bg-muted border-l-2 border-l-primary'
                          : ''
                      }`}
                      onClick={() => {
                        setActiveConversation(conversation);
                        markConversationAsRead(conversation.id);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={profile?.avatar_url} />
                            <AvatarFallback>
                              {getInitials(profile?.display_name)}
                            </AvatarFallback>
                          </Avatar>
                          {isOnline && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium truncate">
                              {profile?.display_name || 'Unknown User'}
                            </p>
                            <div className="flex items-center gap-1">
                              {needsReply(conversation) && (
                                <div className="w-2 h-2 bg-amber-500 rounded-full" title="Needs Reply" />
                              )}
                              {conversation.unread_count > 0 && (
                                <Badge variant="secondary" className="h-5 min-w-5 text-xs px-1.5">
                                  {conversation.unread_count}
                                </Badge>
                              )}
                              <ConversationPinButton 
                                conversationId={conversation.id} 
                                isPinned={false}
                                onToggle={() => {}}
                              />
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {conversation.latest_message_content || 'No messages yet'}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-muted-foreground">
                              {formatTime(conversation.last_message_at)}
                            </p>
                            {typingUsers[conversation.id] && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <div className="flex gap-0.5">
                                  <div className="w-1 h-1 bg-current rounded-full animate-bounce"></div>
                                  <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                  <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                </div>
                                <span>typing...</span>
                              </div>
                            )}
                          </div>
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
        <div className={`flex flex-col min-w-0 h-screen overflow-hidden ${
          activeConversation && isCreator ? 'flex-1' : 'flex-1'
        }`}>
          {activeConversation ? (
            <div className="flex flex-col h-full">
              {/* Chat Header - Fixed */}
              <div className="flex-none h-16 p-4 border-b border-border bg-background flex items-center justify-between">
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
                    {getProfileForConversation(activeConversation)?.username && (
                      <p className="text-sm text-muted-foreground">
                        @{getProfileForConversation(activeConversation).username}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFanNotesDialog(true)}
                    title="Manage Fan Notes"
                    className="text-xs"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Messages Container - Scrollable */}
              <div className="flex-1 min-h-0">
                <MessageList
                  conversationId={activeConversation.id}
                  currentUserId={user.id}
                />
              </div>

              {/* Message Input - Fixed at bottom */}
              <div className="flex-none p-4 border-t border-border bg-background">
                {/* Upload Progress - Remove if not needed */}
                {hasFiles && (
                  <div className="mb-4">
                    <div className="text-sm text-muted-foreground">Uploading files...</div>
                  </div>
                )}

                {/* Attached Files Preview */}
                {attachedFiles.length > 0 && (
                  <div className="mb-3">
                    <div className="flex flex-wrap gap-2">
                      {attachedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="relative bg-muted rounded-lg p-2 flex items-center gap-2 max-w-48"
                        >
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm text-muted-foreground truncate">
                            {file.metadata?.title || `File ${index + 1}`}
                          </span>
                          <button
                            type="button"
                            className="ml-auto text-muted-foreground hover:text-foreground w-4 h-4 flex items-center justify-center text-xs"
                            onClick={() => setAttachedFiles(files => files.filter((_, i) => i !== index))}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons Row */}
                <div className="flex items-center gap-2 mb-2">
                  {actionButtons.map((button, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3"
                      title={button.label}
                      onClick={button.onClick}
                      disabled={button.disabled?.() || false}
                    >
                      <button.icon className={`h-4 w-4 ${button.color}`} />
                    </Button>
                  ))}
                </div>

                {/* Message Input */}
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMessage();
                  }}
                  className="flex gap-1 items-end"
                >
                  <EmojiPicker onEmojiSelect={handleEmojiSelect}>
                    <Button type="button" variant="ghost" size="sm" className="h-10 px-2 flex-shrink-0" title="Emoji">
                      <Smile className="h-4 w-4 text-amber-500" />
                    </Button>
                  </EmojiPicker>

                  {attachedFiles.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-10 px-2 flex-shrink-0"
                      onClick={() => setShowPricingDialog(true)}
                      title="Set Price"
                    >
                      <DollarSign className="h-4 w-4 text-green-500" />
                    </Button>
                  )}

                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleEnterKey}
                    placeholder="Type a message..."
                    className="flex-1 min-h-10 max-h-32 resize-none"
                    rows={1}
                  />
                  
                  <Button 
                    type="submit"
                    disabled={!newMessage.trim() || sending || (hasFiles && !allFilesUploaded)}
                    size="sm"
                    className="h-10"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </div>
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
          <div className="w-80 border-l border-border bg-background flex-shrink-0">
            <div className="p-4 h-full flex flex-col">
              <h3 className="font-semibold mb-4">AI Memory for Fan</h3>
              
              <ScrollArea className="flex-1 scrollarea-viewport">
                <div className="space-y-4 px-3">
                  {/* AI Conversation Context */}
                  <Card>
                    <CardContent className="p-3">
                      <h4 className="text-sm font-medium mb-3">Conversation Context</h4>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>• Fan prefers evening conversations</p>
                        <p>• Interested in exclusive content</p>
                        <p>• Usually tips on Fridays</p>
                        <p>• Likes personalized messages</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* AI Assistant Status */}
                  <Card>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">AI Assistant</span>
                        <Badge variant="outline" className="text-green-600">Active</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Auto-Reply</span>
                        <span className="text-sm">Enabled</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Subscription Status */}
                  <Card>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Subscription</span>
                        <Badge variant="outline">{formatSubscriptionDuration(3)}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Next Renewal</span>
                        <span className="text-sm">Dec 23, 2024</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Total Spent */}
                  <Card>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Total Spent</span>
                        <span className="text-sm font-medium">$1,247.32</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">This Month</span>
                        <span className="text-sm">$89.50</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Activity Overview */}
                  <Card>
                    <CardContent className="p-3">
                      <h4 className="text-sm font-medium mb-3">Activity Overview</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Messages Sent</span>
                          <span>347</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Content Purchased</span>
                          <span>23</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Tips Given</span>
                          <span>12</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Spending Chart */}
                  <Card>
                    <CardHeader className="p-3">
                      <h4 className="text-sm font-medium">Spending Trend</h4>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div className="h-32 bg-muted rounded flex items-center justify-center">
                        <span className="text-muted-foreground text-sm">Spending Chart</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </div>

      {/* Dialog Components */}
      <AIPersonaDialog 
        open={showAIPersonaDialog} 
        onOpenChange={setShowAIPersonaDialog} 
      />
      
      <AISettingsDialog 
        open={showAISettingsDialog} 
        onOpenChange={setShowAISettingsDialog}
        conversationId={activeConversation?.id || ''}
        onSettingsUpdate={setAiSettings}
      />
      
      {activeConversation && (
        <FanNotesManager
          open={showFanNotesDialog}
          onOpenChange={setShowFanNotesDialog}
          fanId={isCreator ? activeConversation.fan_id : activeConversation.creator_id}
          fanName={getProfileForConversation(activeConversation)?.display_name || 'Unknown User'}
        />
      )}
      
      {/* Payment Dialog */}
      <PaymentConfirmationDialog
        open={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        amount={29.91}
        onConfirm={() => {
          setShowPaymentDialog(false);
          sonnerToast.success('Purchase confirmed!');
        }}
        onAddCard={() => {
          setShowPaymentDialog(false);
          setShowAddCardDialog(true);
        }}
      />

      {/* Add Card Dialog */}
      <AddCardDialog
        open={showAddCardDialog}
        onClose={() => setShowAddCardDialog(false)}
        onSave={() => {
          setShowAddCardDialog(false);
          sonnerToast.success('Card added successfully!');
        }}
      />
      
      {/* Library Dialog */}
      <ChatLibraryDialog
        isOpen={showLibraryDialog}
        onClose={() => setShowLibraryDialog(false)}
        onAttachFiles={handleLibraryAttach}
        currentUserId={user.id}
      />
      
      {/* PPV Pricing Dialog */}
      <PPVPricingDialog
        isOpen={showPricingDialog}
        onClose={() => setShowPricingDialog(false)}
        onConfirm={handlePricingConfirm}
        attachedFiles={attachedFiles}
        fanId={activeConversation ? (isCreator ? activeConversation.fan_id : activeConversation.creator_id) : ''}
      />
    </>
  );
};