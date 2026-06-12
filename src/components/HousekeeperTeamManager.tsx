import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Search, Clock, CheckCircle } from 'lucide-react';
import { HousekeeperInviteDialog } from './HousekeeperInviteDialog';
import { HousekeeperAccessCodeGenerator } from './HousekeeperAccessCodeGenerator';

interface Housekeeper {
  id: string;
  name: string;
  access_code: string;
  is_temporary: boolean;
  is_active: boolean;
  created_at: string;
  invited_email?: string;
  last_connection?: string;
}

interface HousekeeperTeamManagerProps {
  hotelId: string;
}

export const HousekeeperTeamManager: React.FC<HousekeeperTeamManagerProps> = ({
  hotelId
}) => {
  const [housekeepers, setHousekeepers] = useState<Housekeeper[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHousekeepers, setSelectedHousekeepers] = useState<string[]>([]);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchHousekeepers();
  }, [hotelId]);

  const fetchHousekeepers = async () => {
    try {
      // D'abord, récupérer le rôle "Femme de chambre"
      const { data: roles, error: rolesError } = await supabase
        .from('staff_roles')
        .select('id, name')
        .eq('hotel_id', hotelId)
        .eq('is_active', true);

      if (rolesError) throw rolesError;

      const housekeeperRole = roles?.find(role => role.name.toLowerCase() === "femme de chambre");

      // Fetch from housekeepers table - uniquement les femmes de chambre
      let housekeepersQuery = supabase
        .from('housekeepers')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('is_active', true);

      // Si le rôle "Femme de chambre" existe, filtrer dessus
      if (housekeeperRole) {
        housekeepersQuery = housekeepersQuery.eq('role_id', housekeeperRole.id);
      }

      const { data: housekeepersData, error: housekeepersError } = await housekeepersQuery
        .order('created_at', { ascending: false });

      // Fetch from access codes with invite info
      const { data: codesData, error: codesError } = await supabase
        .from('housekeeper_access_codes')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      // Get recent sessions for last connection info
      const { data: sessionsData } = await supabase
        .from('hotel_access_sessions')
        .select('housekeeper_profile_id, started_at')
        .eq('hotel_id', hotelId)
        .order('started_at', { ascending: false });

      const allHousekeepers: Housekeeper[] = [];

      // Add housekeepers from housekeepers table
      if (housekeepersData) {
        housekeepersData.forEach(hk => {
          allHousekeepers.push({
            id: hk.id,
            name: hk.name,
            access_code: hk.access_code,
            is_temporary: hk.is_temporary || false,
            is_active: hk.is_active,
            created_at: hk.created_at
          });
        });
      }

      // Add invited housekeepers from access codes
      if (codesData) {
        codesData.forEach(code => {
          if (code.invited_name && !allHousekeepers.find(hk => hk.access_code === code.access_code)) {
            allHousekeepers.push({
              id: code.id,
              name: code.invited_name,
              access_code: code.access_code,
              is_temporary: true,
              is_active: true,
              created_at: code.created_at,
              invited_email: code.invited_email
            });
          }
        });
      }

      setHousekeepers(allHousekeepers);
    } catch (error) {
      console.error('Error fetching housekeepers:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger l'équipe",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredHousekeepers = housekeepers.filter(hk =>
    hk.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hk.access_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleHousekeeperSelection = (id: string) => {
    setSelectedHousekeepers(prev =>
      prev.includes(id)
        ? prev.filter(hkId => hkId !== id)
        : [...prev, id]
    );
  };

  const markAsPermanent = async (housekeeperId: string) => {
    try {
      const { error } = await supabase
        .from('housekeepers')
        .update({ is_temporary: false })
        .eq('id', housekeeperId);

      if (error) throw error;

      await fetchHousekeepers();
      toast({
        title: "Succès",
        description: "Femme de chambre marquée comme permanente"
      });
    } catch (error) {
      console.error('Error updating housekeeper:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour",
        variant: "destructive"
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Équipe des femmes de chambre
          </CardTitle>
          <Button onClick={() => setShowInviteDialog(true)} className="animate-spotlight">
            <UserPlus className="h-4 w-4 mr-2" />
            Inviter une femme de chambre
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Créez une femme de chambre manuellement pour obtenir son code d'accès, ou
          communiquez-lui un code : elle pourra alors soumettre sa demande pour rejoindre l'hôtel.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>

          {selectedHousekeepers.length > 0 && (
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">
                {selectedHousekeepers.length} femme(s) de chambre sélectionnée(s) pour cette session
              </p>
            </div>
          )}

          <div className="space-y-2">
            {isLoading ? (
              <p className="text-center text-muted-foreground">Chargement...</p>
            ) : filteredHousekeepers.length === 0 ? (
              <p className="text-center text-muted-foreground">
                Aucune femme de chambre trouvée
              </p>
            ) : (
              filteredHousekeepers.map(housekeeper => (
                <div
                  key={housekeeper.id}
                  className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedHousekeepers.includes(housekeeper.id)}
                    onCheckedChange={() => toggleHousekeeperSelection(housekeeper.id)}
                  />
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{housekeeper.name}</span>
                      {housekeeper.is_temporary ? (
                        <Badge variant="secondary" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          Temporaire
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Permanente
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {housekeeper.invited_email && (
                        <span className="ml-2">• {housekeeper.invited_email}</span>
                      )}
                    </div>
                  </div>

                  {housekeeper.is_temporary && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markAsPermanent(housekeeper.id)}
                    >
                      Rendre permanente
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>

      {/* Dialogs pour la gestion des femmes de chambre */}
      <div className="space-y-4">
        <HousekeeperAccessCodeGenerator 
          hotelId={hotelId}
          onCodeGenerated={(code, email) => {
            fetchHousekeepers(); // Rafraîchir la liste
          }}
        />
        
        <HousekeeperInviteDialog
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
          hotelId={hotelId}
        />
      </div>
    </Card>
  );
};
