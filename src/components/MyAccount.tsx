import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Settings, Upload, Edit, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';

interface UserProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
}

export const MyAccount = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    display_name: '',
    bio: ''
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error loading profile:', error);
        return;
      }

      setProfile(data);
      setFormData({
        username: data.username || '',
        display_name: data.display_name || '',
        bio: data.bio || ''
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      
      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: t('account.error', 'Error'),
          description: t('account.notAuthenticated', 'You must be logged in to upload an avatar.'),
          variant: 'destructive',
        });
        return;
      }

      const fileName = `${user.id}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      setProfile(prev => prev ? { ...prev, avatar_url: data.publicUrl } : null);

      toast({
        title: t('account.success', 'Success'),
        description: t('account.avatarUpdated', 'Profile picture updated successfully.'),
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: t('account.error', 'Error'),
        description: t('account.avatarError', 'Failed to upload profile picture. Please try again.'),
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: formData.username || null,
          display_name: formData.display_name || null,
          bio: formData.bio || null
        })
        .eq('id', profile.id);

      if (error) {
        throw error;
      }

      setProfile(prev => prev ? {
        ...prev,
        username: formData.username || null,
        display_name: formData.display_name || null,
        bio: formData.bio || null
      } : null);

      toast({
        title: t('account.success', 'Profile updated successfully'),
        description: t('account.successDesc', 'Your profile has been saved.'),
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: t('account.error', 'Error'),
        description: t('account.errorDesc', 'Failed to update profile. Please try again.'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChangeEmail = async () => {
    toast({
      title: t('account.changeEmail', 'Change Email'),
      description: t('account.changeEmailDesc', 'Email change functionality will be implemented soon.'),
    });
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset form data to original profile data
    setFormData({
      username: profile?.username || '',
      display_name: profile?.display_name || '',
      bio: profile?.bio || ''
    });
  };

  const handleSaveAndExit = async () => {
    await handleSave();
    setIsEditing(false);
  };
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t('account.title', 'My Account')}
          </CardTitle>
          <div className="flex gap-2">
            {!isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={handleEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  {t('account.edit', 'Edit')}
                </Button>
                <Button variant="outline" size="sm" onClick={handleChangeEmail}>
                  <Mail className="h-4 w-4 mr-2" />
                  {t('account.changeEmail', 'Change Email')}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  {t('account.cancel', 'Cancel')}
                </Button>
                <Button size="sm" onClick={handleSaveAndExit} disabled={saving || uploading}>
                  <Settings className="h-4 w-4 mr-2" />
                  {saving ? t('account.saving', 'Saving...') : t('account.save', 'Save Changes')}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar Section */}
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback>
              {profile?.display_name?.[0] || profile?.username?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !isEditing}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? t('account.uploading', 'Uploading...') : t('account.uploadAvatar', 'Upload Avatar')}
            </Button>
            {!isEditing && (
              <p className="text-xs text-muted-foreground">
                {t('account.editToUpload', 'Click Edit to change avatar')}
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={uploadAvatar}
              className="hidden"
            />
          </div>
        </div>

        {/* Profile Form */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">
              {t('account.username', 'Username')}
            </label>
            <Input
              value={formData.username}
              onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
              placeholder={t('account.usernamePlaceholder', 'Enter your username')}
              className="mt-1"
              readOnly={!isEditing}
              disabled={!isEditing}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">
              {t('account.displayName', 'Display Name')}
            </label>
            <Input
              value={formData.display_name}
              onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
              placeholder={t('account.displayNamePlaceholder', 'Enter your display name')}
              className="mt-1"
              readOnly={!isEditing}
              disabled={!isEditing}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">
              {t('account.bio', 'Bio')}
            </label>
            <Textarea
              value={formData.bio}
              onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
              placeholder={t('account.bioPlaceholder', 'Tell us about yourself...')}
              className="mt-1 min-h-[100px]"
              maxLength={500}
              readOnly={!isEditing}
              disabled={!isEditing}
            />
            {isEditing && (
              <p className="text-xs text-muted-foreground mt-1">
                {formData.bio.length}/500 {t('account.characters', 'characters')}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};