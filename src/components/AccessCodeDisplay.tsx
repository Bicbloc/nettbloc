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
      const { data, error } = await supabase
        .from('housekeeper_access_codes')
        .select(`
          *,
          housekeepers(name)
        `)
        .eq('hotel_id', hotel.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur chargement codes:', error);
        return;
      }

      const formattedCodes = data?.map(code => ({
        ...code,
        housekeeper_name: code.housekeepers?.name || null
      })) || [];

      setAccessCodes(formattedCodes);
      console.log("✅ Codes d'accès chargés:", formattedCodes);
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
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">
            Configuration de l'hôtel en cours...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Codes d'Accès Femmes de Chambre</CardTitle>
        <CardDescription>
          Codes d'accès pour permettre aux femmes de chambre d'accéder à l'interface mobile
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
              Aucun code d'accès généré
            </p>
            <Button
              onClick={generateNewAccessCode}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Créer le premier code
            </Button>
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
                          {codeData.housekeeper_name ? (
                            `Assigné à: ${codeData.housekeeper_name}`
                          ) : (
                            'Code général (non assigné)'
                          )}
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
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Instructions pour les femmes de chambre :</strong>
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  1. Aller sur l'interface mobile
                </p>
                <p className="text-sm text-blue-700">
                  2. Utiliser un des codes d'accès ci-dessus
                </p>
                <p className="text-sm text-blue-700">
                  3. Code hôtel: <code className="bg-blue-100 px-1 rounded">{hotel.hotel_code}</code>
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};