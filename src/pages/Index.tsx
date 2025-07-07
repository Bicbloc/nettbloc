import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Smartphone, FileSpreadsheet, Hotel } from 'lucide-react';
import { NotificationPanel } from '@/components/NotificationPanel';
import { HotelSetup } from '@/components/HotelSetup';
import { HousekeeperSetup } from '@/components/HousekeeperSetup';
import { useHousekeeping } from '@/contexts/HousekeepingContext';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const { housekeeperNames, rooms, isDistributed } = useHousekeeping();
  const navigate = useNavigate();
  const [currentHotelId, setCurrentHotelId] = useState<string | null>(null);

  const handleMobileAccess = () => {
    if (!isDistributed) {
      alert('Veuillez d\'abord distribuer les chambres');
      return;
    }
    navigate('/housekeeper');
  };

  return (
    <div className="min-h-screen bg-gradient-secondary">
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Nettobloc</h1>
            <p className="text-muted-foreground">Gestion intelligente du nettoyage hôtelier</p>
          </div>
          <div className="flex items-center gap-4">
            <NotificationPanel />
            <Button
              onClick={handleMobileAccess}
              className="bg-gradient-primary"
              size="sm"
            >
              <Smartphone className="h-4 w-4 mr-2" />
              Interface Mobile
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Chambres Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{rooms.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Femmes de Chambre</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{housekeeperNames.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {isDistributed ? '✓' : '✗'}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="assignment" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="assignment" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Attribution
            </TabsTrigger>
            <TabsTrigger value="setup" className="flex items-center gap-2">
              <Hotel className="h-4 w-4" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Rapports
            </TabsTrigger>
            <TabsTrigger value="mobile" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Mobile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assignment">
            <Card>
              <CardHeader>
                <CardTitle>Attribution des Chambres</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Distribuez automatiquement les chambres aux femmes de chambre disponibles.
                </p>
                
                <div className="grid gap-4 md:grid-cols-2 mb-6">
                  <div>
                    <h3 className="font-semibold mb-2">Chambres à Nettoyer</h3>
                    <p className="text-2xl font-bold">
                      {rooms.filter(r => r.cleaningType !== 'none' && !r.assignedTo).length}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Femmes de Chambre</h3>
                    <p className="text-2xl font-bold">{housekeeperNames.length}</p>
                  </div>
                </div>
                
                {housekeeperNames.length === 0 ? (
                  <p className="text-orange-600">
                    ⚠️ Aucune femme de chambre configurée. Ajoutez-en dans l'onglet Configuration.
                  </p>
                ) : rooms.length === 0 ? (
                  <p className="text-orange-600">
                    ⚠️ Aucune chambre importée. Importez un fichier PDF pour commencer.
                  </p>
                ) : (
                  <p className="text-green-600">
                    ✓ Prêt pour la distribution automatique
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="setup" className="space-y-6">
            {!currentHotelId ? (
              <HotelSetup onHotelCreated={(hotelId) => setCurrentHotelId(hotelId)} />
            ) : (
              <HousekeeperSetup hotelId={currentHotelId} />
            )}
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>Rapports</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Fonctionnalité de rapports à venir...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mobile">
            <Card>
              <CardHeader>
                <CardTitle>Interface Mobile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Interface dédiée aux femmes de chambre pour le suivi en temps réel.
                </p>
                
                {isDistributed ? (
                  <div className="space-y-4">
                    <p className="text-green-600 font-medium">
                      ✓ Les chambres sont distribuées. L'interface mobile est accessible.
                    </p>
                    <Button
                      onClick={() => navigate('/housekeeper')}
                      className="bg-gradient-primary"
                      size="lg"
                    >
                      <Smartphone className="h-4 w-4 mr-2" />
                      Accéder à l'Interface Mobile
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-orange-600 font-medium">
                      ⚠️ Vous devez d'abord distribuer les chambres depuis l'onglet Attribution.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Une fois les chambres distribuées, les femmes de chambre pourront accéder 
                      à leur interface mobile avec leur code d'accès à 4 chiffres.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;