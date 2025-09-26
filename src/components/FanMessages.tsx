import { useState, useEffect, useRef } from 'react';
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
import { useUserPresence } from '@/hooks/useUserPresence';
import { MessageList } from '@/components/MessageList';
import { EmojiPicker } from '@/components/EmojiPicker';
import { ChatLibraryDialog } from '@/components/ChatLibraryDialog';
import { PPVPricingDialog } from '@/components/PPVPricingDialog';
import { FileUploadButton } from '@/components/FileUploadButton';
import { FileAttachmentRow } from '@/components/FileAttachmentRow';
import { LibraryAttachmentRow } from '@/components/LibraryAttachmentRow';
import { useMessageFileUpload } from '@/hooks/useMessageFileUpload';

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
  const [showLibraryDialog, setShowLibraryDialog] = useState(false);
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<any[]>([]);
  const messageInputRef = useRef<HTMLInputElement>(null);

  // File upload hook
  const {
    rawFiles,
    addFiles,
    removeFileByIndex,
    clearFiles
  } = useMessageFileUpload();

  // Initialize typing indicator hook
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(
    conversation?.id || null, 
    user.id
  );
  // Note: useUserPresence is handled at the layout level to avoid conflicts

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
      
      const messageContent = newMessage.trim();
      const isPPV = attachedFiles.length > 0;
      
      const { data: messageData, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: user.id,
          content: messageContent,
          status: 'active',
          is_ppv: isPPV,
          has_attachments: attachedFiles.length > 0,
          attachment_count: attachedFiles.length
          // Note: delivered_at will be set when recipient comes online
        })
        .select()
        .single();

      if (error) throw error;
      
      // If there are attached files, create file attachments
      if (attachedFiles.length > 0) {
        const attachments = attachedFiles.map((file, index) => ({
          message_id: messageData.id,
          media_id: file.id,
          media_table: 'simple_media',
          file_order: index,
        }));

        const { error: attachmentError } = await supabase
          .from('message_file_attachments')
          .insert(attachments);

        if (attachmentError) {
          console.error('Error creating file attachments:', attachmentError);
        }
      }
      
      setNewMessage('');
      setAttachedFiles([]);
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

  const handleEmojiSelect = (emoji: string) => {
    const input = messageInputRef.current;
    if (input) {
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const newValue = newMessage.slice(0, start) + emoji + newMessage.slice(end);
      setNewMessage(newValue);
      
      // Set cursor position after the emoji
      setTimeout(() => {
        input.setSelectionRange(start + emoji.length, start + emoji.length);
        input.focus();
      }, 0);
    } else {
      setNewMessage(prev => prev + emoji);
    }
  };

  const handleEnterKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleLibraryAttach = (files: any[]) => {
    // Append newly selected files to existing attached files
    const updatedFiles = [...attachedFiles, ...files];
    setAttachedFiles(updatedFiles);
    setShowLibraryDialog(false);
    toast({
      title: "Files attached",
      description: `${files.length} file${files.length !== 1 ? 's' : ''} attached to message (${updatedFiles.length} total)`,
    });
  };

  const removeLibraryFile = (fileId: string) => {
    setAttachedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const handlePricingConfirm = (totalPriceCents: number, filePrices: Record<string, number>) => {
    // Update the attached files with pricing info
    const updatedFiles = attachedFiles.map(file => ({
      ...file,
      price_cents: filePrices[file.id] || 0
    }));
    setAttachedFiles(updatedFiles);
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
      <div className="flex-none h-[81px] p-4 border-t border-border bg-background relative">
        {/* Price tag display */}
        {(() => {
          const totalPriceCents = attachedFiles.reduce((sum, file) => sum + (file.price_cents || 0), 0);
          return totalPriceCents > 0 ? (
            <div className="absolute top-[20px] right-4 z-10">
              <div className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full">
                ${(totalPriceCents / 100).toFixed(2)}
              </div>
            </div>
          ) : null;
        })()}
        
        {/* Action Buttons Row */}
        <div className="flex items-center gap-2 mb-2">
          <FileUploadButton 
            onFilesSelected={addFiles}
            currentFiles={rawFiles}
            maxFiles={50}
          />
          <Button variant="ghost" size="sm" className="h-8 px-3" title="AI Assistant">
            <Bot className="h-4 w-4 text-purple-500" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className={`h-8 px-3 ${(attachedFiles.length > 0 || rawFiles.length > 0) ? 'bg-blue-100 border-blue-300' : ''}`}
            title="Library"
            onClick={() => setShowLibraryDialog(true)}
          >
            <Library className="h-4 w-4 text-primary" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-3" title="Voice">
            <Mic className="h-4 w-4 text-purple-500" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-3" title="Tip">
            <Gift className="h-4 w-4 text-yellow-500" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className={`h-8 px-3 ${(() => {
              const totalPriceCents = attachedFiles.reduce((sum, file) => sum + (file.price_cents || 0), 0);
              return totalPriceCents > 0 ? 'bg-emerald-100 border-emerald-300' : '';
            })()} `}
            title="Price"
            onClick={() => setShowPricingDialog(true)}
            disabled={attachedFiles.length === 0 && rawFiles.length === 0}
          >
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-3" title="Scripts">
            <FileText className="h-4 w-4 text-orange-500" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-3" title="Tag Creator">
            <AtSign className="h-4 w-4 text-primary" />
          </Button>
        </div>
        
        {/* Library Files Preview */}
        <LibraryAttachmentRow 
          files={attachedFiles}
          onRemoveFile={removeLibraryFile}
          onClearAll={() => setAttachedFiles([])}
        />

        {/* Attached Files Preview - Replace with FileAttachmentRow */}
        <FileAttachmentRow 
          files={rawFiles}
          onRemoveFile={removeFileByIndex}
          onClearAll={clearFiles}
        />
        
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex gap-2 items-center"
        >
          <EmojiPicker onEmojiSelect={handleEmojiSelect}>
            <Button type="button" variant="ghost" size="sm" className="h-10 px-3 flex-shrink-0" title="Emoji">
              <Smile className="h-4 w-4 text-amber-500" />
            </Button>
          </EmojiPicker>
          <Input
            ref={messageInputRef}
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
            placeholder="Type a message..."
            disabled={sending}
            className="flex-1 emoji"
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
      
      {/* Dialog Components */}
      <ChatLibraryDialog
        isOpen={showLibraryDialog}
        onClose={() => setShowLibraryDialog(false)}
        onAttachFiles={handleLibraryAttach}
        currentUserId={user.id}
        alreadySelectedFiles={attachedFiles}
      />
      
      <PPVPricingDialog
        isOpen={showPricingDialog}
        onClose={() => setShowPricingDialog(false)}
        onConfirm={handlePricingConfirm}
        attachedFiles={attachedFiles}
        fanId={user.id}
      />
    </div>
  );
};

export default FanMessages;