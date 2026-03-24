import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Copy } from 'lucide-react';

interface HousekeeperInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotelId: string;
}

export const HousekeeperInviteDialog: React.FC<HousekeeperInviteDialogProps> = ({
  open,
  onOpenChange,
  hotelId
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'code'>('form');
  const { toast } = useToast();

  const generateAccessCode = async () => {
    setIsLoading(true);
    try {
      // Vérifier si la femme de chambre existe déjà
      const { data: existingHousekeeper } = await supabase
        .from('housekeepers')
        .select('id, name, access_code')
        .eq('hotel_id', hotelId)
        .eq('name', name)
        .eq('is_active', true)
        .maybeSingle();

      let generatedCode: string;
      let housekeeperData: any;

      if (existingHousekeeper) {
        generatedCode = existingHousekeeper.access_code;
        housekeeperData = existingHousekeeper;
        
        toast({
          title: "Code existant trouvé",
          description: `${name} possède déjà un code d'accès`
        });
      } else {
        // Generate access code with name
        const { data, error } = await supabase.rpc(
          'generate_housekeeper_access_code_simple',
          {
            p_hotel_id: hotelId,
            p_housekeeper_name: name
          }
        );

        if (error) {
          console.error('RPC Error:', error);
          toast({
            title: "Erreur",
            description: "Impossible de générer le code d'accès",
            variant: "destructive"
          });
          return;
        }

        generatedCode = data as string;

        // Créer l'entrée dans housekeepers avec le code d'accès
        const { data: newHousekeeper, error: housekeeperError } = await supabase
          .from('housekeepers')
          .insert({
            hotel_id: hotelId,
            name: name,
            access_code: generatedCode,
            user_id: (await supabase.auth.getUser()).data.user?.id,
            is_active: true,
            is_temporary: false
          })
          .select()
          .single();

        if (housekeeperError) {
          console.error('Error creating housekeeper:', housekeeperError);
          toast({
            title: "Erreur",
            description: `Impossible de créer la femme de chambre: ${housekeeperError.message}`,
            variant: "destructive"
          });
          return;
        }

        housekeeperData = newHousekeeper;
      }

      setAccessCode(generatedCode);

      // Créer ou mettre à jour l'entrée dans housekeeper_access_codes
      const { error: inviteError } = await supabase
        .from('housekeeper_access_codes')
        .upsert({
          hotel_id: hotelId,
          housekeeper_id: housekeeperData.id,
          access_code: generatedCode,
          invited_email: email || null,
          invited_name: name,
          created_by: (await supabase.auth.getUser()).data.user?.id,
          is_active: true,
          expires_at: null // Code permanent
        }, {
          onConflict: 'housekeeper_id'
        });

      if (inviteError) {
        console.error('Error saving access code:', inviteError);
      }

      // Send email invitation if email provided (with retry)
      if (email) {
        let emailSent = false;
        let retries = 3;
        
        while (!emailSent && retries > 0) {
          try {
            const { error: emailError } = await supabase.functions.invoke('send-activation-email', {
              body: {
                email,
                type: 'activation',
                companyName: name,
                accessCode: generatedCode,
                activationLink: `${window.location.origin}/housekeeper/work?code=${generatedCode}`
              }
            });
            
            if (emailError) throw emailError;
            
            emailSent = true;
          } catch (emailError) {
            retries--;
            console.error(`❌ Error sending invitation email (${retries} retries left):`, emailError);
            
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
            }
          }
        }
        
        if (!emailSent) {
          toast({
            title: "Attention",
            description: "Code créé mais l'email n'a pas pu être envoyé. Communiquez le code manuellement.",
            variant: "default"
          });
        }
      }

      setStep('code');
      toast({
        title: "Code généré",
        description: existingHousekeeper ? "Code d'accès existant récupéré" : "Nouveau code d'accès créé avec succès"
      });
    } catch (error) {
      console.error('Error generating code:', error);
      toast({
        title: "Erreur",
        description: `Erreur lors de la génération du code: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(accessCode);
    toast({
      title: "Copié",
      description: "Code copié dans le presse-papiers"
    });
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setMessage('');
    setAccessCode('');
    setStep('form');
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inviter une femme de chambre</DialogTitle>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nom complet</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Prénom Nom"
                required
              />
            </div>

            <div>
              <Label htmlFor="email">Email (optionnel)</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemple.com"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Si elle n'a pas l'app, laissez vide pour un accès temporaire
              </p>
            </div>

            <div>
              <Label htmlFor="message">Message personnalisé (optionnel)</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Message d'accueil..."
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button 
                onClick={generateAccessCode}
                disabled={!name || isLoading}
              >
                {isLoading ? "Génération..." : "Générer le code"}
              </Button>
            </div>
          </div>
        )}

        {step === 'code' && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">
                  Code d'accès pour {name}:
                </p>
                <div className="flex items-center justify-center space-x-2">
                  <code className="text-lg font-mono bg-background px-3 py-2 rounded border">
                    {accessCode}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyToClipboard}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground space-y-2">
              <p>• Code permanent pour {name}</p>
              <p>• Interface mobile: {window.location.origin}/housekeeper/work</p>
              {email && <p>• Email d'invitation envoyé à: {email}</p>}
              {!email && <p>• Communiquez ce code directement à {name}</p>}
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={resetForm}>
                Inviter une autre
              </Button>
              <Button onClick={handleClose}>
                Terminer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};