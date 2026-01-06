import { useSearchParams, useNavigate } from 'react-router-dom';
import { HousekeeperGuestMode } from '@/components/HousekeeperGuestMode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building, Key, ArrowRight } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { useTranslation } from '@/contexts/LanguageContext';

/**
 * Page unifiée pour le mode invité
 * - Détecte automatiquement si c'est un invité admin ou femme de chambre
 * - Redirige vers l'interface appropriée
 */
const GuestMode = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { translations: t, language } = useTranslation();
  const accessCode = searchParams.get('code');

  // Si un code d'accès est fourni, afficher l'interface femme de chambre
  if (accessCode) {
    return <HousekeeperGuestMode accessCode={accessCode} />;
  }

  // Sinon, afficher la page d'accueil du mode invité
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-4xl font-bold">
                {language === 'en' ? 'Guest Mode' : 'Mode Invité'}
              </h1>
              <p className="text-muted-foreground mt-2">
                {language === 'en' 
                  ? 'Quickly access your workspace' 
                  : 'Accédez rapidement à votre espace de travail'}
              </p>
            </div>
          </div>

          {/* Options */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Option Admin */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/auth')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-6 w-6 text-primary" />
                  {t.guestMode.hotelManager}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  {language === 'en' 
                    ? 'Manage your hotels, rooms and teams from your dashboard'
                    : 'Gérez vos hôtels, chambres et équipes depuis votre tableau de bord'}
                </p>
                <Button className="w-full" onClick={() => navigate('/auth')}>
                  {t.auth.signIn}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            {/* Option Femme de chambre */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/housekeeper/login')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-6 w-6 text-primary" />
                  {t.guestMode.housekeeper}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  {language === 'en'
                    ? 'Access your daily tasks with your access code'
                    : 'Accédez à vos tâches quotidiennes avec votre code d\'accès'}
                </p>
                <Button className="w-full" onClick={() => navigate('/housekeeper/login')}>
                  {language === 'en' ? 'Enter code' : 'Entrer le code'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Info */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground text-center">
                {language === 'en' 
                  ? 'Guest mode allows you to quickly access your workspace without creating an account.'
                  : 'Le mode invité vous permet d\'accéder rapidement à votre espace sans créer de compte.'}
                <br />
                {language === 'en'
                  ? 'For full and secure access, please log in.'
                  : 'Pour un accès complet et sécurisé, veuillez vous connecter.'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default GuestMode;