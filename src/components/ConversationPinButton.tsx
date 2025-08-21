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
      
      const { error } = await supabase
        .from('conversations')
        .update({ is_pinned: !isPinned })
        .eq('id', conversationId);

      if (error) throw error;

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