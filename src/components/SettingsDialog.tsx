import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Settings } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface SettingsDialogProps {
  children: React.ReactNode;
}

export const SettingsDialog = ({ children }: SettingsDialogProps) => {
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-background border border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Theme Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Theme</Label>
            <div className="flex gap-3">
              <Button
                variant={resolvedTheme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleThemeChange('light')}
                className="flex-1 flex items-center gap-2"
              >
                <div className="w-4 h-4 rounded-full bg-gradient-to-r from-sky-300 via-sky-400 to-blue-500 border border-sky-200"></div>
                Light
              </Button>
              <Button
                variant={resolvedTheme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleThemeChange('dark')}
                className="flex-1 flex items-center gap-2"
              >
                <div className="w-4 h-4 rounded-full bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 border border-slate-600"></div>
                Dark
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};