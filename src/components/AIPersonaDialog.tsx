import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AIPersonaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIPersonaDialog({ open, onOpenChange }: AIPersonaDialogProps) {
  const [persona, setPersona] = useState({
    persona_name: "",
    persona_description: "", 
    personality_traits: [] as string[],
    tone_of_voice: "",
    hobbies: [] as string[],
    life_events: [] as string[],
    background_info: ""
  });
  const [newTrait, setNewTrait] = useState("");
  const [newHobby, setNewHobby] = useState("");
  const [newLifeEvent, setNewLifeEvent] = useState("");
  const [loading, setLoading] = useState(false);
  const [existingPersona, setExistingPersona] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadPersona();
    }
  }, [open]);

  const loadPersona = async () => {
    try {
      const { data, error } = await supabase
        .from('model_persona')
        .select('*')
        .single();
      
      if (data) {
        setExistingPersona(data);
        setPersona({
          persona_name: data.persona_name || "",
          persona_description: data.persona_description || "",
          personality_traits: data.personality_traits || [],
          tone_of_voice: data.tone_of_voice || "",
          hobbies: data.hobbies || [],
          life_events: data.life_events || [],
          background_info: data.background_info || ""
        });
      }
    } catch (error) {
      console.error('Error loading persona:', error);
    }
  };

  const addTrait = () => {
    if (newTrait.trim()) {
      setPersona(prev => ({
        ...prev,
        personality_traits: [...prev.personality_traits, newTrait.trim()]
      }));
      setNewTrait("");
    }
  };

  const removeTrait = (index: number) => {
    setPersona(prev => ({
      ...prev,
      personality_traits: prev.personality_traits.filter((_, i) => i !== index)
    }));
  };

  const addHobby = () => {
    if (newHobby.trim()) {
      setPersona(prev => ({
        ...prev,
        hobbies: [...prev.hobbies, newHobby.trim()]
      }));
      setNewHobby("");
    }
  };

  const removeHobby = (index: number) => {
    setPersona(prev => ({
      ...prev,
      hobbies: prev.hobbies.filter((_, i) => i !== index)
    }));
  };

  const addLifeEvent = () => {
    if (newLifeEvent.trim()) {
      setPersona(prev => ({
        ...prev,
        life_events: [...prev.life_events, newLifeEvent.trim()]
      }));
      setNewLifeEvent("");
    }
  };

  const removeLifeEvent = (index: number) => {
    setPersona(prev => ({
      ...prev,
      life_events: prev.life_events.filter((_, i) => i !== index)
    }));
  };

  const savePersona = async () => {
    if (!persona.persona_name || !persona.persona_description) {
      toast({
        title: "Missing Information",
        description: "Please fill in the name and description fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const personaData = {
        ...persona,
        creator_id: user.user.id
      };

      let result;
      if (existingPersona) {
        result = await supabase
          .from('model_persona')
          .update(personaData)
          .eq('id', existingPersona.id);
      } else {
        result = await supabase
          .from('model_persona')
          .insert([personaData]);
      }

      if (result.error) throw result.error;

      toast({
        title: "Success",
        description: `AI persona ${existingPersona ? 'updated' : 'created'} successfully!`,
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving persona:', error);
      toast({
        title: "Error",
        description: "Failed to save AI persona. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Persona Configuration</DialogTitle>
          <DialogDescription>
            Configure your AI assistant's personality, behavior, and conversation style.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="persona_name">Character Name</Label>
              <Input
                id="persona_name"
                value={persona.persona_name}
                onChange={(e) => setPersona(prev => ({ ...prev, persona_name: e.target.value }))}
                placeholder="e.g., Alex, Luna, Sophia"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tone_of_voice">Tone of Voice</Label>
              <Input
                id="tone_of_voice"
                value={persona.tone_of_voice}
                onChange={(e) => setPersona(prev => ({ ...prev, tone_of_voice: e.target.value }))}
                placeholder="e.g., Warm and playful"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="persona_description">Character Description</Label>
            <Textarea
              id="persona_description"
              value={persona.persona_description}
              onChange={(e) => setPersona(prev => ({ ...prev, persona_description: e.target.value }))}
              placeholder="Describe the character's overall personality and how they interact with fans..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="background_info">Background Information</Label>
            <Textarea
              id="background_info"
              value={persona.background_info}
              onChange={(e) => setPersona(prev => ({ ...prev, background_info: e.target.value }))}
              placeholder="Character's history, profession, life story..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Personality Traits</Label>
            <div className="flex gap-2">
              <Input
                value={newTrait}
                onChange={(e) => setNewTrait(e.target.value)}
                placeholder="Add a personality trait"
                onKeyPress={(e) => e.key === 'Enter' && addTrait()}
              />
              <Button onClick={addTrait} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {persona.personality_traits.map((trait, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {trait}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeTrait(index)} />
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Hobbies & Interests</Label>
            <div className="flex gap-2">
              <Input
                value={newHobby}
                onChange={(e) => setNewHobby(e.target.value)}
                placeholder="Add a hobby or interest"
                onKeyPress={(e) => e.key === 'Enter' && addHobby()}
              />
              <Button onClick={addHobby} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {persona.hobbies.map((hobby, index) => (
                <Badge key={index} variant="outline" className="flex items-center gap-1">
                  {hobby}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeHobby(index)} />
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Life Events & Recent Updates</Label>
            <div className="flex gap-2">
              <Input
                value={newLifeEvent}
                onChange={(e) => setNewLifeEvent(e.target.value)}
                placeholder="Add a life event or recent update"
                onKeyPress={(e) => e.key === 'Enter' && addLifeEvent()}
              />
              <Button onClick={addLifeEvent} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {persona.life_events.map((event, index) => (
                <Badge key={index} variant="destructive" className="flex items-center gap-1">
                  {event}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeLifeEvent(index)} />
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={savePersona} disabled={loading}>
              {loading ? "Saving..." : existingPersona ? "Update Persona" : "Create Persona"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}