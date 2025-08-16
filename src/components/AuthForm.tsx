import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/hooks/useTranslation';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AuthFormProps {
  mode: 'signin' | 'signup';
  onModeChange: (mode: 'signin' | 'signup') => void;
}

export const AuthForm = ({ mode, onModeChange }: AuthFormProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    displayName: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (formData.password !== formData.confirmPassword) {
          toast({
            title: "Error",
            description: "Passwords don't match",
            variant: "destructive",
          });
          return;
        }

        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              username: formData.username,
              display_name: formData.displayName,
            },
          },
        });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Account created successfully! Please check your email to verify your account.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Signed in successfully!",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="w-full max-w-md mx-auto bg-gradient-card border-border shadow-card">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-foreground">
          {mode === 'signin' ? t('platform.auth.signIn') : t('platform.auth.signUp')}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {mode === 'signin' 
            ? 'Welcome back to the platform' 
            : 'Join the premium fan experience'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="username" className="text-foreground">
                  {t('platform.auth.username')}
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  required
                  className="bg-input border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName" className="text-foreground">
                  {t('platform.auth.displayName')}
                </Label>
                <Input
                  id="displayName"
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => handleInputChange('displayName', e.target.value)}
                  required
                  className="bg-input border-border text-foreground"
                />
              </div>
            </>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">
              {t('platform.auth.email')}
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              required
              className="bg-input border-border text-foreground"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground">
              {t('platform.auth.password')}
            </Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              required
              className="bg-input border-border text-foreground"
            />
          </div>
          
          {mode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground">
                {t('platform.auth.confirmPassword')}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                required
                className="bg-input border-border text-foreground"
              />
            </div>
          )}
          
          <Button 
            type="submit" 
            className="w-full" 
            variant="hero"
            size="lg"
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'signin' ? t('platform.auth.signIn') : t('platform.auth.createAccount')}
          </Button>
        </form>
        
        <div className="mt-6 text-center">
          <Button
            variant="link"
            onClick={() => onModeChange(mode === 'signin' ? 'signup' : 'signin')}
            className="text-primary hover:text-primary-glow"
          >
            {mode === 'signin' 
              ? t('platform.auth.dontHaveAccount') 
              : t('platform.auth.alreadyHaveAccount')
            }
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};