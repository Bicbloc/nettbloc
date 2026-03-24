import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserIcon, Plus, Trash2, RefreshCw, AlertTriangle, CheckCircle, Users, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SupabaseService } from '@/services/supabaseService';
import { CodeGenerationService } from '@/services/codeGenerationService';
import { useHousekeeping } from '@/contexts/HousekeepingContext';
import { useAutoSetup } from '@/hooks/use-auto-setup';
import { supabase } from '@/integrations/supabase/client';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingCodes, setIsGeneratingCodes] = useState(false);
  const { toast } = useToast();
  const { hotel, isSetupComplete } = useAutoSetup();
  const { housekeeperNames, setHousekeeperNames, refreshHousekeepers } = useHousekeeping();

  // Filtrage et recherche optimisés - DOIT être avant le return conditionnel
  const filteredHousekeepers = useMemo(() => {
    if (!searchTerm.trim()) return housekeepers;
    
    const term = searchTerm.toLowerCase();
    return housekeepers.filter(h => 
      h.name.toLowerCase().includes(term) ||
      h.access_code.toLowerCase().includes(term)
    );
  }, [housekeepers, searchTerm]);

  const assignedHousekeepers = useMemo(() => 
    filteredHousekeepers.filter(h => 
      h.is_active && housekeeperNames.includes(h.name)
    ), [filteredHousekeepers, housekeeperNames]
  );

  const inactiveHousekeepers = useMemo(() => 
    filteredHousekeepers.filter(h => !h.is_active), 
    [filteredHousekeepers]
  );

  const hasHousekeepers = housekeepers.length > 0;

  // Suggestions pour éviter les doublons
  const existingNames = housekeepers.map(h => h.name.toLowerCase());
  const suggestedNames = useMemo(() => {
    if (!newHousekeeperName.trim()) return [];
    
    const input = newHousekeeperName.toLowerCase();
    return existingNames
      .filter(name => name.includes(input) && name !== input)
      .slice(0, 3);
  }, [newHousekeeperName, existingNames]);

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
    const trimmedName = newHousekeeperName.trim();
    
    if (!trimmedName) {
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

    // Vérifier si le nom existe déjà (insensible à la casse)
    const nameExists = housekeepers.some(
      h => h.name.toLowerCase() === trimmedName.toLowerCase() && h.is_active
    );
    
    if (nameExists) {
      toast({
        variant: "destructive",
        title: "Doublon détecté",
        description: `Une femme de chambre nommée "${trimmedName}" existe déjà`
      });
      return;
    }

    setIsLoading(true);
    try {
      
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
      
      // Récupérer les femmes de chambre sans codes
      const missingHousekeepers = housekeepers
        .filter(h => h.is_active && (!h.access_code || h.access_code.trim() === ''));

      if (missingHousekeepers.length === 0) {
        toast({
          title: "Aucune action nécessaire",
          description: "Tous les codes d'accès sont déjà générés."
        });
        return;
      }

      // Générer les codes un par un directement
      let generated = 0;
      const errors: string[] = [];

      // Récupérer le code de l'hôtel
      const { data: hotelData } = await supabase
        .from('hotels')
        .select('hotel_code')
        .eq('id', hotel.id)
        .single();

      const hotelCode = hotelData?.hotel_code || 'HTL';

      for (const housekeeper of missingHousekeepers) {
        try {
          const accessCode = await CodeGenerationService.generateUniqueCode(hotelCode, housekeeper.name);
          
          await supabase
            .from('housekeepers')
            .update({ access_code: accessCode })
            .eq('id', housekeeper.id);
          
          generated++;
        } catch (error: any) {
          errors.push(`${housekeeper.name}: ${error.message}`);
        }
      }
      
      if (errors.length > 0) {
        toast({
          variant: "destructive",
          title: "Génération avec erreurs",
          description: `${generated} codes générés, ${errors.length} erreurs.`
        });
      } else {
        toast({
          title: "Codes générés",
          description: `${generated} code(s) d'accès généré(s) avec succès.`
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
    toast({
      title: "Synchronisation désactivée",
      description: "Veuillez créer les femmes de chambre manuellement via le bouton 'Ajouter'."
    });
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
          {/* Barre de recherche */}
          <div className="space-y-2">
            <Label htmlFor="search">Rechercher une femme de chambre</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Rechercher par nom ou code d'accès..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Formulaire d'ajout */}
          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="housekeeper-name">Nom de la femme de chambre</Label>
              <Input
                id="housekeeper-name"
                placeholder="Ex: Marie Dupont"
                value={newHousekeeperName}
                onChange={(e) => setNewHousekeeperName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateHousekeeper()}
              />
              
              {/* Suggestions pour éviter les doublons */}
              {suggestedNames.length > 0 && (
                <div className="text-sm text-amber-600">
                  <span>⚠️ Noms similaires existants: </span>
                  {suggestedNames.map((name, i) => (
                    <span key={name}>
                      {i > 0 && ', '}
                      <button
                        type="button"
                        className="underline hover:no-underline"
                        onClick={() => setNewHousekeeperName(name)}
                      >
                        {name}
                      </button>
                    </span>
                  ))}
                </div>
              )}
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
                    <p className="font-medium">{housekeeper.name}</p>
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
                    <p className="font-medium text-muted-foreground">{housekeeper.name}</p>
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