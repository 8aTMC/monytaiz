import { GeneralSettingsDialog } from '@/components/GeneralSettingsDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Image } from 'lucide-react';

export default function GeneralSettings() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">General Settings</h1>
          <p className="text-muted-foreground">Configure your application's general settings and branding.</p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Logo Management
            </CardTitle>
            <CardDescription>
              Upload and manage your application logos for different themes and menu states.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GeneralSettingsDialog>
              <div className="text-left">
                <h3 className="font-medium mb-2">Logo Configuration</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Click to configure logos for expanded/collapsed menu states in both light and dark themes.
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-md hover:bg-muted/80 cursor-pointer transition-colors">
                  <Settings className="h-4 w-4" />
                  <span className="text-sm font-medium">Configure Logos</span>
                </div>
              </div>
            </GeneralSettingsDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}