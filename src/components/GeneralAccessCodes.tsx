import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, RefreshCw, Eye, EyeOff, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAutoSetup } from '@/hooks/use-auto-setup';

interface GeneralAccessCode {
  id: string;
  access_code: string;
  is_active: boolean;
  created_at: string;
}

export const GeneralAccessCodes = () => {
  const { user, isAuthenticated } = useAuth();
  const { hotel } = useAutoSetup();
  const { toast } = useToast();
  const [accessCodes, setAccessCodes] = useState<GeneralAccessCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCodes, setShowCodes] = useState(false);

  useEffect(() => {
    loadGeneralAccessCodes();
  }, [hotel?.id]);

  const loadGeneralAccessCodes = async () => {
    if (!hotel?.id) return;
    
    try {
      // Récupérer uniquement les codes NON assignés à une femme de chambre spécifique
      const { data, error } = await supabase
        .from('housekeeper_access_codes')
        .select('*')
        .eq('hotel_id', hotel.id)
        .eq('is_active', true)
        .is('housekeeper_id', null) // Codes généraux uniquement
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur chargement codes généraux:', error);
        return;
      }

      setAccessCodes(data || []);
      console.log("✅ Codes d'accès généraux chargés:", data);
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const generateNewGeneralCode = async () => {
    if (!hotel) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('generate_housekeeper_access_code', {
        p_hotel_id: hotel.id,
        p_housekeeper_id: null
      });

      if (error) {
        console.error('Erreur génération code général:', error);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de générer un nouveau code d'accès général"
        });
        return;
      }

      toast({
        title: "Code général généré",
        description: `Nouveau code d'accès: ${data}`
      });

      await loadGeneralAccessCodes();
    } catch (error: any) {
      console.error('Erreur génération codes généraux:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de générer un nouveau code d'accès général."
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copié !",
        description: "Code d'accès copié dans le presse-papiers"
      });
    }).catch(() => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de copier dans le presse-papiers"
      });
    });
  };

  if (!isAuthenticated) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">
            Connectez-vous pour voir les codes d'accès généraux
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!hotel) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center space-y-4">
            <RefreshCw className="h-8 w-8 mx-auto animate-spin text-primary" />
            <div>
              <p className="text-muted-foreground">Configuration de l'hôtel en cours...</p>
              <p className="text-xs text-muted-foreground mt-1">
                Chargement des informations de l'établissement
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Codes d'Accès Généraux</CardTitle>
        <CardDescription>
          Codes d'accès généraux pour l'interface mobile - utilisables par n'importe quelle femme de chambre
          <span className="text-sm text-muted-foreground mt-1 block">
            Hôtel: {hotel.name} ({hotel.hotel_code})
          </span>
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <Button
            onClick={generateNewGeneralCode}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {loading ? 'Génération...' : 'Générer un code général'}
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setShowCodes(!showCodes)}
            className="flex items-center gap-2"
            disabled={accessCodes.length === 0}
          >
            {showCodes ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showCodes ? 'Masquer' : 'Afficher'}
          </Button>
        </div>

        {accessCodes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Aucun code d'accès général généré
            </p>
            <Button
              onClick={generateNewGeneralCode}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Créer le premier code général
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {accessCodes.length} code(s) général(aux) actif(s)
              </span>
              <Badge variant="default">
                {accessCodes.length}
              </Badge>
            </div>

            {showCodes && (
              <div className="space-y-3">
                {accessCodes.map((codeData) => (
                  <div key={codeData.id} className="p-4 border rounded-lg bg-primary/5 border-primary/20">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <code className="text-lg font-mono font-bold text-primary bg-background px-3 py-2 rounded border-2 border-primary/20">
                          {codeData.access_code}
                        </code>
                        <div className="text-sm text-muted-foreground">
                          <Badge variant="secondary" className="mr-2">
                            Code général
                          </Badge>
                          Non assigné - utilisable par toutes les femmes de chambre
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(codeData.access_code)}
                        className="flex items-center gap-1"
                      >
                        <Copy className="h-3 w-3" />
                        Copier
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showCodes && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 font-medium mb-2">
                  📱 Instructions pour les femmes de chambre :
                </p>
                <div className="text-sm text-blue-700 space-y-1">
                  <p>1. Aller sur l'interface mobile housekepper</p>
                  <p>2. Choisir "Connexion rapide"</p>
                  <p>3. Utiliser un des codes ci-dessus</p>
                  <p className="mt-2">
                    <strong>OU</strong> connexion en 2 étapes :
                  </p>
                  <p>1. Code hôtel: <code className="bg-blue-100 px-2 py-1 rounded font-mono">{hotel.hotel_code}</code></p>
                  <p>2. Puis utiliser un code ci-dessus</p>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};