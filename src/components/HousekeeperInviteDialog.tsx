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
    console.log('Generating access code for hotel:', hotelId, 'and name:', name);
    setIsLoading(true);
    try {
      // Generate access code with name
      const { data, error } = await supabase.rpc(
        'generate_housekeeper_access_code_simple',
        {
          p_hotel_id: hotelId,
          p_housekeeper_name: name
        }
      );

      if (error) {
        toast({
          title: "Erreur",
          description: "Impossible de générer le code d'accès",
          variant: "destructive"
        });
        return;
      }

      const generatedCode = data as string;
      setAccessCode(generatedCode);

      // Créer l'entrée dans housekeepers avec le code d'accès
      const { data: housekeeperData, error: housekeeperError } = await supabase
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
          description: "Impossible de créer la femme de chambre",
          variant: "destructive"
        });
        return;
      }

      // Créer l'entrée dans housekeeper_access_codes
      const { error: inviteError } = await supabase
        .from('housekeeper_access_codes')
        .insert({
          hotel_id: hotelId,
          housekeeper_id: housekeeperData.id,
          access_code: generatedCode,
          invited_email: email,
          invited_name: name,
          created_by: (await supabase.auth.getUser()).data.user?.id,
          is_active: true,
          expires_at: null // Code permanent
        });

      if (inviteError) {
        console.error('Error saving access code:', inviteError);
      }

      // Send email invitation if email provided
      if (email) {
        try {
          await supabase.functions.invoke('send-activation-email', {
            body: {
              email,
              type: 'activation',
              companyName: name,
              accessCode: generatedCode,
              activationLink: `${window.location.origin}/mobile?code=${generatedCode}`
            }
          });
        } catch (emailError) {
          console.error('Error sending invitation email:', emailError);
        }
      }

      setStep('code');
      toast({
        title: "Code généré",
        description: "Code d'accès créé avec succès"
      });
    } catch (error) {
      console.error('Error generating code:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la génération du code",
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
              <p>• Interface mobile: {window.location.origin}/mobile</p>
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