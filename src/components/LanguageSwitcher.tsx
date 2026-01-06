import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'fr' ? 'en' : 'fr');
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className="gap-1.5 text-xs font-medium"
      title={language === 'fr' ? 'Switch to English' : 'Passer en français'}
    >
      <Globe className="h-4 w-4" />
      <span className="uppercase">{language === 'fr' ? 'EN' : 'FR'}</span>
    </Button>
  );
}
