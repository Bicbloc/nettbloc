import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MailCheck, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface EmailConfirmationRequiredProps {
  email?: string | null;
}

/**
 * Écran de blocage affiché tant que l'adresse e-mail du compte n'est pas
 * confirmée. Aucun accès à un espace (établissement ou autre) n'est accordé
 * sans confirmation préalable de l'e-mail. Jamais de basculement automatique.
 */
export function EmailConfirmationRequired({ email }: EmailConfirmationRequiredProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [isSending, setIsSending] = useState(false);

  const handleResend = async () => {
    if (!email) return;
    setIsSending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      toast({
        title: 'E-mail envoyé',
        description: 'Un nouveau lien de confirmation vient de vous être envoyé.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error?.message || "Impossible d'envoyer l'e-mail de confirmation.",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-background/95 p-6 shadow-sm text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <MailCheck className="h-6 w-6 text-primary" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Confirmez votre adresse e-mail</h2>
          <p className="text-sm text-muted-foreground">
            Vous devez confirmer votre adresse e-mail avant d'accéder à votre espace.
            Cliquez sur le lien que nous vous avons envoyé{email ? ` à ${email}` : ''}.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button className="w-full sm:w-auto" onClick={handleResend} disabled={isSending || !email}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isSending ? 'animate-spin' : ''}`} />
            Renvoyer l'e-mail
          </Button>
          <Button
            variant="ghost"
            className="w-full sm:w-auto text-destructive hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </div>
    </div>
  );
}
