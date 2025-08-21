import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Settings } from 'lucide-react';

interface SettingsDialogProps {
  children: React.ReactNode;
}

export const SettingsDialog = ({ children }: SettingsDialogProps) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      setTheme('dark');
    }
  }, []);

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
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
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleThemeChange('light')}
                className="flex-1 flex items-center gap-2"
              >
                <div className="w-4 h-4 rounded-full bg-gradient-to-r from-sky-300 via-sky-400 to-blue-500 border border-sky-200"></div>
                Light
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
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