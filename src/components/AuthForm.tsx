import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/hooks/useTranslation';
import { Loader2, Eye, EyeOff, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AuthFormProps {
  mode: 'signin' | 'signup';
  onModeChange: (mode: 'signin' | 'signup') => void;
}

export const AuthForm = ({ mode, onModeChange }: AuthFormProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    displayName: '',
  });

  // Validation functions
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateUsername = (username: string) => {
    return !username.includes(' ');
  };

  const getPasswordRules = (password: string) => {
    return {
      length: password.length >= 8 && password.length <= 19,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      symbol: /[~!@#$%^&*()_\-+={\[}\]|\\:;"'<,>.?/]/.test(password),
    };
  };

  const isPasswordValid = (password: string) => {
    const rules = getPasswordRules(password);
    return Object.values(rules).every(Boolean);
  };

  const validateForm = () => {
    // Check required fields
    if (mode === 'signup' && !formData.displayName.trim()) {
      toast({
        title: "Error",
        description: t('platform.validation.nameRequired'),
        variant: "destructive",
      });
      return false;
    }

    if (mode === 'signup' && !formData.username.trim()) {
      toast({
        title: "Error", 
        description: t('platform.validation.usernameRequired'),
        variant: "destructive",
      });
      return false;
    }

    if (!formData.email.trim()) {
      toast({
        title: "Error",
        description: t('platform.validation.emailRequired'),
        variant: "destructive",
      });
      return false;
    }

    if (!formData.password.trim()) {
      toast({
        title: "Error",
        description: t('platform.validation.passwordRequired'),
        variant: "destructive",
      });
      return false;
    }

    if (mode === 'signup') {
      // Validate email
      if (!validateEmail(formData.email)) {
        toast({
          title: "Error",
          description: t('platform.validation.invalidEmail'),
          variant: "destructive",
        });
        return false;
      }

      // Validate username
      if (!validateUsername(formData.username)) {
        toast({
          title: "Error",
          description: t('platform.validation.usernameNoSpaces'),
          variant: "destructive",
        });
        return false;
      }

      // Validate password
      if (!isPasswordValid(formData.password)) {
        toast({
          title: "Error",
          description: t('platform.validation.passwordNotValid'),
          variant: "destructive",
        });
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signup') {

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
                <Label htmlFor="displayName" className="text-foreground">
                  Name
                </Label>
                <Input
                  id="displayName"
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => handleInputChange('displayName', e.target.value.slice(0, 20))}
                  className="bg-input border-border text-foreground"
                  maxLength={20}
                  placeholder="Your name"
                  title=""
                />
                <p className="text-xs text-muted-foreground">{formData.displayName.length}/20 characters</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="username" className="text-foreground">
                  {t('platform.auth.username')}
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value.slice(0, 20))}
                  className="bg-input border-border text-foreground"
                  maxLength={20}
                  title=""
                />
                <p className="text-xs text-muted-foreground">{formData.username.length}/20 characters</p>
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
              placeholder="your@email.com"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className="bg-input border-border text-foreground"
              title=""
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground">
              {t('platform.auth.password')}
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="|Password12345@~!"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="bg-input border-border text-foreground pr-10"
                title=""
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
          
          {mode === 'signup' && formData.password && (
            <div className="space-y-2">
              <Label className="text-foreground text-sm">Password Requirements</Label>
              <div className="space-y-1">
                {Object.entries({
                  'Between 8-19 characters': getPasswordRules(formData.password).length,
                  'At least 1 uppercase letter': getPasswordRules(formData.password).uppercase,
                  'At least 1 lowercase letter': getPasswordRules(formData.password).lowercase,
                  'At least 1 number': getPasswordRules(formData.password).number,
                  'At least 1 symbol (~!@#$%^&*()_-+={[}]|\\:;"\'<,>.?/)': getPasswordRules(formData.password).symbol,
                }).map(([rule, isValid]) => (
                  <div key={rule} className="flex items-center gap-2">
                    {isValid ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <X className="h-3 w-3 text-red-500" />
                    )}
                    <span className={`text-xs ${isValid ? 'text-green-600' : 'text-red-600'}`}>
                      {rule}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mode === 'signup' && formData.email && !validateEmail(formData.email) && (
            <div className="text-xs text-red-600">
              {t('platform.validation.invalidEmail')}
            </div>
          )}

          {mode === 'signup' && formData.username && !validateUsername(formData.username) && (
            <div className="text-xs text-red-600">
              {t('platform.validation.usernameNoSpaces')}
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