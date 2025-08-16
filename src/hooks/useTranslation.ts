import { useState, useEffect } from 'react';

interface Translation {
  [key: string]: any;
}

export const useTranslation = () => {
  const [translations, setTranslations] = useState<Translation>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const response = await fetch('/locales/en.json');
        const data = await response.json();
        setTranslations(data);
      } catch (error) {
        console.error('Error loading translations:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTranslations();
  }, []);

  const t = (key: string, fallback?: string): string => {
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return fallback || key;
      }
    }
    
    return typeof value === 'string' ? value : fallback || key;
  };

  return { t, loading };
};