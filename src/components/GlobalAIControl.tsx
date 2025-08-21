import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Bot, Clock, Timer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
      const { data, error } = await supabase
        .from('global_ai_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setGlobalSettings({
          enabled: data.enabled,
          mode: data.mode,
          endTime: data.end_time || '',
          hoursRemaining: data.hours_remaining || 0,
          timerType: data.timer_type || 'hours'
        });
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

      const { error } = await supabase
        .from('global_ai_settings')
        .upsert({
          enabled: globalSettings.enabled,
          mode: globalSettings.mode,
          end_time: calculatedEndTime?.toISOString(),
          hours_remaining: globalSettings.hoursRemaining,
          timer_type: globalSettings.timerType,
          updated_at: now.toISOString()
        });

      if (error) throw error;

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
    if (!globalSettings.endTime) return null;
    
    const now = new Date();
    const end = new Date(globalSettings.endTime);
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
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
              <div className="space-y-2">
                <Label>AI Mode</Label>
                <Select
                  value={globalSettings.mode}
                  onValueChange={(value) => 
                    setGlobalSettings(prev => ({ ...prev, mode: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (AI decides approach)</SelectItem>
                    <SelectItem value="friendly_chat">Friendly Chat</SelectItem>
                    <SelectItem value="intimate_flirt">Intimate/Flirty</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Timer Settings (Max 24 hours)</Label>
                
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="timer-hours"
                    name="timerType"
                    checked={globalSettings.timerType === 'hours'}
                    onChange={() => setGlobalSettings(prev => ({ ...prev, timerType: 'hours' }))}
                  />
                  <Label htmlFor="timer-hours" className="flex-1">Set duration (hours)</Label>
                </div>
                
                {globalSettings.timerType === 'hours' && (
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
                    placeholder="Hours (1-24)"
                  />
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="timer-endtime"
                    name="timerType"
                    checked={globalSettings.timerType === 'endTime'}
                    onChange={() => setGlobalSettings(prev => ({ ...prev, timerType: 'endTime' }))}
                  />
                  <Label htmlFor="timer-endtime" className="flex-1">Set end time</Label>
                </div>
                
                {globalSettings.timerType === 'endTime' && (
                  <Input
                    type="datetime-local"
                    value={globalSettings.endTime}
                    onChange={(e) => 
                      setGlobalSettings(prev => ({ ...prev, endTime: e.target.value }))
                    }
                    max={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}
                  />
                )}
              </div>

              {(globalSettings.hoursRemaining > 0 || globalSettings.endTime) && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <Timer className="h-4 w-4" />
                    <span>Remaining: {getRemainingTime()}</span>
                  </div>
                </div>
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