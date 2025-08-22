import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { AccessCodeManagement } from './AccessCodeManagement';
import { HousekeeperSetupDialog } from './HousekeeperSetupDialog';
import { GeneralAccessCodes } from './GeneralAccessCodes';
import HousekeeperAccessCodes from './HousekeeperAccessCodes';
import { 
  Users, Plus, RefreshCw, Settings, Key, 
  UserCheck, AlertTriangle 
} from 'lucide-react';

interface HousekeeperManagementEnhancedProps {
  hotelId: string;
  onRefresh?: () => void;
}

export const HousekeeperManagementEnhanced: React.FC<HousekeeperManagementEnhancedProps> = ({
  hotelId,
  onRefresh
}) => {
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    onRefresh?.();
    toast({
      title: "Données actualisées",
      description: "Les informations ont été mises à jour"
    });
  };

  const handleHousekeepersConfirmed = (housekeepers: string[]) => {
    toast({
      title: "Configuration sauvegardée",
      description: `${housekeepers.length} femme(s) de chambre configurée(s)`
    });
    handleRefresh();
  };

  if (!user || !hotelId) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
            <p>Veuillez vous connecter et configurer votre hôtel</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-6 w-6" />
              Gestion complète des femmes de chambre
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleRefresh}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualiser
              </Button>
              <Button
                onClick={() => setShowSetupDialog(true)}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter femmes de chambre
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Gérez tous les aspects de vos femmes de chambre : configuration, codes d'accès, 
            invitations et suivi des activités.
          </p>
        </CardContent>
      </Card>

      {/* Onglets de gestion */}
      <Tabs defaultValue="codes" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="codes" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Codes d'accès
          </TabsTrigger>
          <TabsTrigger value="specific" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Codes spécifiques
          </TabsTrigger>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Codes généraux
          </TabsTrigger>
          <TabsTrigger value="management" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="codes" className="space-y-4">
          <AccessCodeManagement 
            key={`codes-${refreshKey}`}
            hotelId={hotelId} 
            onRefresh={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="specific" className="space-y-4">
          <HousekeeperAccessCodes 
            key={`specific-${refreshKey}`}
            hotelId={hotelId}
          />
        </TabsContent>

        <TabsContent value="general" className="space-y-4">
          <GeneralAccessCodes 
            key={`general-${refreshKey}`}
          />
        </TabsContent>

        <TabsContent value="management" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuration avancée
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <Button
                  onClick={() => setShowSetupDialog(true)}
                  variant="outline"
                  className="w-full justify-start"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter de nouvelles femmes de chambre
                </Button>
                
                <Button
                  onClick={handleRefresh}
                  variant="outline"
                  className="w-full justify-start"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Synchroniser avec la base de données
                </Button>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">💡 Conseils d'utilisation</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Les codes spécifiques sont assignés à une femme de chambre particulière</li>
                  <li>• Les codes généraux permettent un accès flexible sans assignation</li>
                  <li>• Utilisez l'onglet "Configuration" pour gérer votre équipe</li>
                  <li>• Les codes peuvent être copiés et partagés facilement</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de configuration */}
      <HousekeeperSetupDialog
        isOpen={showSetupDialog}
        onClose={() => setShowSetupDialog(false)}
        onHousekeepersConfirmed={handleHousekeepersConfirmed}
        hotelId={hotelId}
      />
    </div>
  );
};