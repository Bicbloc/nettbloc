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
  const [hotelData, setHotelData] = useState<any>(null);
  const [hotelLoading, setHotelLoading] = useState(true);

  // Charger directement les données de l'hôtel pour éviter les dépendances
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadHotelDirectly();
    }
  }, [isAuthenticated, user?.id]);

  const loadHotelDirectly = async () => {
    if (!user?.id) return;
    
    setHotelLoading(true);
    try {
      const { data: hotelResult, error } = await supabase
        .from('hotels')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Erreur chargement hôtel direct:', error);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de charger votre établissement. Vérifiez votre configuration."
        });
        return;
      }

      if (!hotelResult) {
        console.log('Aucun hôtel trouvé pour cet utilisateur');
        toast({
          variant: "destructive", 
          title: "Établissement manquant",
          description: "Aucun établissement configuré. Retournez à la page principale pour créer votre hôtel."
        });
        return;
      }

      // Vérifier que l'hôtel a un hotel_code
      if (!hotelResult.hotel_code) {
        console.log('Hotel_code manquant, génération automatique...');
        const hotelCode = `HTL${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;
        
        const { data: updatedHotel, error: updateError } = await supabase
          .from('hotels')
          .update({ hotel_code: hotelCode })
          .eq('id', hotelResult.id)
          .select()
          .single();
          
        if (updateError) {
          console.error('Erreur mise à jour hotel_code:', updateError);
        } else {
          hotelResult.hotel_code = hotelCode;
          console.log('✅ Hotel code généré:', hotelCode);
        }
      }

      setHotelData(hotelResult);
      console.log('✅ Hôtel chargé directement:', hotelResult);
    } catch (error) {
      console.error('Erreur loadHotelDirectly:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger votre établissement."
      });
    } finally {
      setHotelLoading(false);
    }
  };

  useEffect(() => {
    // Utiliser les données directes ou celles du hook
    const currentHotel = hotelData || hotel;
    if (currentHotel?.id) {
      loadGeneralAccessCodes(currentHotel.id);
    }
  }, [hotelData, hotel]);

  const loadGeneralAccessCodes = async (hotelId?: string) => {
    const targetHotelId = hotelId || hotelData?.id || hotel?.id;
    if (!targetHotelId) {
      console.log('Pas d\'ID hôtel disponible pour charger les codes');
      return;
    }
    
    try {
      console.log('🔄 Chargement codes généraux pour hôtel:', targetHotelId);
      
      // Récupérer uniquement les codes NON assignés à une femme de chambre spécifique
      const { data, error } = await supabase
        .from('housekeeper_access_codes')
        .select('*')
        .eq('hotel_id', targetHotelId)
        .eq('is_active', true)
        .is('housekeeper_id', null) // Codes généraux uniquement
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur chargement codes généraux:', error);
        return;
      }

      setAccessCodes(data || []);
      console.log("✅ Codes d'accès généraux chargés:", data?.length, 'codes');
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const generateNewGeneralCode = async () => {
    const currentHotel = hotelData || hotel;
    if (!currentHotel) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Hôtel non configuré. Retournez à la page principale."
      });
      return;
    }
    
    setLoading(true);
    try {
      console.log('🔑 Génération nouveau code général pour:', currentHotel.id);
      
      const { data, error } = await supabase.rpc('generate_housekeeper_access_code', {
        p_hotel_id: currentHotel.id,
        p_housekeeper_id: null
      });

      if (error) {
        console.error('Erreur génération code général:', error);
        toast({
          variant: "destructive",
          title: "Erreur de génération",
          description: `Erreur: ${error.message || 'Impossible de générer le code'}`
        });
        return;
      }

      console.log('✅ Code général généré:', data);
      toast({
        title: "Code général généré",
        description: `Nouveau code d'accès: ${data}`
      });

      await loadGeneralAccessCodes(currentHotel.id);
    } catch (error: any) {
      console.error('Erreur génération codes généraux:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: `Erreur technique: ${error.message || 'Erreur inconnue'}`
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

  if (hotelLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center space-y-4">
            <RefreshCw className="h-8 w-8 mx-auto animate-spin text-primary" />
            <div>
              <p className="text-muted-foreground">Vérification de votre établissement...</p>
              <p className="text-xs text-muted-foreground mt-1">
                Chargement des informations
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentHotel = hotelData || hotel;
  
  if (!currentHotel) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <div className="space-y-4">
            <p className="text-destructive font-medium">
              ❌ Impossible de charger votre établissement
            </p>
            <p className="text-sm text-muted-foreground">
              Aucun hôtel configuré pour votre compte.
            </p>
            <div className="space-y-2">
              <Button
                variant="outline" 
                onClick={loadHotelDirectly}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Réessayer
              </Button>
              <p className="text-xs text-muted-foreground">
                Si le problème persiste, retournez à la page principale pour configurer votre hôtel.
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
            Hôtel: {currentHotel.name} ({currentHotel.hotel_code})
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
                           <Badge variant="outline" className="mr-2 text-green-600">
                             Mode invité
                           </Badge>
                           Utilisable sans assignation spécifique • Créé le {new Date(codeData.created_at).toLocaleDateString('fr-FR')}
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
                   <p>1. Rendez-vous sur l'interface de connexion mobile</p>
                   <p>2. Saisissez le code d'accès général affiché ci-dessus</p>
                   <p>3. Accédez en mode "invité" sans assignation personnelle</p>
                   <p>4. Consultez et mettez à jour le statut des chambres</p>
                   <p>5. Toutes les actions sont enregistrées automatiquement</p>
                   <div className="mt-3 p-2 bg-green-100 rounded border-l-4 border-green-400">
                     <p className="text-green-800 text-xs">
                       <strong>✓ Codes généraux :</strong> Permettent un accès rapide sans configuration préalable d'une femme de chambre spécifique.
                     </p>
                   </div>
                 </div>
               </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};