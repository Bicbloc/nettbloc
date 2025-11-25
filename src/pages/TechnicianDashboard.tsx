import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Wrench, LogOut, Building2, AlertTriangle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IncidentList } from '@/components/incident/IncidentList';
import { IncidentReportDialogSimple } from '@/components/incident/IncidentReportDialogSimple';

export default function TechnicianDashboard() {
  const [session, setSession] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const sessionData = localStorage.getItem('technicianSession');
    if (!sessionData) {
      toast({
        variant: "destructive",
        title: "Session expirée",
        description: "Veuillez vous reconnecter"
      });
      navigate('/technician/login');
      return;
    }

    setSession(JSON.parse(sessionData));
  }, [navigate, toast]);

  const handleLogout = () => {
    localStorage.removeItem('technicianSession');
    toast({
      title: "Déconnexion réussie",
      description: "À bientôt !"
    });
    navigate('/technician/login');
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100 flex items-center justify-center">
        <div className="animate-pulse">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-3 rounded-full">
                  <Wrench className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">{session.technicianName}</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    {session.hotelName}
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
                <IncidentList hotelId={session.hotelId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="new">
            <Card>
              <CardHeader>
                <CardTitle>Signaler un nouvel incident</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <IncidentReportDialogSimple 
                  hotelId={session.hotelId} 
                  userType="admin"
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
