import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LogoSettings {
  id?: string;
  expanded_dark_logo_url?: string;
  expanded_light_logo_url?: string;
  collapsed_dark_logo_url?: string;
  collapsed_light_logo_url?: string;
}

export const useLogoSettings = () => {
  const [settings, setSettings] = useState<LogoSettings>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  // Fetch current logo settings
  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('general_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching logo settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Upload logo to storage and update database
  const uploadLogo = async (file: File, logoType: keyof LogoSettings) => {
    if (!file) return null;

    setUploading(prev => ({ ...prev, [logoType]: true }));

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${logoType}_${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath);

      // Update or insert settings
      const updateData = { [logoType]: publicUrl };
      
      if (settings.id) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('general_settings')
          .update(updateData)
          .eq('id', settings.id);

        if (updateError) throw updateError;
      } else {
        // Create new record
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) throw new Error('User not authenticated');

        const { data, error: insertError } = await supabase
          .from('general_settings')
          .insert({
            ...updateData,
            created_by: user.user.id
          })
          .select()
          .single();

        if (insertError) throw insertError;
        if (data) setSettings(data);
      }

      // Update local state
      setSettings(prev => ({ ...prev, [logoType]: publicUrl }));

      toast({
        title: "Logo uploaded successfully",
        description: `${logoType.replace(/_/g, ' ')} has been updated.`,
      });

      return publicUrl;
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Upload failed",
        description: "There was an error uploading the logo. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(prev => ({ ...prev, [logoType]: false }));
    }
  };

  // Reset logo to default (remove from database)
  const resetLogo = async (logoType: keyof LogoSettings) => {
    if (!settings.id) return;

    try {
      const { error } = await supabase
        .from('general_settings')
        .update({ [logoType]: null })
        .eq('id', settings.id);

      if (error) throw error;

      setSettings(prev => ({ ...prev, [logoType]: undefined }));

      toast({
        title: "Logo reset",
        description: `${logoType.replace(/_/g, ' ')} has been reset to default.`,
      });
    } catch (error) {
      console.error('Error resetting logo:', error);
      toast({
        title: "Reset failed",
        description: "There was an error resetting the logo.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    loading,
    uploading,
    uploadLogo,
    resetLogo,
    refetch: fetchSettings
  };
};