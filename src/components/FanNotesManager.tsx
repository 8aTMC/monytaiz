import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface FanNote {
  id: string;
  note: string;
  note_type: string;
  created_at: string;
  created_by: string;
}

interface FanNotesManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fanId: string;
  fanName: string;
}

export function FanNotesManager({ open, onOpenChange, fanId, fanName }: FanNotesManagerProps) {
  const [notes, setNotes] = useState<FanNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("general");
  const [loading, setLoading] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const { toast } = useToast();

  const noteTypes = [
    { value: "general", label: "General" },
    { value: "preferences", label: "Preferences" },
    { value: "purchases", label: "Purchase History" },
    { value: "personality", label: "Personality" },
    { value: "interests", label: "Interests" },
    { value: "relationship", label: "Relationship Status" },
    { value: "important", label: "Important Info" }
  ];

  useEffect(() => {
    if (open && fanId) {
      loadNotes();
    }
  }, [open, fanId]);

  const loadNotes = async () => {
    setLoadingNotes(true);
    try {
      const { data, error } = await supabase
        .from('fan_memories')
        .select('*')
        .eq('fan_id', fanId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Error loading notes:', error);
      toast({
        title: "Error",
        description: "Failed to load fan notes.",
        variant: "destructive",
      });
    } finally {
      setLoadingNotes(false);
    }
  };

  const addNote = async () => {
    if (!newNote.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a note.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('fan_memories')
        .insert([{
          fan_id: fanId,
          creator_id: user.user.id,
          note: newNote.trim(),
          note_type: noteType,
          created_by: user.user.id
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Note added successfully!",
      });
      
      setNewNote("");
      setNoteType("general");
      loadNotes();
    } catch (error) {
      console.error('Error adding note:', error);
      toast({
        title: "Error",
        description: "Failed to add note. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('fan_memories')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Note deleted successfully!",
      });
      
      loadNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
      toast({
        title: "Error",
        description: "Failed to delete note.",
        variant: "destructive",
      });
    }
  };

  const getTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      general: "bg-gray-100 text-gray-800",
      preferences: "bg-blue-100 text-blue-800",
      purchases: "bg-green-100 text-green-800",
      personality: "bg-purple-100 text-purple-800",
      interests: "bg-yellow-100 text-yellow-800",
      relationship: "bg-pink-100 text-pink-800",
      important: "bg-red-100 text-red-800"
    };
    return colors[type] || colors.general;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Fan Notes - {fanName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Add new note */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="text-sm font-medium">Add New Note</h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Label htmlFor="note">Note</Label>
                <Textarea
                  id="note"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add information about this fan..."
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={noteType} onValueChange={setNoteType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {noteTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button onClick={addNote} disabled={loading} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  {loading ? "Adding..." : "Add Note"}
                </Button>
              </div>
            </div>
          </div>

          {/* Existing notes */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Existing Notes ({notes.length})</h3>
            
            {loadingNotes ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading notes...
              </div>
            ) : notes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No notes yet. Add the first note about this fan to help personalize AI conversations.
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="secondary" 
                            className={getTypeColor(note.note_type)}
                          >
                            {noteTypes.find(t => t.value === note.note_type)?.label || note.note_type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(note.created_at), 'MMM d, yyyy')}
                          </span>
                        </div>
                        <p className="text-sm">{note.note}</p>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteNote(note.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
