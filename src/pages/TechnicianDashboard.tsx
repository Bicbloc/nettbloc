import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Wrench, LogOut, Building2, AlertTriangle, ArrowLeft, Plus, ListChecks, Info, ClipboardList } from 'lucide-react';
import { IncidentList } from '@/components/incident/IncidentList';
import { IncidentReportWizard } from '@/components/incident/IncidentReportWizard';
import { useTechnicianAuth } from '@/contexts/TechnicianAuthContext';
import { TechnicianAccessRequest } from '@/components/TechnicianAccessRequest';
import { UserTypeGuard } from '@/hooks/use-user-type-guard';
import { StaffTasksList } from '@/components/tasks/StaffTasksList';
import { DailyInstructionsBanner } from '@/components/housekeeper/DailyInstructionsBanner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { StaffNotificationBanner } from '@/components/housekeeper/StaffNotificationBanner';
import { cn } from '@/lib/utils';

type TechTab = 'incidents' | 'tasks' | 'instructions' | 'report';

function TechnicianDashboardContent() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, currentHotelSession, loading, signOut } = useTechnicianAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TechTab>('incidents');

  useEffect(() => {
    const hotelId = currentHotelSession?.hotel_id;
    if (!hotelId) return;

    const channel = supabase
      .channel(`tech-incidents-${hotelId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'incidents',
        filter: `hotel_id=eq.${hotelId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['incidents', hotelId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentHotelSession?.hotel_id, queryClient]);

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
    toast({ title: "Déconnexion réussie", description: "À bientôt !" });
    navigate('/technician/login');
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentHotelSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-lg mx-auto space-y-6 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/technician/hotels')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
          
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Wrench className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-lg font-bold">{profile.name}</h1>
                  <p className="text-white/70 text-sm">Technicien</p>
                </div>
              </div>
            </div>
            <CardContent className="p-4">
              <Button variant="outline" onClick={handleLogout} className="w-full gap-2">
                <LogOut className="h-4 w-4" />
                Déconnexion
              </Button>
            </CardContent>
          </Card>

          <TechnicianAccessRequest />
        </div>
      </div>
    );
  }

  const initials = profile.name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  const tabs: { key: TechTab; label: string; icon: React.ElementType }[] = [
    { key: 'incidents', label: 'Incidents', icon: AlertTriangle },
    { key: 'report', label: 'Signaler', icon: Plus },
    { key: 'tasks', label: 'Tâches', icon: ClipboardList },
    { key: 'instructions', label: 'Consignes', icon: Info },
  ];

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      {/* App Header */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-blue-600 to-indigo-600 text-white safe-area-top">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <span className="font-bold text-base">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="text-white/70 text-xs font-medium">{greeting} 🔧</p>
                <h1 className="font-bold text-base truncate">{profile.name}</h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Building2 className="h-3 w-3 text-white/60 flex-shrink-0" />
                  <span className="text-xs text-white/70 truncate">{currentHotelSession.hotel_name}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button 
                variant="ghost" size="icon" 
                className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
                onClick={() => navigate('/technician/hotels')}
              >
                <Building2 className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" size="icon" 
                className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {activeTab === 'incidents' && (
          <div className="space-y-4">
            <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
              <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500 text-white">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold">Incidents</h2>
                    <p className="text-xs text-muted-foreground">Tous les incidents de l'hôtel</p>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <IncidentList hotelId={currentHotelSession.hotel_id} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'report' && (
          <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-green-500 text-white">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold">Signaler un incident</h2>
                  <p className="text-xs text-muted-foreground">Créer un nouveau signalement</p>
                </div>
              </div>
            </div>
            <div className="p-4 flex justify-center">
              <IncidentReportWizard 
                hotelId={currentHotelSession.hotel_id} 
                userType="technician"
                userName={profile.name}
                userId={profile.id}
              />
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <div className="bg-card rounded-2xl p-4 shadow-sm border bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500 text-white">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold">Tâches du jour</h2>
                  <p className="text-xs text-muted-foreground">Vos missions assignées</p>
                </div>
              </div>
            </div>
            <StaffTasksList
              hotelId={currentHotelSession.hotel_id}
              staffType="technician"
              staffId={profile.id}
              staffName={profile.name}
            />
          </div>
        )}

        {activeTab === 'instructions' && (
          <DailyInstructionsBanner hotelId={currentHotelSession.hotel_id} />
        )}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t safe-area-bottom">
        <div className="grid grid-cols-4 px-2 py-1">
          {tabs.map(({ key, label, icon: Icon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl transition-all duration-200",
                  isActive ? "text-blue-600" : "text-muted-foreground"
                )}
              >
                <div className={cn(
                  "relative p-1.5 rounded-xl transition-all duration-200",
                  isActive && "bg-blue-100 dark:bg-blue-950/30"
                )}>
                  <Icon className={cn("h-5 w-5", isActive && "scale-110")} />
                </div>
                <span className={cn(
                  "text-[10px] font-medium",
                  isActive ? "text-blue-600" : "text-muted-foreground"
                )}>
                  {label}
                </span>
                {isActive && (
                  <div className="absolute -bottom-1 w-5 h-0.5 rounded-full bg-blue-600" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function TechnicianDashboard() {
  return (
    <UserTypeGuard expectedType="technician">
      <TechnicianDashboardContent />
    </UserTypeGuard>
  );
}
