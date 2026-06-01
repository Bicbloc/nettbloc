import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Copy, Key } from 'lucide-react';

interface HousekeeperAccessCodeGeneratorProps {
  hotelId: string;
  onCodeGenerated?: (code: string, email?: string) => void;
}

export const HousekeeperAccessCodeGenerator: React.FC<HousekeeperAccessCodeGeneratorProps> = ({
  hotelId,
  onCodeGenerated
}) => {
  const [housekeeperName, setHousekeeperName] = useState('');
  const [email, setEmail] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generateAccessCode = async () => {
    if (!housekeeperName.trim()) {
      toast({
        title: "Nom requis",
        description: "Veuillez entrer le nom de la femme de chambre",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Générer et insérer le code d'accès avec la nouvelle fonction
      const { data: accessCode, error } = await supabase
        .rpc('generate_and_insert_access_code', {
          p_hotel_id: hotelId,
          p_housekeeper_name: housekeeperName
        });

      if (error) throw error;

      // Mettre à jour l'email si fourni
      if (email) {
        const { data: housekeeper } = await supabase
          .from('housekeepers')
          .select('id')
          .eq('hotel_id', hotelId)
          .eq('name', housekeeperName)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (housekeeper) {
          await supabase
            .from('housekeeper_access_codes')
            .update({
              invited_email: email,
              invited_name: housekeeperName
            })
            .eq('housekeeper_id', housekeeper.id);
        }
      }

      setGeneratedCode(accessCode);
      
      // Copier automatiquement le code dans le presse-papiers
      try {
        await navigator.clipboard.writeText(accessCode);
      } catch (error) {
      }
      
      // Envoyer un email d'activation si un email est fourni
      if (email) {
        try {
          const { error: emailError } = await supabase.functions.invoke('send-activation-email', {
            body: {
              email: email,
              type: 'activation',
              companyName: housekeeperName,
              accessCode: accessCode
            }
          });

          if (emailError) {
            console.error('Erreur envoi email:', emailError);
            toast({
              title: "Code généré",
              description: `Code: ${accessCode}. Erreur envoi email: ${emailError.message}`,
              variant: "destructive"
            });
          } else {
            toast({
              title: "Code généré et copié",
              description: `Code d'accès généré pour ${housekeeperName}, email envoyé et code copié dans le presse-papiers.`
            });
          }
        } catch (emailError) {
          console.error('Erreur envoi email:', emailError);
          toast({
            title: "Code généré",
            description: `Code: ${accessCode}. Email non envoyé: ${emailError}`,
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "Code généré et copié",
          description: `Code d'accès généré pour ${housekeeperName} et copié dans le presse-papiers: ${accessCode}`
        });
      }

      onCodeGenerated?.(accessCode, email || undefined);
      
    } catch (error) {
      console.error('Erreur génération code:', error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le code d'accès",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedCode);
      toast({
        title: "Code copié",
        description: "Le code d'accès a été copié dans le presse-papiers"
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de copier le code",
        variant: "destructive"
      });
    }
  };

  const reset = () => {
    setHousekeeperName('');
    setEmail('');
    setGeneratedCode('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Générer un Code d'Accès
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!generatedCode ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="housekeeperName">Nom de la femme de chambre *</Label>
              <Input
                id="housekeeperName"
                value={housekeeperName}
                onChange={(e) => setHousekeeperName(e.target.value)}
                placeholder="Nom complet"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email (optionnel)</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemple.com"
              />
              <p className="text-sm text-muted-foreground">
                Si un email est fourni, un lien d'activation sera automatiquement envoyé
              </p>
            </div>
            
            <Button onClick={generateAccessCode} disabled={loading} className="w-full">
              {loading ? "Génération..." : "Générer le Code d'Accès"}
              {email && <Mail className="ml-2 h-4 w-4" />}
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div>
                <p className="font-medium">Invitation créée pour {housekeeperName}</p>
                {email && (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-green-600">✉️ Email d'activation envoyé à {email}</p>
                    <p className="text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      ⚠️ Informez la personne d'aller vérifier sa boîte mail (et ses spams) pour activer son accès.
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={reset} variant="outline" className="flex-1">
                Générer un autre code
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
