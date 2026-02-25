import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Wrench, LogOut, Building2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IncidentList } from '@/components/incident/IncidentList';
import { IncidentReportWizard } from '@/components/incident/IncidentReportWizard';
import { useTechnicianAuth } from '@/contexts/TechnicianAuthContext';
import { TechnicianAccessRequest } from '@/components/TechnicianAccessRequest';
import { UserTypeGuard } from '@/hooks/use-user-type-guard';
import { StaffTasksList } from '@/components/tasks/StaffTasksList';
import { DailyInstructionsBanner } from '@/components/housekeeper/DailyInstructionsBanner';

function TechnicianDashboardContent() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, currentHotelSession, loading, signOut } = useTechnicianAuth();

  useEffect(() => {
    if (!loading && !profile) {
      toast({
        variant: "destructive",
        title: "Session expirée",
        description: "Veuillez vous reconnecter"
      });
      navigate('/technician/login');
    }
  }, [loading, profile, navigate, toast]);

  const handleLogout = async () => {
    await signOut();
    toast({
      title: "Déconnexion réussie",
      description: "À bientôt !"
    });
    navigate('/technician/login');
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100 flex items-center justify-center">
        <div className="animate-pulse">Chargement...</div>
      </div>
    );
  }

  if (!currentHotelSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/technician/login')}
            className="flex items-center gap-2 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Retour</span>
          </Button>
          
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-3 rounded-full">
                    <Wrench className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{profile.name}</CardTitle>
                    <div className="text-sm text-muted-foreground">Technicien</div>
                  </div>
                </div>
                <Button variant="outline" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Déconnexion
                </Button>
              </div>
            </CardHeader>
          </Card>

          <TechnicianAccessRequest />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Bouton Retour */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/technician/login')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Retour</span>
        </Button>

        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-3 rounded-full">
                  <Wrench className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">{profile.name}</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    {currentHotelSession.hotel_name}
                  </div>
                </div>
              </div>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Déconnexion
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Consignes du jour */}
        <DailyInstructionsBanner hotelId={currentHotelSession.hotel_id} />

        {/* Tâches du jour */}
        <StaffTasksList
          hotelId={currentHotelSession.hotel_id}
          staffType="technician"
          staffId={profile.id}
          staffName={profile.name}
        />

        {/* Main Content */}
        <Tabs defaultValue="incidents" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="incidents">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Tous les incidents
            </TabsTrigger>
            <TabsTrigger value="new">
              <Wrench className="h-4 w-4 mr-2" />
              Signaler un incident
            </TabsTrigger>
          </TabsList>

          <TabsContent value="incidents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gestion des incidents</CardTitle>
              </CardHeader>
              <CardContent>
                <IncidentList hotelId={currentHotelSession.hotel_id} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="new">
            <Card>
              <CardHeader>
                <CardTitle>Signaler un nouvel incident</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <IncidentReportWizard 
                  hotelId={currentHotelSession.hotel_id} 
                  userType="technician"
                  userName={profile.name}
                  userId={profile.id}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Wrapper avec le guard de type d'utilisateur
export default function TechnicianDashboard() {
  return (
    <UserTypeGuard expectedType="technician">
      <TechnicianDashboardContent />
    </UserTypeGuard>
  );
}
