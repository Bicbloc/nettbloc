import { useEffect, useState } from 'react';
import { useSearchParams, Navigate, useNavigate } from 'react-router-dom';
import { CheckCircle, Loader2, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const Success = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isUpdating, setIsUpdating] = useState(true);
  const [invoiceGenerated, setInvoiceGenerated] = useState(false);
  
  // Support both Stripe (session_id) and GoCardless (billing_request_id)
  const sessionId = searchParams.get('session_id');
  const billingRequestId = searchParams.get('billing_request_id');
  const planType = searchParams.get('plan') || 'premium';

  useEffect(() => {
    const updateSubscription = async () => {
      const hasPaymentRef = sessionId || billingRequestId;
      
      if (!hasPaymentRef) {
        setIsUpdating(false);
        return;
      }

      try {
        // Check subscription status
        const { data: subData, error: subError } = await supabase.functions.invoke('check-subscription');
        
        if (subError) throw subError;

        // Get pending subscription to find amount
        if (user && billingRequestId) {
          const { data: pending } = await supabase
            .from('pending_subscriptions')
            .select('amount, plan_type')
            .eq('user_id', user.id)
            .eq('billing_request_id', billingRequestId)
            .single();

          if (pending) {
            // Generate invoice
            const { data: invoiceData, error: invoiceError } = await supabase.functions.invoke('generate-invoice', {
              body: {
                user_id: user.id,
                plan_type: pending.plan_type || planType,
                amount_cents: pending.amount,
                payment_reference: billingRequestId
              }
            });

            if (!invoiceError && invoiceData?.success) {
              setInvoiceGenerated(true);
              console.log('Invoice generated:', invoiceData.invoice_number);
            } else {
              console.error('Invoice generation error:', invoiceError);
            }

            // Update pending subscription status
            await supabase
              .from('pending_subscriptions')
              .update({ status: 'completed' })
              .eq('billing_request_id', billingRequestId);
          }
        }

        toast({
          title: "Abonnement activé !",
          description: "Vous avez maintenant accès à toutes les fonctionnalités de votre plan."
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
  }, [sessionId, billingRequestId, user, planType]);

  if (!sessionId && !billingRequestId) {
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
              Nous activons votre abonnement et générons votre facture
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
            Votre abonnement a été activé avec succès
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Vous avez maintenant accès à toutes les fonctionnalités de votre plan.
          </p>
          
          {invoiceGenerated && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-sm text-green-600 dark:text-green-400 flex items-center justify-center gap-2">
                <FileText className="h-4 w-4" />
                Votre facture a été générée
              </p>
            </div>
          )}
          
          <div className="flex flex-col gap-2">
            <Button 
              className="w-full"
              onClick={() => window.location.href = '/'}
            >
              Accéder au tableau de bord
            </Button>
            
            {invoiceGenerated && (
              <Button 
                variant="outline"
                className="w-full"
                onClick={() => navigate('/invoices')}
              >
                <FileText className="h-4 w-4 mr-2" />
                Voir ma facture
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Success;