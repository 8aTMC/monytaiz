import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, Settings, Upload, Edit, Mail, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';

interface UserProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
}

interface UserRole {
  role: string;
}

export const MyAccount = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<string>('fan');
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

      // Fetch profile data
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error loading profile:', error);
        return;
      }

      // Fetch user role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      setProfile(data);
      setUserRole(roleData?.role || 'fan');
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

      // Create file path in the new structure: images/user_id/filename
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `images/${user.id}/${fileName}`;

      // Upload to content bucket
      const { error: uploadError } = await supabase.storage
        .from('content')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Create file metadata record
      const { error: metadataError } = await supabase
        .from('files')
        .insert({
          creator_id: user.id,
          file_path: filePath,
          file_type: 'image',
          original_filename: file.name,
          file_size: file.size,
          mime_type: file.type,
          title: 'Avatar',
          description: 'User profile avatar',
          fan_access_level: 'free'
        });

      if (metadataError) {
        console.error('Error creating file metadata:', metadataError);
      }

      // Get signed URL for the uploaded file
      const { data: signedUrlData } = await supabase.storage
        .from('content')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year expiry

      const avatarUrl = signedUrlData?.signedUrl;

      if (avatarUrl) {
        // Update profile with new avatar URL
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: avatarUrl })
          .eq('id', user.id);

        if (updateError) {
          throw updateError;
        }

        setProfile(prev => prev ? { ...prev, avatar_url: avatarUrl } : null);

        toast({
          title: t('account.success', 'Success'),
          description: t('account.avatarUpdated', 'Profile picture updated successfully.'),
        });
      }
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
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-muted rounded w-1/4"></div>
        <div className="h-10 bg-muted rounded"></div>
        <div className="h-10 bg-muted rounded"></div>
        <div className="h-20 bg-muted rounded"></div>
      </div>
    );
  }

  const getRoleDisplayName = (role: string) => {
    const roleNames: Record<string, string> = {
      'creator': 'Creator',
      'admin': 'Admin',
      'superadmin': 'Super Admin',
      'moderator': 'Moderator',
      'manager': 'Manager',
      'chatter': 'Chatter',
      'agency': 'Agency',
      'fan': 'Fan'
    };
    return roleNames[role] || 'Fan';
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      'creator': 'bg-purple-100 text-purple-800 border-purple-200',
      'admin': 'bg-red-100 text-red-800 border-red-200',
      'superadmin': 'bg-red-100 text-red-800 border-red-200',
      'moderator': 'bg-orange-100 text-orange-800 border-orange-200',
      'manager': 'bg-blue-100 text-blue-800 border-blue-200',
      'chatter': 'bg-green-100 text-green-800 border-green-200',
      'agency': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'fan': 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[role] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  if (!isEditing) {
    return (
      <div className="space-y-8 animate-fade-in">
        {/* Header Section */}
        <div className="flex items-center justify-between p-6 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl border border-primary/10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {t('account.title', 'My Account')}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Manage your profile information
                </p>
              </div>
            </div>
            <Badge 
              variant="secondary" 
              className={`ml-4 ${getRoleBadgeColor(userRole)} border-0 shadow-sm`}
            >
              {getRoleDisplayName(userRole)}
            </Badge>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={handleEdit} className="hover-scale">
              <Edit className="h-4 w-4 mr-2" />
              {t('account.edit', 'Edit')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleChangeEmail} className="hover-scale">
              <Mail className="h-4 w-4 mr-2" />
              {t('account.changeEmail', 'Change Email')}
            </Button>
          </div>
        </div>

        {/* Avatar Section */}
        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <div className="relative group">
                <Avatar className="h-24 w-24 border-4 border-primary/10 shadow-lg">
                  <AvatarImage src={profile?.avatar_url || ''} className="object-cover" />
                  <AvatarFallback className="text-xl font-semibold bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
                    {profile?.display_name?.[0] || profile?.username?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                  <Camera className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="text-2xl font-bold text-foreground">
                  {profile?.display_name || profile?.username || 'Anonymous User'}
                </h3>
                <p className="text-muted-foreground">
                  @{profile?.username || 'username'}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-muted-foreground">Active</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                  <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    {t('account.username', 'Username')}
                  </label>
                </div>
                <p className="text-lg font-medium text-foreground">
                  {profile?.username || 'Not set'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-purple-500 rounded-full"></div>
                  <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    {t('account.displayName', 'Display Name')}
                  </label>
                </div>
                <p className="text-lg font-medium text-foreground">
                  {profile?.display_name || 'Not set'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bio Section */}
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-amber-500 rounded-full"></div>
                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  {t('account.bio', 'Bio')}
                </label>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 min-h-[100px] border border-muted/50">
                <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                  {profile?.bio || (
                    <span className="text-muted-foreground italic">
                      Tell us about yourself...
                    </span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Edit Mode Header */}
      <div className="flex items-center justify-between p-6 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl border border-primary/10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {t('account.editing', 'Editing Profile')}
            </h2>
            <p className="text-sm text-muted-foreground">
              Make changes to your profile information
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving || uploading}>
            {t('account.cancel', 'Cancel')}
          </Button>
          <Button size="sm" onClick={handleSaveAndExit} disabled={saving || uploading} className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
            <Settings className="h-4 w-4 mr-2" />
            {saving ? t('account.saving', 'Saving...') : t('account.save', 'Save Changes')}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-8 space-y-8">
          {/* Avatar Upload Section */}
          <div className="flex flex-col items-center gap-6">
            <div className="relative group">
              <Avatar className="h-32 w-32 border-4 border-primary/20 shadow-xl">
                <AvatarImage src={profile?.avatar_url || ''} className="object-cover" />
                <AvatarFallback className="text-2xl font-semibold bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
                  {profile?.display_name?.[0] || profile?.username?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center">
                <Camera className="h-8 w-8 text-white" />
              </div>
            </div>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="hover-scale bg-gradient-to-r from-background to-muted border-2 border-primary/20 hover:border-primary/40"
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? t('account.uploading', 'Uploading...') : t('account.uploadAvatar', 'Change Avatar')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={uploadAvatar}
              className="hidden"
            />
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                {t('account.username', 'Username')}
              </label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                placeholder={t('account.usernamePlaceholder', 'Enter your username')}
                className="h-12 border-2 border-muted focus:border-primary transition-colors"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <div className="h-2 w-2 bg-purple-500 rounded-full"></div>
                {t('account.displayName', 'Display Name')}
              </label>
              <Input
                value={formData.display_name}
                onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                placeholder={t('account.displayNamePlaceholder', 'Enter your display name')}
                className="h-12 border-2 border-muted focus:border-primary transition-colors"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <div className="h-2 w-2 bg-amber-500 rounded-full"></div>
              {t('account.bio', 'Bio')}
            </label>
            <Textarea
              value={formData.bio}
              onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
              placeholder={t('account.bioPlaceholder', 'Tell us about yourself...')}
              className="min-h-[120px] border-2 border-muted focus:border-primary transition-colors resize-none"
              maxLength={500}
            />
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-full bg-muted rounded-full max-w-[200px]">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((formData.bio.length / 500) * 100, 100)}%` }}
                  ></div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formData.bio.length}/500
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};