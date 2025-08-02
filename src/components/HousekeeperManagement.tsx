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

  const handleToggleHousekeeper = async (id: string, name: string, currentStatus: boolean) => {
    try {
      const success = currentStatus 
        ? await SupabaseService.deactivateHousekeeper(id)
        : await SupabaseService.activateHousekeeper(id);
      
      if (success) {
        toast({
          title: currentStatus ? "Femme de chambre désactivée" : "Femme de chambre réactivée",
          description: `"${name}" a été ${currentStatus ? 'désactivée' : 'réactivée'}`
        });
        await loadHousekeepers();
        await refreshHousekeepers();
      } else {
        throw new Error('Changement de statut échoué');
      }
    } catch (error) {
      console.error('❌ Erreur changement statut:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de modifier le statut"
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

  const handleCleanupAll = async () => {
    if (!hotel?.id) return;

    if (!confirm('Êtes-vous sûr de vouloir supprimer TOUTES les femmes de chambre et leurs codes d\'accès ? Cette action est irréversible.')) {
      return;
    }

    setIsLoading(true);
    try {
      console.log('🧹 Nettoyage de toutes les femmes de chambre...');
      
      const result = await SupabaseService.cleanupAllHousekeepers(hotel.id);
      
      if (result) {
        toast({
          title: "Nettoyage terminé",
          description: `${result.deleted_housekeepers} femme(s) de chambre et ${result.deleted_codes} code(s) supprimé(s).`
        });
        await loadHousekeepers();
        await refreshHousekeepers();
      } else {
        throw new Error('Nettoyage échoué');
      }
    } catch (error) {
      console.error('❌ Erreur nettoyage:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de nettoyer les femmes de chambre"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const syncWithContext = async () => {
    if (!hotel?.id || housekeeperNames.length === 0) return;

    try {
      console.log('🔄 Synchronisation avec le contexte (femmes assignées uniquement):', housekeeperNames);
      
      const results = await CodeGenerationService.ensureCodesForAssignedHousekeepers(hotel.id, housekeeperNames);
      
      if (results > 0) {
        toast({
          title: "Synchronisation terminée",
          description: `${results} code(s) d'accès généré(s) pour les femmes assignées`
        });
        await loadHousekeepers();
      }
    } catch (error) {
      console.error('❌ Erreur synchronisation:', error);
    }
  };

  useEffect(() => {
    // Synchroniser automatiquement quand les noms changent dans le contexte
    if (hotel?.id && housekeeperNames.length > 0) {
      syncWithContext();
    }
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

  // Filtrer uniquement les femmes de chambre assignées à des chambres
  const assignedHousekeepers = housekeepers.filter(h => 
    h.is_active && housekeeperNames.includes(h.name)
  );
  const inactiveHousekeepers = housekeepers.filter(h => !h.is_active);
  const hasHousekeepers = housekeepers.length > 0;

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
          
          {assignedHousekeepers.length === 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Aucune femme de chambre n'est assignée à des chambres dans ce rapport. 
                Allez dans l'onglet "Distribution" pour assigner des chambres aux femmes de chambre.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Actions de gestion */}
      {assignedHousekeepers.length > 0 && (
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
                <Button
                  variant="destructive"
                  onClick={handleCleanupAll}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  {isLoading ? 'Suppression...' : 'Supprimer tout'}
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Femmes de chambre assignées aux chambres */}
      {assignedHousekeepers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Femmes de chambre assignées ({assignedHousekeepers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {assignedHousekeepers.map((housekeeper) => (
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
                      onClick={() => handleToggleHousekeeper(housekeeper.id, housekeeper.name, true)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                      Désactiver
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Femmes de chambre inactives */}
      {inactiveHousekeepers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Femmes de chambre désactivées ({inactiveHousekeepers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {inactiveHousekeepers.map((housekeeper) => (
                <div key={housekeeper.id} className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <UserIcon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-muted-foreground">{housekeeper.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Key className="h-3 w-3" />
                        <span className="font-mono">{housekeeper.access_code}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-muted-foreground">
                      Inactif
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleHousekeeper(housekeeper.id, housekeeper.name, false)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <CheckCircle className="h-3 w-3" />
                      Réactiver
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