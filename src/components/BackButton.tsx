import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';

export function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  // Ne pas afficher le bouton sur la page d'accueil
  if (location.pathname === '/') {
    return null;
  }

  const handleBack = () => {
    // Si on peut revenir en arrière dans l'historique, on le fait
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      // Sinon, on va vers la page d'accueil
      navigate('/');
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleBack}
      className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Retour
    </Button>
  );
}