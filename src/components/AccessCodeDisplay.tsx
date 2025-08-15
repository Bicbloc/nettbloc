import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useAutoSetup } from '@/hooks/use-auto-setup';
import { Button } from '@/components/ui/button';
import { Copy, RefreshCw, Eye, EyeOff, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AccessCode {
  id: string;
  access_code: string;
  housekeeper_id: string | null;
  is_active: boolean;
  created_at: string;
  housekeeper_name?: string;
}

export const AccessCodeDisplay = () => {
  const { user, isAuthenticated } = useAuth();
  const { hotel } = useAutoSetup();
  const { toast } = useToast();
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCodes, setShowCodes] = useState(false);

  useEffect(() => {
    loadAccessCodes();
  }, [hotel?.id]);

  const loadAccessCodes = async () => {
    if (!hotel?.id) return;
    
    try {
      // Récupérer uniquement les codes ASSIGNÉS à des femmes de chambre spécifiques
      const { data, error } = await supabase
        .from('housekeeper_access_codes')
        .select(`
          *,
          housekeepers(name)
        `)
        .eq('hotel_id', hotel.id)
        .eq('is_active', true)
        .not('housekeeper_id', 'is', null) // Codes assignés uniquement
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur chargement codes assignés:', error);
        return;
      }

      const formattedCodes = data?.map(code => ({
        ...code,
        housekeeper_name: code.housekeepers?.name || null
      })) || [];

      setAccessCodes(formattedCodes);
      console.log("✅ Codes d'accès assignés chargés:", formattedCodes);
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const generateNewAccessCode = async () => {
    if (!hotel) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('generate_housekeeper_access_code', {
        p_hotel_id: hotel.id,
        p_housekeeper_id: null
      });

      if (error) {
        console.error('Erreur génération code:', error);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de générer un nouveau code d'accès"
        });
        return;
      }

      toast({
        title: "Code généré",
        description: `Nouveau code d'accès: ${data}`
      });

      await loadAccessCodes();
    } catch (error: any) {
      console.error('Erreur génération codes:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de générer un nouveau code d'accès."
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
            Connectez-vous pour voir les codes d'accès
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
        <CardTitle>Codes d'Accès Individuels</CardTitle>
        <CardDescription>
          Codes d'accès personnalisés assignés à des femmes de chambre spécifiques
          <span className="text-sm text-muted-foreground mt-1 block">
            Hôtel: {hotel.name} ({hotel.hotel_code})
          </span>
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <Button
            onClick={generateNewAccessCode}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {loading ? 'Génération...' : 'Générer un code'}
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
              Aucun code d'accès individuel généré
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Les codes individuels sont assignés directement aux femmes de chambre dans leur carte respective.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {accessCodes.length} code(s) d'accès actif(s)
              </span>
              <Badge variant="secondary">
                {accessCodes.length}
              </Badge>
            </div>

            {showCodes && (
              <div className="space-y-3">
                {accessCodes.map((codeData) => (
                  <div key={codeData.id} className="p-4 border rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <code className="text-lg font-mono font-bold text-primary bg-background px-2 py-1 rounded">
                          {codeData.access_code}
                        </code>
                        <div className="text-sm text-muted-foreground">
                          <Badge variant="outline" className="mr-2">
                            Code individuel
                          </Badge>
                          Assigné à: <strong>{codeData.housekeeper_name}</strong>
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
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 font-medium">
                  📱 Instructions pour codes individuels :
                </p>
                <div className="text-sm text-green-700 mt-1 space-y-1">
                  <p>Ces codes sont personnalisés pour chaque femme de chambre.</p>
                  <p>1. Connexion rapide : utiliser directement le code complet</p>
                  <p>2. Connexion en 2 étapes :</p>
                  <p className="ml-4">• Code hôtel: <code className="bg-green-100 px-1 rounded">{hotel.hotel_code}</code></p>
                  <p className="ml-4">• Puis le code individuel ci-dessus</p>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};