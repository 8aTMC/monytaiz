import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { User, Session } from '@supabase/supabase-js';
import { Sparkles, Heart, DollarSign, Users, ArrowRight } from 'lucide-react';

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleEnterPlatform = () => {
    if (user) {
      navigate('/platform');
    } else {
      navigate('/auth');
    }
  };

  const features = [
    {
      icon: Sparkles,
      title: t('landing.features.content.title'),
      description: t('landing.features.content.description'),
    },
    {
      icon: DollarSign,
      title: t('landing.features.monetization.title'),
      description: t('landing.features.monetization.description'),
    },
    {
      icon: Users,
      title: t('landing.features.community.title'),
      description: t('landing.features.community.description'),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-10" />
        <div className="relative container mx-auto px-4 py-24 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold bg-gradient-hero bg-clip-text text-transparent mb-6">
              {t('landing.hero.title')}
            </h1>
            <p className="text-xl md:text-2xl text-primary font-semibold mb-4">
              {t('landing.hero.subtitle')}
            </p>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              {t('landing.hero.description')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                variant="premium" 
                size="xl" 
                onClick={handleEnterPlatform}
                className="group"
              >
                {t('landing.hero.cta')}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="glass" size="xl">
                {t('landing.hero.learnMore')}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-gradient-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t('landing.features.title')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('landing.features.subtitle')}
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="bg-card border border-border rounded-xl p-8 shadow-card hover:shadow-glow transition-smooth group"
              >
                <div className="bg-gradient-primary p-3 rounded-lg w-fit mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">
            {t('landing.footer.copyright')}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
