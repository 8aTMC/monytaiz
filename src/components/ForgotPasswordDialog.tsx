import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/hooks/useTranslation';
import { Loader2, Mail, KeyRound, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ForgotPasswordDialog = ({ open, onOpenChange }: ForgotPasswordDialogProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'options' | 'email'>('options');
  const [selectedOption, setSelectedOption] = useState<'magic-link' | 'reset-password' | null>(null);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSendMagicLink = async () => {
    if (!validateEmail(email)) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Magic link sent! Please check your email to login.",
      });

      // Reset and close dialog
      setEmail('');
      setStep('options');
      setSelectedOption(null);
      onOpenChange(false);
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

  const handleSendPasswordReset = async () => {
    if (!validateEmail(email)) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Password reset email sent! Please check your email to reset your password.",
      });

      // Reset and close dialog
      setEmail('');
      setStep('options');
      setSelectedOption(null);
      onOpenChange(false);
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

  const handleOptionSelect = (option: 'magic-link' | 'reset-password') => {
    setSelectedOption(option);
    setStep('email');
  };

  const handleBack = () => {
    setStep('options');
    setSelectedOption(null);
    setEmail('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOption === 'magic-link') {
      handleSendMagicLink();
    } else if (selectedOption === 'reset-password') {
      handleSendPasswordReset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-black/45 backdrop-blur-sm border-gray-600/30">
        <DialogHeader>
          <DialogTitle className="text-white text-center">
            {step === 'options' ? 'Forgot Password?' : 'Enter Your Email'}
          </DialogTitle>
          <DialogDescription className="text-gray-300 text-center">
            {step === 'options' 
              ? 'Choose how you\'d like to recover your account'
              : selectedOption === 'magic-link'
                ? 'We\'ll send you a magic link to login instantly'
                : 'We\'ll send you instructions to reset your password'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'options' ? (
          <div className="space-y-4">
            <Card 
              className="bg-gray-800/50 border-gray-600/30 cursor-pointer hover:bg-gray-700/50 transition-colors"
              onClick={() => handleOptionSelect('magic-link')}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-3 text-base">
                  <div className="p-2 bg-purple-600/20 rounded-lg">
                    <Mail className="h-5 w-5 text-purple-400" />
                  </div>
                  Send Magic Link
                </CardTitle>
                <CardDescription className="text-gray-400 text-sm">
                  Get a secure login link sent to your email
                </CardDescription>
              </CardHeader>
            </Card>

            <Card 
              className="bg-gray-800/50 border-gray-600/30 cursor-pointer hover:bg-gray-700/50 transition-colors"
              onClick={() => handleOptionSelect('reset-password')}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-3 text-base">
                  <div className="p-2 bg-blue-600/20 rounded-lg">
                    <KeyRound className="h-5 w-5 text-blue-400" />
                  </div>
                  Reset Password
                </CardTitle>
                <CardDescription className="text-gray-400 text-sm">
                  Get instructions to create a new password
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-black/50 border-gray-600 text-white placeholder:text-gray-400"
                required
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="flex-1 bg-gray-700/50 border-gray-600 hover:bg-gray-700/80 text-white"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              
              <Button 
                type="submit" 
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium" 
                disabled={loading || !email.trim()}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selectedOption === 'magic-link' ? 'Send Magic Link' : 'Send Reset Email'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};