import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, 
  Key, 
  Trash2, 
  Copy, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  Clock,
  AlertTriangle 
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AccessCode {
  id: string;
  access_code: string;
  housekeeper_id: string | null;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  used_at: string | null;
  housekeeper_name?: string;
}

interface HousekeeperAccessCodesProps {
  hotelId: string;
}

const HousekeeperAccessCodes: React.FC<HousekeeperAccessCodesProps> = ({ hotelId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([]);
  const [housekeepers, setHousekeepers] = useState<Array<{id: string, name: string}>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedHousekeeper, setSelectedHousekeeper] = useState<string>('');
  const [visibleCodes, setVisibleCodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, [hotelId]);

  const loadData = async () => {
    if (!hotelId) return;

    try {
      // Charger les codes d'accès
      const { data: codesData, error: codesError } = await supabase
        .from('housekeeper_access_codes')
        .select(`
          *,
          housekeepers(name)
        `)
        .eq('hotel_id', hotelId)
        .order('created_at', { ascending: false });

      if (codesError) {
        console.error('Erreur chargement codes:', codesError);
      } else {
        const formattedCodes = codesData?.map(code => ({
          ...code,
          housekeeper_name: code.housekeepers?.name || null
        })) || [];
        setAccessCodes(formattedCodes);
      }

      // Charger les femmes de chambre
      const { data: housekeepersData, error: housekeepersError } = await supabase
        .from('housekeepers')
        .select('id, name')
        .eq('hotel_id', hotelId)
        .eq('is_active', true);

      if (housekeepersError) {
        console.error('Erreur chargement femmes de chambre:', housekeepersError);
      } else {
        setHousekeepers(housekeepersData || []);
      }

    } catch (error) {
      console.error('Erreur:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les données"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateAccessCode = async () => {
    if (!user) return;

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.rpc('generate_housekeeper_access_code', {
        p_hotel_id: hotelId,
        p_housekeeper_id: selectedHousekeeper || null
      });

      if (error) {
        console.error('Erreur génération code:', error);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de générer le code d'accès"
        });
        return;
      }

      toast({
        title: "Code généré",
        description: `Nouveau code d'accès: ${data}`
      });

      setSelectedHousekeeper('');
      await loadData();

    } catch (error) {
      console.error('Erreur:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Une erreur est survenue"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const deactivateCode = async (codeId: string) => {
    try {
      const { error } = await supabase
        .from('housekeeper_access_codes')
        .update({ is_active: false })
        .eq('id', codeId);

      if (error) {
        console.error('Erreur désactivation code:', error);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de désactiver le code"
        });
        return;
      }

      toast({
        title: "Code désactivé",
        description: "Le code d'accès a été désactivé"
      });

      await loadData();

    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({
        title: "Code copié",
        description: "Le code a été copié dans le presse-papiers"
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de copier le code"
      });
    }
  };

  const toggleCodeVisibility = (codeId: string) => {
    setVisibleCodes(prev => {
      const newVisible = new Set(prev);
      if (newVisible.has(codeId)) {
        newVisible.delete(codeId);
      } else {
        newVisible.add(codeId);
      }
      return newVisible;
    });
  };

  const formatCode = (code: string, isVisible: boolean) => {
    if (isVisible) return code;
    return code.replace(/./g, '•');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Codes d'accès femmes de chambre
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Génération de nouveau code */}
        <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Plus className="h-4 w-4" />
            <Label className="font-medium">Générer un nouveau code</Label>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="housekeeper-select">
                Assigner à une femme de chambre (optionnel)
              </Label>
              <select
                id="housekeeper-select"
                value={selectedHousekeeper}
                onChange={(e) => setSelectedHousekeeper(e.target.value)}
                className="w-full mt-1 p-2 border rounded-md bg-background"
              >
                <option value="">Code général (non assigné)</option>
                {housekeepers.map(hk => (
                  <option key={hk.id} value={hk.id}>{hk.name}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-end">
              <Button
                onClick={generateAccessCode}
                disabled={isGenerating}
                className="w-full flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {isGenerating ? 'Génération...' : 'Générer le code'}
              </Button>
            </div>
          </div>
        </div>

        {/* Liste des codes existants */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="font-medium">Codes d'accès actifs</Label>
            <Badge variant="secondary">
              {accessCodes.filter(c => c.is_active).length} code(s) actif(s)
            </Badge>
          </div>

          {accessCodes.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Aucun code d'accès généré. Créez un premier code pour permettre l'accès aux femmes de chambre.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {accessCodes.map(code => (
                <div
                  key={code.id}
                  className={`p-4 border rounded-lg ${
                    !code.is_active ? 'bg-muted/50 opacity-75' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <code className="text-lg font-mono bg-muted px-2 py-1 rounded">
                          {formatCode(code.access_code, visibleCodes.has(code.id))}
                        </code>
                        
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleCodeVisibility(code.id)}
                          className="p-1"
                        >
                          {visibleCodes.has(code.id) ? 
                            <EyeOff className="h-4 w-4" /> : 
                            <Eye className="h-4 w-4" />
                          }
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(code.access_code)}
                          className="p-1"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center gap-4">
                          <span>
                            Créé le {format(new Date(code.created_at), 'PPp', { locale: fr })}
                          </span>
                          {code.housekeeper_name && (
                            <span>Assigné à: {code.housekeeper_name}</span>
                          )}
                        </div>
                        
                        {code.used_at && (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-3 w-3" />
                            Utilisé le {format(new Date(code.used_at), 'PPp', { locale: fr })}
                          </div>
                        )}
                        
                        {code.expires_at && (
                          <div className="flex items-center gap-1 text-orange-600">
                            <Clock className="h-3 w-3" />
                            Expire le {format(new Date(code.expires_at), 'PPp', { locale: fr })}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant={code.is_active ? "default" : "secondary"}>
                        {code.is_active ? 'Actif' : 'Inactif'}
                      </Badge>
                      
                      {code.is_active && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deactivateCode(code.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {housekeepers.length === 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Aucune femme de chambre configurée. Ajoutez des femmes de chambre pour pouvoir leur assigner des codes d'accès personnalisés.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default HousekeeperAccessCodes;