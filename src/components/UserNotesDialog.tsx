import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Palette
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface UserNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName?: string;
}

export const UserNotesDialog = ({
  open,
  onOpenChange,
  userId,
  userName,
}: UserNotesDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState<any[]>([]);
  const { toast } = useToast();

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[200px] p-4',
      },
    },
  });

  useEffect(() => {
    if (open && userId) {
      loadNotes();
    }
  }, [open, userId]);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_notes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
      
      // Load the latest note into the editor
      if (data && data.length > 0) {
        editor?.commands.setContent(data[0].notes);
      } else {
        editor?.commands.setContent('');
      }
    } catch (error) {
      console.error('Error loading notes:', error);
      toast({
        title: "Error",
        description: "Failed to load notes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveNotes = async () => {
    if (!editor) return;
    
    const content = editor.getHTML();
    if (!content.trim() || content === '<p></p>') {
      toast({
        title: "Error",
        description: "Please enter some notes before saving",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_notes')
        .insert({
          admin_id: user.id,
          user_id: userId,
          notes: content,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Notes saved successfully",
      });

      // Reload notes and clear editor
      await loadNotes();
      editor.commands.setContent('');
    } catch (error) {
      console.error('Error saving notes:', error);
      toast({
        title: "Error",
        description: "Failed to save notes",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const EditorToolbar = () => (
    <div className="border-b border-border p-2 flex flex-wrap gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor?.chain().focus().toggleBold().run()}
        disabled={!editor?.can().chain().focus().toggleBold().run()}
        className={editor?.isActive('bold') ? 'bg-muted' : ''}
      >
        <Bold className="h-4 w-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor?.chain().focus().toggleItalic().run()}
        disabled={!editor?.can().chain().focus().toggleItalic().run()}
        className={editor?.isActive('italic') ? 'bg-muted' : ''}
      >
        <Italic className="h-4 w-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor?.chain().focus().toggleStrike().run()}
        disabled={!editor?.can().chain().focus().toggleStrike().run()}
        className={editor?.isActive('strike') ? 'bg-muted' : ''}
      >
        <Strikethrough className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
        className={editor?.isActive('bulletList') ? 'bg-muted' : ''}
      >
        <List className="h-4 w-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        className={editor?.isActive('orderedList') ? 'bg-muted' : ''}
      >
        <ListOrdered className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        className={editor?.isActive('blockquote') ? 'bg-muted' : ''}
      >
        <Quote className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor?.chain().focus().undo().run()}
        disabled={!editor?.can().chain().focus().undo().run()}
      >
        <Undo className="h-4 w-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor?.chain().focus().redo().run()}
        disabled={!editor?.can().chain().focus().redo().run()}
      >
        <Redo className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor?.chain().focus().setColor('#ef4444').run()}
        >
          <Palette className="h-4 w-4 text-red-500" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor?.chain().focus().setColor('#22c55e').run()}
        >
          <Palette className="h-4 w-4 text-green-500" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor?.chain().focus().setColor('#3b82f6').run()}
        >
          <Palette className="h-4 w-4 text-blue-500" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor?.chain().focus().unsetColor().run()}
        >
          <Palette className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            User Notes - {userName || 'Unknown User'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col min-h-0">
          {/* Editor Section */}
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-2">Add New Note</h3>
            <div className="border border-border rounded-md overflow-hidden">
              <EditorToolbar />
              <EditorContent 
                editor={editor} 
                className="prose max-w-none"
              />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button 
                onClick={saveNotes} 
                disabled={saving}
                size="sm"
              >
                {saving ? 'Saving...' : 'Save Note'}
              </Button>
            </div>
          </div>

          {/* Previous Notes Section */}
          <div className="flex-1 min-h-0">
            <h3 className="text-sm font-medium mb-2">Previous Notes</h3>
            <div className="border border-border rounded-md p-4 max-h-60 overflow-y-auto">
              {loading ? (
                <div className="text-center text-muted-foreground">Loading notes...</div>
              ) : notes.length === 0 ? (
                <div className="text-center text-muted-foreground">No notes yet</div>
              ) : (
                <div className="space-y-4">
                  {notes.map((note, index) => (
                    <div key={note.id} className="border-b border-border pb-4 last:border-b-0">
                      <div className="text-xs text-muted-foreground mb-2">
                        {new Date(note.created_at).toLocaleString()}
                      </div>
                      <div 
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: note.notes }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};