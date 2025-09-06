import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Bot, Timer, Clock, Calendar, Zap, MessageCircle, Heart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { invalidateGlobalSettings } from '@/ai/service';

interface GlobalAIControlProps {
  isActive: boolean;
  onToggle: (active: boolean) => void;
}

export const GlobalAIControl = ({ isActive, onToggle }: GlobalAIControlProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [globalSettings, setGlobalSettings] = useState({
    enabled: false,
    mode: 'auto',
    endTime: '',
    hoursRemaining: 0,
    timerType: 'hours' as 'hours' | 'endTime'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadGlobalSettings();
  }, []);

  const loadGlobalSettings = async () => {
    try {
      const { data } = await supabase
        .from('global_ai_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        const settings = {
          enabled: data.enabled || false,
          mode: data.mode || 'auto',
          endTime: data.end_time || '',
          hoursRemaining: data.hours_remaining || 0,
          timerType: data.timer_type as 'hours' | 'endTime' || 'hours'
        };
        setGlobalSettings(settings);
        onToggle(settings.enabled);
      }
    } catch (error) {
      console.error('Error loading global AI settings:', error);
    }
  };

  const saveGlobalSettings = async () => {
    try {
      setLoading(true);
      
      const now = new Date();
      let calculatedEndTime = null;
      
      if (globalSettings.timerType === 'hours' && globalSettings.hoursRemaining > 0) {
        calculatedEndTime = new Date(now.getTime() + (globalSettings.hoursRemaining * 60 * 60 * 1000));
      } else if (globalSettings.timerType === 'endTime' && globalSettings.endTime) {
        calculatedEndTime = new Date(globalSettings.endTime);
      }

      // First delete any existing settings
      await supabase.from('global_ai_settings').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Insert new settings
      const { error } = await supabase
        .from('global_ai_settings')
        .insert({
          enabled: globalSettings.enabled,
          mode: globalSettings.mode,
          end_time: calculatedEndTime?.toISOString() || null,
          hours_remaining: globalSettings.hoursRemaining,
          timer_type: globalSettings.timerType
        });

      if (error) {
        throw error;
      }

      // Invalidate cache to force refresh
      invalidateGlobalSettings();

      onToggle(globalSettings.enabled);
      setOpen(false);
      
      toast({
        title: "Global AI Settings Updated",
        description: `AI autopilot is now ${globalSettings.enabled ? 'ON' : 'OFF'}`,
      });
    } catch (error) {
      console.error('Error saving global AI settings:', error);
      toast({
        title: "Error",
        description: "Failed to save global AI settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getRemainingTime = () => {
    if (globalSettings.timerType === 'hours' && globalSettings.hoursRemaining > 0) {
      const now = new Date();
      const end = new Date(now.getTime() + (globalSettings.hoursRemaining * 60 * 60 * 1000));
      const diff = end.getTime() - now.getTime();
      
      if (diff <= 0) return 'Expired';
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      return `${hours}h ${minutes}m`;
    } else if (globalSettings.timerType === 'endTime' && globalSettings.endTime) {
      const now = new Date();
      const end = new Date(globalSettings.endTime);
      const diff = end.getTime() - now.getTime();
      
      if (diff <= 0) return 'Expired';
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      return `${hours}h ${minutes}m`;
    }
    
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`relative ${isActive ? 'text-green-500' : 'text-muted-foreground'}`}
          title="Global AI Assistant"
        >
          <Bot className="h-4 w-4" />
          {isActive && (
            <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full" />
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Global AI Assistant
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="global-ai">Enable Global AI Autopilot</Label>
            <Switch
              id="global-ai"
              checked={globalSettings.enabled}
              onCheckedChange={(checked) => 
                setGlobalSettings(prev => ({ ...prev, enabled: checked }))
              }
            />
          </div>

          {globalSettings.enabled && (
            <>
              <Card>
                <CardContent className="p-4 space-y-3">
                  <Label className="text-sm font-medium">AI Mode</Label>
                  <Select
                    value={globalSettings.mode}
                    onValueChange={(value) => 
                      setGlobalSettings(prev => ({ ...prev, mode: value }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4" />
                          <span>Auto (AI decides approach)</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="friendly_chat">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4" />
                          <span>Friendly Chat</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="intimate_flirt">
                        <div className="flex items-center gap-2">
                          <Heart className="h-4 w-4" />
                          <span>Intimate/Flirty</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {globalSettings.mode === 'auto' && (
                    <div className="text-xs text-muted-foreground">
                      AI will automatically adjust conversation style based on context
                    </div>
                  )}
                  {globalSettings.mode === 'friendly_chat' && (
                    <div className="text-xs text-muted-foreground">
                      Maintain a warm, friendly conversation tone
                    </div>
                  )}
                  {globalSettings.mode === 'intimate_flirt' && (
                    <div className="text-xs text-muted-foreground">
                      Use more intimate and flirtatious conversation style
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4" />
                    <Label className="text-sm font-medium">Timer Settings</Label>
                    <Badge variant="secondary" className="text-xs">Max 24 hours</Badge>
                  </div>
                  
                  <ToggleGroup
                    type="single"
                    value={globalSettings.timerType}
                    onValueChange={(value) => {
                      if (value) {
                        setGlobalSettings(prev => ({ ...prev, timerType: value as 'hours' | 'endTime' }));
                      }
                    }}
                    className="grid grid-cols-2 gap-2 w-full"
                  >
                    <ToggleGroupItem value="hours" className="flex items-center gap-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">Duration</span>
                    </ToggleGroupItem>
                    <ToggleGroupItem value="endTime" className="flex items-center gap-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm">End Time</span>
                    </ToggleGroupItem>
                  </ToggleGroup>
                  
                  {globalSettings.timerType === 'hours' && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Hours (1-24)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="24"
                        value={globalSettings.hoursRemaining}
                        onChange={(e) => 
                          setGlobalSettings(prev => ({ 
                            ...prev, 
                            hoursRemaining: Math.min(24, Math.max(0, parseInt(e.target.value) || 0))
                          }))
                        }
                        placeholder="Enter hours"
                        className="w-full"
                      />
                    </div>
                  )}

                  {globalSettings.timerType === 'endTime' && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Select end time</Label>
                      <Input
                        type="datetime-local"
                        value={globalSettings.endTime}
                        onChange={(e) => 
                          setGlobalSettings(prev => ({ ...prev, endTime: e.target.value }))
                        }
                        max={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}
                        className="w-full"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {(globalSettings.hoursRemaining > 0 || globalSettings.endTime) && (
                <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                      <Timer className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="font-medium text-green-700 dark:text-green-300">
                        Time remaining: {getRemainingTime()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          <div className="flex gap-2">
            <Button onClick={() => setOpen(false)} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={saveGlobalSettings} disabled={loading} className="flex-1">
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};