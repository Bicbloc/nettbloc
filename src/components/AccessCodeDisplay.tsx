import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useAutoSetup } from '@/hooks/use-auto-setup';
import { Button } from '@/components/ui/button';
import { Copy, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const AccessCodeDisplay = () => {
  const { user, isAuthenticated } = useAuth();
  const { accessCode, generateNewAccessCode, hotel } = useAutoSetup();
  const { toast } = useToast();
  const [housekeeperCodes, setHousekeeperCodes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showCodes, setShowCodes] = useState(false);

  // Charger les codes depuis les femmes de chambre en base
  useEffect(() => {
    const loadHousekeeperCodes = async () => {
      if (!hotel?.id) return;
      
      try {
        // Récupérer toutes les femmes de chambre avec leurs codes
        const { SupabaseService } = await import('@/services/supabaseService');
        const housekeepers = await SupabaseService.getHousekeepers(hotel.id);
        
        if (housekeepers) {
          const codes: Record<string, string> = {};
          housekeepers.forEach(hk => {
            codes[hk.name] = hk.access_code;
          });
          setHousekeeperCodes(codes);
          console.log("✅ Codes femmes de chambre chargés:", codes);
        }
      } catch (error) {
        console.error('Erreur chargement codes femmes de chambre:', error);
      }
    };

    if (isAuthenticated && hotel) {
      loadHousekeeperCodes();
    }
  }, [isAuthenticated, hotel]);

  // Rafraîchir automatiquement toutes les 2 secondes pour détecter les nouveaux codes
  useEffect(() => {
    if (!isAuthenticated || !hotel?.id) return;

    const interval = setInterval(async () => {
      try {
        const { SupabaseService } = await import('@/services/supabaseService');
        const housekeepers = await SupabaseService.getHousekeepers(hotel.id);
        
        if (housekeepers) {
          const codes: Record<string, string> = {};
          housekeepers.forEach(hk => {
            codes[hk.name] = hk.access_code;
          });
          
          // Mettre à jour seulement si des changements sont détectés
          const currentKeys = Object.keys(housekeeperCodes).sort().join(',');
          const newKeys = Object.keys(codes).sort().join(',');
          
          if (currentKeys !== newKeys && newKeys.length > 0) {
            console.log("🔄 Nouveaux codes détectés, mise à jour...");
            setHousekeeperCodes(codes);
            
            // Notifier seulement si on avait des codes avant (pas au premier chargement)
            if (currentKeys.length > 0) {
              toast({
                title: "Codes mis à jour",
                description: "De nouveaux codes d'accès ont été générés automatiquement."
              });
            }
          }
        }
      } catch (error) {
        console.error('Erreur rafraîchissement codes:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isAuthenticated, hotel?.id, housekeeperCodes]);

  const generateAccessCodes = async () => {
    if (!hotel) return;
    
    setLoading(true);
    try {
      const newCode = await generateNewAccessCode();
      if (newCode) {
        // Le code principal pour l'hôtel
        toast({
          title: "Code généré",
          description: "Nouveau code d'accès principal généré."
        });
      }
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Codes d'Accès</CardTitle>
        <CardDescription>
          <span>Code d'accès pour permettre aux femmes de chambre d'accéder à l'interface mobile</span>
          {hotel && (
            <span className="text-sm text-muted-foreground mt-1 block">
              Hôtel: {hotel.name}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <Button
            onClick={generateAccessCodes}
            disabled={loading || !hotel}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Génération...' : 'Générer nouveau code'}
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setShowCodes(!showCodes)}
            className="flex items-center gap-2"
            disabled={!accessCode}
          >
            {showCodes ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showCodes ? 'Masquer' : 'Afficher'}
          </Button>
        </div>

        {showCodes && (
          <div className="space-y-4">
            {/* Code principal de l'hôtel */}
            {accessCode && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Code d'accès principal de l'hôtel :
                </p>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
                  <code className="font-mono text-xl font-bold text-primary">
                    {accessCode}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(accessCode)}
                    className="flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" />
                    Copier
                  </Button>
                </div>
              </div>
            )}

            {/* Codes individuels des femmes de chambre */}
            {Object.keys(housekeeperCodes).length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Codes d'accès des femmes de chambre :
                </p>
                <div className="space-y-2">
                  {Object.entries(housekeeperCodes).map(([name, code]) => (
                    <div key={name} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border">
                      <div>
                        <div className="font-medium text-sm">{name}</div>
                        <code className="font-mono text-lg font-bold text-blue-700">
                          {code}
                        </code>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(code)}
                        className="flex items-center gap-1"
                      >
                        <Copy className="h-3 w-3" />
                        Copier
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {hotel && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Instructions pour les femmes de chambre :</strong>
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  1. Code de l'hôtel : <code className="bg-blue-100 px-1 rounded">{hotel.hotel_code}</code>
                </p>
                <p className="text-sm text-blue-700">
                  2. Utilisez votre code d'accès personnel ci-dessus
                </p>
              </div>
            )}
          </div>
        )}

        {!accessCode && !loading && (
          <p className="text-muted-foreground text-center py-8">
            Code d'accès en cours de génération automatique...
          </p>
        )}

        {Object.keys(housekeeperCodes).length === 0 && showCodes && accessCode && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              Aucune femme de chambre configurée. Ajoutez des femmes de chambre dans l'onglet "Équipe" pour générer leurs codes d'accès individuels.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};