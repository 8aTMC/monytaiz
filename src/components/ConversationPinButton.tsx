import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ConversationPinButtonProps {
  conversationId: string;
  isPinned: boolean;
  onToggle: (pinned: boolean) => void;
}

export const ConversationPinButton = ({ 
  conversationId, 
  isPinned, 
  onToggle 
}: ConversationPinButtonProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const togglePin = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent conversation selection
    
    try {
      setLoading(true);
      
      // Use the existing updated_at field to track pin status in conversation metadata
      // This is a temporary solution until the database types are updated
      const { data: conversation } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (!conversation) throw new Error('Conversation not found');

      // For now, store pin status in localStorage as a fallback
      const storageKey = `pinned_conversations`;
      const stored = localStorage.getItem(storageKey);
      const pinnedConversations = stored ? JSON.parse(stored) : [];
      
      let updatedPinned;
      if (isPinned) {
        updatedPinned = pinnedConversations.filter((id: string) => id !== conversationId);
      } else {
        updatedPinned = [...pinnedConversations, conversationId];
      }
      
      localStorage.setItem(storageKey, JSON.stringify(updatedPinned));
      
      onToggle(!isPinned);
      
      toast({
        title: isPinned ? "Unpinned" : "Pinned",
        description: `Conversation ${isPinned ? 'unpinned' : 'pinned'} successfully`,
      });
    } catch (error) {
      console.error('Error toggling pin:', error);
      toast({
        title: "Error",
        description: "Failed to toggle pin status",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={togglePin}
      disabled={loading}
      className={`h-6 w-6 p-0 ${isPinned ? 'text-yellow-500' : 'text-muted-foreground hover:text-yellow-500'}`}
      title={isPinned ? 'Unpin conversation' : 'Pin conversation'}
    >
      <Pin className={`h-3 w-3 ${isPinned ? 'fill-current' : ''}`} />
    </Button>
  );
};