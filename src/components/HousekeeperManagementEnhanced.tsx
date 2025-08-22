import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserIcon, Plus, Key, Trash2, RefreshCw, AlertTriangle, CheckCircle, Users, Search, Clock, Shield, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SupabaseService } from '@/services/supabaseService';
import { useAutoSetup } from '@/hooks/use-auto-setup';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Housekeeper {
  id: string;
  name: string;
  access_code: string;
  is_active: boolean;
  created_at: string;
  hotel_id: string;
  is_temporary?: boolean;
}

interface HousekeeperSession {
  id: string;
  user_name: string;
  login_time: string;
  last_activity: string;
  is_active: boolean;
  created_at: string;
  user_type: string;
}

interface AccessCodeInfo {
  id: string;
  access_code: string;
  invited_name: string | null;
  housekeeper_id: string | null;
  is_active: boolean;
  created_at: string;
  used_at: string | null;
  expires_at: string | null;
}

interface HousekeeperWithSession extends Housekeeper {
  session?: HousekeeperSession;
  lastSession?: HousekeeperSession;
  type: 'permanent' | 'temporary' | 'guest';
  status: 'online' | 'offline' | 'inactive';
}

export const HousekeeperManagementEnhanced = () => {
  const [housekeepers, setHousekeepers] = useState<Housekeeper[]>([]);
  const [sessions, setSessions] = useState<HousekeeperSession[]>([]);
  const [accessCodes, setAccessCodes] = useState<AccessCodeInfo[]>([]);
  const [newHousekeeperName, setNewHousekeeperName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { toast } = useToast();
  const { hotel, isSetupComplete } = useAutoSetup();

  // Données enrichies avec sessions et types
  const enrichedHousekeepers = useMemo((): HousekeeperWithSession[] => {
    const result: HousekeeperWithSession[] = [];

    // Traiter les femmes de chambre permanentes
    housekeepers.forEach(hk => {
      const currentSession = sessions.find(s => s.user_name === hk.name && s.is_active);
      const lastSession = sessions
        .filter(s => s.user_name === hk.name && !s.is_active)
        .sort((a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime())[0];

      result.push({
        ...hk,
        session: currentSession,
        lastSession,
        type: hk.is_temporary ? 'temporary' : 'permanent',
        status: currentSession ? 'online' : (hk.is_active ? 'offline' : 'inactive')
      });
    });

    // Traiter les codes généraux (invités)
    accessCodes
      .filter(code => !code.housekeeper_id && code.used_at)
      .forEach(code => {
        const guestSession = sessions.find(s => 
          s.user_name === 'Femme de chambre invitée' || 
          s.user_name === (code.invited_name || 'Invité')
        );
        
        result.push({
          id: `guest-${code.id}`,
          name: code.invited_name || 'Femme de chambre invitée',
          access_code: code.access_code,
          is_active: code.is_active,
          created_at: code.created_at,
          hotel_id: hotel?.id || '',
          session: guestSession,
          type: 'guest',
          status: guestSession?.is_active ? 'online' : 'offline'
        });
      });

    return result;
  }, [housekeepers, sessions, accessCodes, hotel?.id]);

  // Filtrage et recherche
  const filteredHousekeepers = useMemo(() => {
    if (!searchTerm.trim()) return enrichedHousekeepers;
    
    const term = searchTerm.toLowerCase();
    return enrichedHousekeepers.filter(h => 
      h.name.toLowerCase().includes(term) ||
      h.access_code.toLowerCase().includes(term) ||
      h.type.toLowerCase().includes(term)
    );
  }, [enrichedHousekeepers, searchTerm]);

  const activeHousekeepers = filteredHousekeepers.filter(h => h.status !== 'inactive');
  const inactiveHousekeepers = filteredHousekeepers.filter(h => h.status === 'inactive');
  const onlineHousekeepers = filteredHousekeepers.filter(h => h.status === 'online');

  useEffect(() => {
    if (hotel?.id) {
      loadAllData();
    }
  }, [hotel?.id]);

  // Actualisation automatique toutes les 30 secondes
  useEffect(() => {
    if (!hotel?.id) return;
    
    const interval = setInterval(() => {
      loadSessions();
    }, 30000);

    return () => clearInterval(interval);
  }, [hotel?.id]);

  const loadAllData = async () => {
    if (!hotel?.id) return;
    
    await Promise.all([
      loadHousekeepers(),
      loadSessions(),
      loadAccessCodes()
    ]);
  };

  const loadHousekeepers = async () => {
    if (!hotel?.id) return;
    
    try {
      const data = await SupabaseService.getHousekeepers(hotel.id);
      setHousekeepers(data as Housekeeper[]);
    } catch (error) {
      console.error('Erreur chargement femmes de chambre:', error);
    }
  };

  const loadSections = async () => {
    if (!hotel?.id) return;

    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('hotel_id', hotel.id)
        .eq('user_type', 'housekeeper')
        .order('last_activity', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Erreur chargement sessions:', error);
        return;
      }

      setSessions(data as HousekeeperSession[]);
    } catch (error) {
      console.error('Erreur sessions:', error);
    }
  };

  const loadAccessCodes = async () => {
    if (!hotel?.id) return;

    try {
      const { data, error } = await supabase
        .from('housekeeper_access_codes')
        .select('*')
        .eq('hotel_id', hotel.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur chargement codes:', error);
        return;
      }

      setAccessCodes(data as AccessCodeInfo[]);
    } catch (error) {
      console.error('Erreur codes d\'accès:', error);
    }
  };

  const loadSessions = loadSections; // Correction du nom de fonction

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
      const housekeeper = await SupabaseService.createHousekeeper(hotel.id, newHousekeeperName);
      
      if (housekeeper) {
        toast({
          title: "Femme de chambre créée",
          description: `"${newHousekeeperName}" a été créée avec le code ${housekeeper.access_code}`
        });
        setNewHousekeeperName('');
        await loadAllData();
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
    // Ne pas permettre de modifier les codes invités
    if (id.startsWith('guest-')) {
      toast({
        variant: "destructive",
        title: "Action non autorisée",
        description: "Les sessions invitées ne peuvent pas être modifiées"
      });
      return;
    }

    try {
      const success = currentStatus 
        ? await SupabaseService.deactivateHousekeeper(id)
        : await SupabaseService.activateHousekeeper(id);
      
      if (success) {
        toast({
          title: currentStatus ? "Femme de chambre désactivée" : "Femme de chambre réactivée",
          description: `"${name}" a été ${currentStatus ? 'désactivée' : 'réactivée'}`
        });
        await loadAllData();
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

  const getTypeInfo = (type: 'permanent' | 'temporary' | 'guest') => {
    switch (type) {
      case 'permanent':
        return {
          label: 'Permanent',
          icon: <UserIcon className="h-3 w-3" />,
          variant: 'default' as const,
          description: 'Femme de chambre permanente avec code personnalisé'
        };
      case 'temporary':
        return {
          label: 'Temporaire',
          icon: <Clock className="h-3 w-3" />,
          variant: 'secondary' as const,
          description: 'Session temporaire avec expiration'
        };
      case 'guest':
        return {
          label: 'Invité',
          icon: <Shield className="h-3 w-3" />,
          variant: 'outline' as const,
          description: 'Accès via code général sans compte spécifique'
        };
    }
  };

  const getStatusInfo = (status: 'online' | 'offline' | 'inactive') => {
    switch (status) {
      case 'online':
        return {
          label: 'En ligne',
          color: 'text-green-600',
          dot: 'bg-green-500',
          badge: 'default' as const
        };
      case 'offline':
        return {
          label: 'Hors ligne',
          color: 'text-gray-600',
          dot: 'bg-gray-400',
          badge: 'secondary' as const
        };
      case 'inactive':
        return {
          label: 'Inactif',
          color: 'text-red-600',
          dot: 'bg-red-500',
          badge: 'outline' as const
        };
    }
  };

  const formatTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: fr });
    } catch {
      return 'Inconnu';
    }
  };

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
      {/* En-tête avec statistiques */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Gestion des Femmes de Chambre
              </CardTitle>
              <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                <span>{onlineHousekeepers.length} en ligne</span>
                <span>{activeHousekeepers.length} actives</span>
                <span>{inactiveHousekeepers.length} inactives</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-2"
              >
                <History className="h-4 w-4" />
                {showHistory ? 'Masquer historique' : 'Voir historique'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadAllData}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Actualiser
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Barre de recherche */}
          <div className="space-y-2">
            <Label htmlFor="search">Rechercher une femme de chambre</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Rechercher par nom, code d'accès ou type..."
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
        </CardContent>
      </Card>

      {/* Femmes de chambre actives */}
      {activeHousekeepers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Femmes de chambre actives ({activeHousekeepers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeHousekeepers.map((housekeeper) => {
                const typeInfo = getTypeInfo(housekeeper.type);
                const statusInfo = getStatusInfo(housekeeper.status);
                
                return (
                  <div key={housekeeper.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {typeInfo.icon}
                        <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${statusInfo.dot}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{housekeeper.name}</p>
                          <Badge variant={typeInfo.variant} className="flex items-center gap-1">
                            {typeInfo.icon}
                            {typeInfo.label}
                          </Badge>
                          <Badge variant={statusInfo.badge} className={statusInfo.color}>
                            {statusInfo.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Key className="h-3 w-3" />
                          <span className="font-mono">{housekeeper.access_code}</span>
                        </div>
                        {housekeeper.session && (
                          <p className="text-xs text-muted-foreground">
                            Connecté depuis {formatTimeAgo(housekeeper.session.last_activity)}
                          </p>
                        )}
                        {!housekeeper.session && housekeeper.lastSession && showHistory && (
                          <p className="text-xs text-muted-foreground">
                            Dernière connexion: {formatTimeAgo(housekeeper.lastSession.last_activity)}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {housekeeper.type !== 'guest' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleHousekeeper(housekeeper.id, housekeeper.name, housekeeper.is_active)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                          Désactiver
                        </Button>
                      )}
                      {housekeeper.type === 'guest' && (
                        <Badge variant="outline" className="text-muted-foreground">
                          Lecture seule
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
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
              {inactiveHousekeepers.map((housekeeper) => {
                const typeInfo = getTypeInfo(housekeeper.type);
                
                return (
                  <div key={housekeeper.id} className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      {typeInfo.icon}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-muted-foreground">{housekeeper.name}</p>
                          <Badge variant="outline" className="text-muted-foreground">
                            {typeInfo.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Key className="h-3 w-3" />
                          <span className="font-mono">{housekeeper.access_code}</span>
                        </div>
                        {housekeeper.lastSession && showHistory && (
                          <p className="text-xs text-muted-foreground">
                            Dernière activité: {formatTimeAgo(housekeeper.lastSession.last_activity)}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {housekeeper.type !== 'guest' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleHousekeeper(housekeeper.id, housekeeper.name, false)}
                          className="text-green-600 hover:text-green-700"
                        >
                          <CheckCircle className="h-3 w-3" />
                          Réactiver
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {filteredHousekeepers.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune femme de chambre</h3>
            <p className="text-muted-foreground">
              {searchTerm ? 'Aucun résultat pour cette recherche' : 'Ajoutez des femmes de chambre pour commencer'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Légende des types */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Légende des types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {(['permanent', 'temporary', 'guest'] as const).map(type => {
              const info = getTypeInfo(type);
              return (
                <div key={type} className="flex items-center gap-2">
                  <Badge variant={info.variant} className="flex items-center gap-1">
                    {info.icon}
                    {info.label}
                  </Badge>
                  <span className="text-muted-foreground text-xs">{info.description}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};