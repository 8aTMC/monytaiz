import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Save, User } from 'lucide-react';
import { AvatarCropper } from '@/components/AvatarCropper';

interface CreatorProfile {
  id: string;
  display_name: string;
  username?: string;
  bio?: string;
  avatar_url?: string;
  banner_url?: string;
  website_url?: string;
  social_links?: any;
  is_active: boolean;
}

interface CreatorProfileDialogProps {
  children: React.ReactNode;
}

export const CreatorProfileDialog = ({ children }: CreatorProfileDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfile | null>(null);
  const [formData, setFormData] = useState({
    display_name: '',
    username: '',
    bio: '',
    avatar_url: '',
    banner_url: '',
    website_url: ''
  });

  useEffect(() => {
    if (open) {
      loadCreatorProfile();
    }
  }, [open]);

  const loadCreatorProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('creator_profile')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setCreatorProfile(data);
        setFormData({
          display_name: data.display_name || '',
          username: data.username || '',
          bio: data.bio || '',
          avatar_url: data.avatar_url || '',
          banner_url: data.banner_url || '',
          website_url: data.website_url || ''
        });
      } else {
        // No creator profile exists yet
        setCreatorProfile(null);
        setFormData({
          display_name: '',
          username: '',
          bio: '',
          avatar_url: '',
          banner_url: '',
          website_url: ''
        });
      }
    } catch (error) {
      console.error('Error loading creator profile:', error);
      toast({
        title: "Error",
        description: "Failed to load creator profile",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!formData.display_name.trim()) {
      toast({
        title: "Error",
        description: "Display name is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (creatorProfile) {
        // Update existing profile
        const { error } = await supabase
          .from('creator_profile')
          .update({
            display_name: formData.display_name.trim(),
            username: formData.username.trim() || null,
            bio: formData.bio.trim() || null,
            avatar_url: formData.avatar_url.trim() || null,
            banner_url: formData.banner_url.trim() || null,
            website_url: formData.website_url.trim() || null,
          })
          .eq('id', creatorProfile.id);

        if (error) throw error;
      } else {
        // Create new profile
        const { error } = await supabase
          .from('creator_profile')
          .insert({
            display_name: formData.display_name.trim(),
            username: formData.username.trim() || null,
            bio: formData.bio.trim() || null,
            avatar_url: formData.avatar_url.trim() || null,
            banner_url: formData.banner_url.trim() || null,
            website_url: formData.website_url.trim() || null,
            created_by: user.id
          });

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Creator profile ${creatorProfile ? 'updated' : 'created'} successfully`,
      });

      setOpen(false);
      loadCreatorProfile();
    } catch (error) {
      console.error('Error saving creator profile:', error);
      toast({
        title: "Error",
        description: `Failed to ${creatorProfile ? 'update' : 'create'} creator profile`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {creatorProfile ? 'Edit Creator Profile' : 'Create Creator Profile'}
          </DialogTitle>
          <DialogDescription>
            Configure the creator/model profile that fans will interact with. All fan messages will be addressed to this creator.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Avatar Upload with Cropping */}
          <AvatarCropper
            currentAvatarUrl={formData.avatar_url}
            onAvatarChange={(url) => handleInputChange('avatar_url', url)}
            fallbackText={formData.display_name}
          />

          {/* Display Name */}
          <div>
            <Label htmlFor="display_name">
              Display Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="display_name"
              value={formData.display_name}
              onChange={(e) => handleInputChange('display_name', e.target.value)}
              placeholder="Creator display name"
              className="mt-1"
            />
          </div>

          {/* Username */}
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              placeholder="@username"
              className="mt-1"
            />
          </div>

          {/* Bio */}
          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              placeholder="Tell fans about the creator..."
              className="mt-1"
              rows={3}
            />
          </div>

          {/* Banner URL */}
          <div>
            <Label htmlFor="banner_url">Banner URL</Label>
            <Input
              id="banner_url"
              value={formData.banner_url}
              onChange={(e) => handleInputChange('banner_url', e.target.value)}
              placeholder="https://example.com/banner.jpg"
              className="mt-1"
            />
          </div>

          {/* Website URL */}
          <div>
            <Label htmlFor="website_url">Website URL</Label>
            <Input
              id="website_url"
              value={formData.website_url}
              onChange={(e) => handleInputChange('website_url', e.target.value)}
              placeholder="https://creator-website.com"
              className="mt-1"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : creatorProfile ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};