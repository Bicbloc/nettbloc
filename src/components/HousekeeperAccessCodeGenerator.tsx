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
      // Générer le code d'accès
      const { data: accessCode, error } = await supabase
        .rpc('generate_housekeeper_access_code_simple', {
          p_hotel_id: hotelId,
          p_housekeeper_name: housekeeperName
        });

      if (error) throw error;

      // Créer également une entrée dans la table housekeepers
      const { error: housekeeperError } = await supabase
        .from('housekeepers')
        .insert({
          hotel_id: hotelId,
          name: housekeeperName,
          access_code: accessCode,
          is_temporary: true,
          is_active: true,
          user_id: (await supabase.auth.getUser()).data.user?.id
        });

      if (housekeeperError) {
        console.warn('Erreur création housekeeper:', housekeeperError);
      }

      // Créer l'entrée dans housekeeper_access_codes avec l'email si fourni
      const { error: insertError } = await supabase
        .from('housekeeper_access_codes')
        .insert({
          hotel_id: hotelId,
          access_code: accessCode,
          invited_name: housekeeperName,
          invited_email: email || null,
          is_active: true,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (insertError) throw insertError;

      setGeneratedCode(accessCode);
      
      // Copier automatiquement le code dans le presse-papiers
      try {
        await navigator.clipboard.writeText(accessCode);
      } catch (error) {
        console.warn('Impossible de copier automatiquement le code:', error);
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
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Code généré pour {housekeeperName}</p>
                  <p className="text-2xl font-mono font-bold text-green-800">{generatedCode}</p>
                  {email && <p className="text-sm text-green-600">Email d'activation envoyé à {email}</p>}
                </div>
                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                  <Copy className="h-4 w-4" />
                </Button>
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
