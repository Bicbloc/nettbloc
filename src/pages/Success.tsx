import { useEffect, useState } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const Success = () => {
  const [searchParams] = useSearchParams();
  const [isUpdating, setIsUpdating] = useState(true);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const updateSubscription = async () => {
      if (!sessionId) {
        setIsUpdating(false);
        return;
      }

      try {
        // Check subscription status
        const { error } = await supabase.functions.invoke('check-subscription');
        
        if (error) throw error;

        toast({
          title: "Abonnement Premium activé !",
          description: "Vous avez maintenant accès à toutes les fonctionnalités Premium."
        });
      } catch (error: any) {
        console.error('Erreur mise à jour abonnement:', error);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Erreur lors de l'activation de l'abonnement. Contactez le support."
        });
      } finally {
        setIsUpdating(false);
      }
    };

    updateSubscription();
  }, [sessionId]);

  if (!sessionId) {
    return <Navigate to="/" replace />;
  }

  if (isUpdating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <CardTitle className="text-center">Activation en cours...</CardTitle>
            <CardDescription className="text-center">
              Nous activons votre abonnement Premium
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <CardTitle className="text-center text-2xl">Paiement réussi !</CardTitle>
          <CardDescription className="text-center">
            Votre abonnement Premium a été activé avec succès
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Vous avez maintenant accès à toutes les fonctionnalités Premium de Nettobloc.
          </p>
          
          <Button 
            className="w-full"
            onClick={() => window.location.href = '/'}
          >
            Accéder au tableau de bord
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Success;