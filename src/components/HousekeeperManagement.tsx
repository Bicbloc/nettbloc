import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserIcon, Plus, Key, Trash2, RefreshCw, AlertTriangle, CheckCircle, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SupabaseService } from '@/services/supabaseService';
import { CodeGenerationService } from '@/services/codeGenerationService';
import { useHousekeeping } from '@/contexts/HousekeepingContext';
import { useAutoSetup } from '@/hooks/use-auto-setup';

interface Housekeeper {
  id: string;
  name: string;
  access_code: string;
  is_active: boolean;
  created_at: string;
  hotel_id: string;
}

export const HousekeeperManagement = () => {
  const [housekeepers, setHousekeepers] = useState<Housekeeper[]>([]);
  const [newHousekeeperName, setNewHousekeeperName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingCodes, setIsGeneratingCodes] = useState(false);
  const { toast } = useToast();
  const { hotel, isSetupComplete } = useAutoSetup();
  const { housekeeperNames, setHousekeeperNames, refreshHousekeepers } = useHousekeeping();

  useEffect(() => {
    if (hotel?.id) {
      loadHousekeepers();
    }
  }, [hotel?.id]);

  const loadHousekeepers = async () => {
    if (!hotel?.id) return;
    
    try {
      const data = await SupabaseService.getHousekeepers(hotel.id);
      setHousekeepers(data as Housekeeper[]);
      
      // Synchroniser avec le contexte
      const activeNames = data.filter(h => h.is_active).map(h => h.name);
      setHousekeeperNames(activeNames);
    } catch (error) {
      console.error('Erreur chargement femmes de chambre:', error);
    }
  };

  const handleCreateHousekeeper = async () => {
    if (!newHousekeeperName.trim()) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez saisir un nom"
      });
      return;
    }

    if (!hotel?.id) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Aucun hôtel configuré"
      });
      return;
    }

    // Vérifier si le nom existe déjà
    if (housekeepers.some(h => h.name.toLowerCase() === newHousekeeperName.toLowerCase() && h.is_active)) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Une femme de chambre avec ce nom existe déjà"
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔧 Création femme de chambre:', newHousekeeperName);
      
      const housekeeper = await SupabaseService.createHousekeeper(hotel.id, newHousekeeperName);
      
      if (housekeeper) {
        toast({
          title: "Femme de chambre créée",
          description: `"${newHousekeeperName}" a été créée avec le code ${housekeeper.access_code}`
        });
        setNewHousekeeperName('');
        await loadHousekeepers();
        await refreshHousekeepers();
      } else {
        throw new Error('Création échouée');
      }
    } catch (error) {
      console.error('❌ Erreur création:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de créer la femme de chambre"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivateHousekeeper = async (id: string, name: string) => {
    try {
      const success = await SupabaseService.deactivateHousekeeper(id);
      
      if (success) {
        toast({
          title: "Femme de chambre désactivée",
          description: `"${name}" a été désactivée`
        });
        await loadHousekeepers();
        await refreshHousekeepers();
      } else {
        throw new Error('Désactivation échouée');
      }
    } catch (error) {
      console.error('❌ Erreur désactivation:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de désactiver la femme de chambre"
      });
    }
  };

  const handleGenerateAllCodes = async () => {
    if (!hotel?.id) return;

    setIsGeneratingCodes(true);
    try {
      console.log('🔄 Génération forcée des codes pour toutes les femmes de chambre...');
      
      const results = await CodeGenerationService.forceGenerateAllMissingCodes();
      
      if (results.errors.length > 0) {
        toast({
          variant: "destructive",
          title: "Génération avec erreurs",
          description: `${results.generated} codes générés, ${results.errors.length} erreurs rencontrées.`
        });
      } else {
        toast({
          title: "Codes générés",
          description: `${results.generated} code(s) d'accès généré(s) avec succès.`
        });
      }

      await loadHousekeepers();
      await refreshHousekeepers();
    } catch (error) {
      console.error('❌ Erreur génération codes:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de générer les codes d'accès"
      });
    } finally {
      setIsGeneratingCodes(false);
    }
  };

  const syncWithContext = async () => {
    if (!hotel?.id || housekeeperNames.length === 0) return;

    try {
      console.log('🔄 Synchronisation avec le contexte:', housekeeperNames);
      
      const results = await CodeGenerationService.ensureCodesForHotel(hotel.id, housekeeperNames);
      
      if (results > 0) {
        toast({
          title: "Synchronisation terminée",
          description: `${results} nouvelle(s) femme(s) de chambre créée(s)`
        });
        await loadHousekeepers();
      }
    } catch (error) {
      console.error('❌ Erreur synchronisation:', error);
    }
  };

  useEffect(() => {
    // Synchroniser automatiquement quand les noms changent dans le contexte
    syncWithContext();
  }, [housekeeperNames, hotel?.id]);

  if (!isSetupComplete || !hotel) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Configuration requise</h3>
          <p className="text-muted-foreground">
            Veuillez d'abord configurer votre hôtel pour gérer les femmes de chambre
          </p>
        </CardContent>
      </Card>
    );
  }

  const activeHousekeepers = housekeepers.filter(h => h.is_active);
  const hasHousekeepers = activeHousekeepers.length > 0;

  return (
    <div className="space-y-6">
      {/* Formulaire d'ajout */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Gestion des Femmes de Chambre
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="housekeeper-name">Nom de la femme de chambre</Label>
              <Input
                id="housekeeper-name"
                placeholder="Ex: Marie Dupont"
                value={newHousekeeperName}
                onChange={(e) => setNewHousekeeperName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateHousekeeper()}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleCreateHousekeeper}
                disabled={isLoading || !newHousekeeperName.trim()}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {isLoading ? 'Création...' : 'Ajouter'}
              </Button>
            </div>
          </div>
          
          {!hasHousekeepers && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Aucune femme de chambre n'est créée pour votre établissement. 
                Ajoutez des femmes de chambre pour pouvoir générer leurs codes d'accès.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Actions de gestion */}
      {hasHousekeepers && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Actions de gestion</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={loadHousekeepers}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Actualiser
                </Button>
                <Button
                  onClick={handleGenerateAllCodes}
                  disabled={isGeneratingCodes}
                  className="flex items-center gap-2"
                >
                  <Key className="h-4 w-4" />
                  {isGeneratingCodes ? 'Génération...' : 'Forcer génération codes'}
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Liste des femmes de chambre */}
      {hasHousekeepers && (
        <Card>
          <CardHeader>
            <CardTitle>
              Femmes de chambre actives ({activeHousekeepers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeHousekeepers.map((housekeeper) => (
                <div key={housekeeper.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <UserIcon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{housekeeper.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Key className="h-3 w-3" />
                        <span className="font-mono">{housekeeper.access_code}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Active
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeactivateHousekeeper(housekeeper.id, housekeeper.name)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};