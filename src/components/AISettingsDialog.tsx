import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bot, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AISettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  onSettingsUpdate?: (settings: any) => void;
}

export function AISettingsDialog({ open, onOpenChange, conversationId, onSettingsUpdate }: AISettingsDialogProps) {
  const [settings, setSettings] = useState({
    is_ai_enabled: false,
    current_mode: 'friendly_chat' as 'friendly_chat' | 'supportive_nudges' | 'comeback_mode' | 'intimate_flirt' | 'autopilot',
    auto_response_enabled: false,
    typing_simulation_enabled: true,
    provider: 'openai' as 'openai' | 'xai',
    model: 'gpt-4o-mini' as string
  });
  const [loading, setLoading] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const { toast } = useToast();

  const modes = [
    { 
      value: "friendly_chat", 
      label: "Friendly Chat", 
      description: "Warm, casual conversations focused on building connection",
      color: "bg-blue-100 text-blue-800"
    },
    { 
      value: "flirty_chat", 
      label: "Flirty Chat", 
      description: "Playful, flirtatious interactions with charm and wit",
      color: "bg-pink-100 text-pink-800"
    },
    { 
      value: "roleplay", 
      label: "Roleplay", 
      description: "Immersive roleplay scenarios and character interactions",
      color: "bg-purple-100 text-purple-800"
    },
    { 
      value: "girlfriend_experience", 
      label: "Girlfriend Experience", 
      description: "Caring, loving interactions like a real girlfriend",
      color: "bg-red-100 text-red-800"
    },
    { 
      value: "professional", 
      label: "Professional", 
      description: "Helpful and knowledgeable while maintaining boundaries",
      color: "bg-green-100 text-green-800"
    }
  ];

  const providers = [
    { 
      value: "openai", 
      label: "OpenAI", 
      description: "GPT models - great for general conversation",
      models: ["gpt-4o-mini", "gpt-4o", "gpt-4"]
    },
    { 
      value: "xai", 
      label: "xAI (Grok)", 
      description: "Grok models - witty, real-time aware responses",
      models: ["grok-4", "grok-3", "grok-2"]  
    }
  ];

  useEffect(() => {
    if (open && conversationId) {
      loadSettings();
    }
  }, [open, conversationId]);

  const loadSettings = async () => {
    setLoadingSettings(true);
    try {
      const { data, error } = await supabase
        .from('ai_conversation_settings')
        .select('*')
        .eq('conversation_id', conversationId)
        .single();
      
      if (data) {
        setSettings({
          is_ai_enabled: data.is_ai_enabled,
          current_mode: data.current_mode,
          auto_response_enabled: data.auto_response_enabled,
          typing_simulation_enabled: data.typing_simulation_enabled,
          provider: (data.provider || 'openai') as 'openai' | 'xai',
          model: data.model || 'gpt-4o-mini'
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoadingSettings(false);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from('ai_conversation_settings')
        .select('id')
        .eq('conversation_id', conversationId)
        .single();

      let result;
      if (existing) {
        result = await supabase
          .from('ai_conversation_settings')
          .update(settings)
          .eq('conversation_id', conversationId);
      } else {
        result = await supabase
          .from('ai_conversation_settings')
          .insert([{
            conversation_id: conversationId,
            ...settings
          }]);
      }

      if (result.error) throw result.error;

      toast({
        title: "Success",
        description: "AI settings updated successfully!",
      });
      
      onSettingsUpdate?.(settings);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save AI settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedMode = modes.find(m => m.value === settings.current_mode);
  const selectedProvider = providers.find(p => p.value === settings.provider);
  const availableModels = selectedProvider?.models || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Assistant Settings
          </DialogTitle>
        </DialogHeader>
        
        {loadingSettings ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading settings...
          </div>
        ) : (
          <div className="space-y-6">
            {/* AI Enable Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>AI Assistant</Label>
                <p className="text-sm text-muted-foreground">
                  Enable AI-powered responses for this conversation
                </p>
              </div>
              <Switch
                checked={settings.is_ai_enabled}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, is_ai_enabled: checked }))
                }
              />
            </div>

            {settings.is_ai_enabled && (
              <>
                {/* Provider Selection */}
                <div className="space-y-3">
                  <Label>AI Provider</Label>
                  <Select 
                    value={settings.provider} 
                    onValueChange={(value) => {
                      const newProvider = value as 'openai' | 'xai';
                      const defaultModel = providers.find(p => p.value === newProvider)?.models[0] || 'gpt-4o-mini';
                      setSettings(prev => ({ 
                        ...prev, 
                        provider: newProvider,
                        model: defaultModel
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((provider) => (
                        <SelectItem key={provider.value} value={provider.value}>
                          <div className="flex flex-col">
                            <span className="font-medium">{provider.label}</span>
                            <span className="text-xs text-muted-foreground">{provider.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Model Selection */}
                <div className="space-y-3">
                  <Label>Model</Label>
                  <Select 
                    value={settings.model} 
                    onValueChange={(value) => 
                      setSettings(prev => ({ ...prev, model: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {settings.provider === 'xai' 
                      ? 'Grok models are known for wit and real-time knowledge'
                      : 'GPT models excel at general conversation and creativity'
                    }
                  </p>
                </div>

                {/* Mode Selection */}
                <div className="space-y-3">
                  <Label>Conversation Mode</Label>
                  <Select 
                    value={settings.current_mode} 
                    onValueChange={(value) => 
                      setSettings(prev => ({ ...prev, current_mode: value as typeof settings.current_mode }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {modes.map((mode) => (
                        <SelectItem key={mode.value} value={mode.value}>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className={mode.color}>
                              {mode.label}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {selectedMode && (
                    <p className="text-sm text-muted-foreground">
                      {selectedMode.description}
                    </p>
                  )}
                </div>

                {/* Auto Response Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Auto Response</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically respond to fan messages
                    </p>
                  </div>
                  <Switch
                    checked={settings.auto_response_enabled}
                    onCheckedChange={(checked) => 
                      setSettings(prev => ({ ...prev, auto_response_enabled: checked }))
                    }
                  />
                </div>

                {/* Typing Simulation Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Typing Simulation</Label>
                    <p className="text-sm text-muted-foreground">
                      Show realistic typing delays before responses
                    </p>
                  </div>
                  <Switch
                    checked={settings.typing_simulation_enabled}
                    onCheckedChange={(checked) => 
                      setSettings(prev => ({ ...prev, typing_simulation_enabled: checked }))
                    }
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={saveSettings} disabled={loading}>
                {loading ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}