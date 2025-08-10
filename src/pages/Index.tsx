import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useHousekeeping } from '@/contexts/HousekeepingContext';
import { Users, ListChecks, FileText, Settings, Trash2, Plus } from "lucide-react";


export default function Index() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [activeTab, setActiveTab] = useState<'rooms' | 'reports' | 'settings' | 'access-codes'>('rooms');
  const [hotelName, setHotelName] = useState(localStorage.getItem('selectedHotelName') || 'Hôtel non sélectionné');
  const [hotelCode, setHotelCode] = useState(localStorage.getItem('selectedHotelCode') || '');
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reportSavedEvent, setReportSavedEvent] = useState<Event | null>(null);
  const [reportSaveErrorEvent, setReportSaveErrorEvent] = useState<Event | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(true);
  const debouncedSave = useDebounce(saveToSupabase, 2000);

  const {
    roomData,
    setRoomData,
    addRoom,
    updateRoom,
    deleteRoom,
    housekeeperNames,
    addHousekeeper,
    deleteHousekeeper,
    housekeeperAssignments,
    assignHousekeeper,
    unassignHousekeeper,
    actionLog,
    logAction,
    clearActionLog,
    saveToSupabase
  } = useHousekeeping();
  
  useEffect(() => {
    const storedHotelName = localStorage.getItem('selectedHotelName');
    const storedHotelCode = localStorage.getItem('selectedHotelCode');
    if (storedHotelName) setHotelName(storedHotelName);
    if (storedHotelCode) setHotelCode(storedHotelCode);
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized && isAutoSaving) {
      debouncedSave();
    }
  }, [roomData, housekeeperAssignments, housekeeperNames, actionLog, isInitialized, isAutoSaving, debouncedSave]);

  useEffect(() => {
    const handleReportSaved = (event: Event) => {
      setReportSavedEvent(event);
      toast({
        title: "Rapport Sauvegardé",
        description: `Votre rapport a été sauvegardé avec succès.`,
      });
    };

    const handleReportSaveError = (event: Event) => {
      setReportSaveErrorEvent(event);
      const detail = (event as CustomEvent).detail;
      toast({
        title: "Erreur de Sauvegarde",
        description: `Erreur lors de la sauvegarde du rapport: ${detail?.error || 'Erreur inconnue'}`,
        variant: "destructive",
      });
    };

    window.addEventListener('report-saved', handleReportSaved);
    window.addEventListener('report-save-error', handleReportSaveError);

    return () => {
      window.removeEventListener('report-saved', handleReportSaved);
      window.removeEventListener('report-save-error', handleReportSaveError);
    };
  }, [toast]);
  
  const handleManageTeam = () => {
    setActiveTab('access-codes');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{hotelName}</h1>
            <p className="text-gray-600">
              {hotelCode ? `Code: ${hotelCode}` : 'Aucun code d\'hôtel défini'}
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/housekeeper-login")}>
              Changer d'hôtel
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              Déconnexion
            </Button>
          </div>
        </div>

        <nav className="container mx-auto px-4 py-2">
          <ul className="flex space-x-4">
            <li>
              <Button
                variant={activeTab === 'rooms' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('rooms')}
              >
                <ListChecks className="h-4 w-4 mr-2" />
                Chambres
              </Button>
            </li>
            <li>
              <Button
                variant={activeTab === 'reports' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('reports')}
              >
                <FileText className="h-4 w-4 mr-2" />
                Rapports
              </Button>
            </li>
            <li>
              <Button
                variant={activeTab === 'settings' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('settings')}
              >
                <Settings className="h-4 w-4 mr-2" />
                Paramètres
              </Button>
            </li>
          </ul>
        </nav>
      </header>

      <main className="container mx-auto px-4 py-8">
        {activeTab === 'rooms' && (
          <div className="space-y-6">
            <RoomList />
            
            <div className="text-center space-y-4">
              <Button 
                onClick={handleManageTeam}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105"
              >
                <Users className="h-5 w-5 mr-2" />
                Gérer l'équipe
              </Button>
              
              <div className="text-sm text-gray-600">
                <p>Configuration avancée et gestion des codes d'accès</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-6">
            <ReportList />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Paramètres</CardTitle>
                <CardDescription>
                  Configuration générale de l'application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-save">Sauvegarde automatique</Label>
                  <Switch
                    id="auto-save"
                    checked={isAutoSaving}
                    onCheckedChange={(checked) => {
                      setIsAutoSaving(checked);
                      if (!checked) {
                        debouncedSave.cancel();
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'access-codes' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Gestion de l'équipe</CardTitle>
                <CardDescription>
                  Ajouter et gérer les femmes de chambre
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  {housekeeperNames.map((name, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <p className="font-medium">{name}</p>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          confirm({
                            title: 'Supprimer?',
                            description: `Voulez-vous supprimer ${name} de la liste?`,
                            onConfirm: () => deleteHousekeeper(name),
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex">
                  <Input
                    placeholder="Nom de la femme de chambre"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (e.currentTarget.value) {
                          addHousekeeper(e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                  />
                  <Button
                    onClick={(e) => {
                      const input = (e.target as HTMLButtonElement)?.previousElementSibling as HTMLInputElement;
                      if (input?.value) {
                        addHousekeeper(input.value);
                        input.value = '';
                      }
                    }}
                    className="ml-2"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
