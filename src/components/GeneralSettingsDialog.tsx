import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Upload, RotateCcw, Image } from 'lucide-react';
import { useLogoSettings } from '@/hooks/useLogoSettings';
import { Badge } from '@/components/ui/badge';

interface GeneralSettingsDialogProps {
  children?: React.ReactNode;
}

export const GeneralSettingsDialog = ({ children }: GeneralSettingsDialogProps) => {
  const [open, setOpen] = useState(false);
  const { settings, loading, uploading, uploadLogo, resetLogo } = useLogoSettings();

  const logoTypes = [
    {
      key: 'expanded_dark_logo_url' as const,
      title: 'Expanded Menu Dark Theme Logo',
      description: 'Logo shown when menu is expanded in dark theme (~200x50px)',
      badge: 'Dark • Expanded'
    },
    {
      key: 'expanded_light_logo_url' as const,
      title: 'Expanded Menu Light Theme Logo',
      description: 'Logo shown when menu is expanded in light theme (~200x50px)',
      badge: 'Light • Expanded'
    },
    {
      key: 'collapsed_dark_logo_url' as const,
      title: 'Collapsed Menu Dark Theme Logo',
      description: 'Logo shown when menu is collapsed in dark theme (~40x40px)',
      badge: 'Dark • Collapsed'
    },
    {
      key: 'collapsed_light_logo_url' as const,
      title: 'Collapsed Menu Light Theme Logo',
      description: 'Logo shown when menu is collapsed in light theme (~40x40px)',
      badge: 'Light • Collapsed'
    }
  ];

  const handleFileUpload = async (file: File, logoType: keyof typeof settings) => {
    if (!file.type.startsWith('image/')) {
      return;
    }
    await uploadLogo(file, logoType);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            General Settings
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            General Settings
          </DialogTitle>
          <DialogDescription>
            Configure your application logos for different themes and menu states.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid gap-6 md:grid-cols-2">
            {logoTypes.map((logoType) => (
              <Card key={logoType.key} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-sm font-medium">
                        {logoType.title}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {logoType.description}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {logoType.badge}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Current Logo Preview */}
                  {settings[logoType.key] && (
                    <div className="flex items-center justify-center p-4 border rounded-lg bg-muted/50">
                      <img
                        src={settings[logoType.key]}
                        alt={logoType.title}
                        className={`max-h-12 max-w-full object-contain ${
                          logoType.key.includes('collapsed') ? 'h-8 w-8' : 'h-12'
                        }`}
                      />
                    </div>
                  )}

                  {/* Upload Section */}
                  <div className="space-y-2">
                    <Label htmlFor={`logo-${logoType.key}`} className="text-xs font-medium">
                      Upload New Logo
                    </Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id={`logo-${logoType.key}`}
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFileUpload(file, logoType.key);
                            }
                          }}
                          disabled={uploading[logoType.key]}
                          className="text-xs"
                        />
                        {uploading[logoType.key] && (
                          <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-md">
                            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                          </div>
                        )}
                      </div>
                      
                      {settings[logoType.key] && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resetLogo(logoType.key)}
                          disabled={uploading[logoType.key]}
                          className="px-3"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                    <div className="flex items-start gap-1">
                      <Image className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Recommended:</strong> PNG or SVG format, 
                        {logoType.key.includes('collapsed') ? ' square aspect ratio' : ' landscape format'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Changes take effect immediately. If no custom logo is uploaded, the default logo will be displayed.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};