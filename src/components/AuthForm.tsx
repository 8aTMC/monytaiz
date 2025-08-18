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
  const [googleLoading, setGoogleLoading] = useState(false);
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
          variant: "success",
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

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/onboarding`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto bg-black/45 backdrop-blur-sm border-gray-600/30 shadow-2xl">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl font-bold text-white mb-2">
          {mode === 'signin' ? t('platform.auth.signIn') : t('platform.auth.signUp')}
        </CardTitle>
        <CardDescription className="text-gray-300 mb-4">
          {mode === 'signin' 
            ? 'Welcome back to the platform' 
            : 'Join the premium fan experience'
          }
        </CardDescription>
        
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <img 
            src="/lovable-uploads/1af55786-9032-497d-9c44-b99402ae6ff1.png" 
            alt="Monytaiz Logo" 
            className="w-80 h-20 object-contain"
          />
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="displayName" className="text-white">
                  Name
                </Label>
                <Input
                  id="displayName"
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => handleInputChange('displayName', e.target.value.slice(0, 20))}
                  className="bg-black/50 border-gray-600 text-white placeholder:text-gray-400"
                  maxLength={20}
                  placeholder="Your name"
                  title=""
                />
                <p className="text-xs text-gray-400">{formData.displayName.length}/20 characters</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="username" className="text-white">
                  {t('platform.auth.username')}
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value.slice(0, 20))}
                  className="bg-black/50 border-gray-600 text-white placeholder:text-gray-400"
                  maxLength={20}
                  title=""
                />
                <p className="text-xs text-gray-400">{formData.username.length}/20 characters</p>
              </div>
            </>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white">
              {t('platform.auth.email')}
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className="bg-black/50 border-gray-600 text-white placeholder:text-gray-400"
              title=""
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password" className="text-white">
              {t('platform.auth.password')}
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="|Password12345@~!"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="bg-black/50 border-gray-600 text-white placeholder:text-gray-400 pr-10"
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
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </Button>
            </div>
          </div>
          
          {mode === 'signup' && formData.password && (
            <div className="space-y-2">
              <Label className="text-white text-sm">Password Requirements</Label>
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
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3" 
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'signin' ? t('platform.auth.signIn') : t('platform.auth.createAccount')}
          </Button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-600" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-black/40 px-2 text-gray-400">OR CONTINUE WITH</span>
            </div>
          </div>
          
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleAuth}
            disabled={googleLoading}
            className="w-full mt-4 bg-gray-700/50 border-gray-600 hover:bg-gray-700/80 text-white"
          >
            {googleLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            {mode === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}
          </Button>
        </div>
        
        <div className="mt-6 text-center">
          <Button
            variant="link"
            onClick={() => onModeChange(mode === 'signin' ? 'signup' : 'signin')}
            className="text-purple-400 hover:text-purple-300"
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