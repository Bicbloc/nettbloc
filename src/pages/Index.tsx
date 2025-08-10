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
  const [activeTab, setActiveTab] = useState<'rooms' | 'reports' | 'settings' | 'access-codes'>('rooms');
  const [hotelName, setHotelName] = useState(localStorage.getItem('selectedHotelName') || 'Hôtel non sélectionné');
  const [hotelCode, setHotelCode] = useState(localStorage.getItem('selectedHotelCode') || '');
  const [isInitialized, setIsInitialized] = useState(false);

  const {
    roomData,
    housekeeperNames,
    addHousekeeper,
    removeHousekeeper,
    housekeeperAssignments
  } = useHousekeeping();
  
  useEffect(() => {
    const storedHotelName = localStorage.getItem('selectedHotelName');
    const storedHotelCode = localStorage.getItem('selectedHotelCode');
    if (storedHotelName) setHotelName(storedHotelName);
    if (storedHotelCode) setHotelCode(storedHotelCode);
    setIsInitialized(true);
  }, []);
  
  const handleManageTeam = () => {
    setActiveTab('access-codes');
  };

  const handleConfirmDelete = (name: string) => {
    if (window.confirm(`Voulez-vous supprimer ${name} de la liste?`)) {
      removeHousekeeper(name);
      toast({
        title: "Femme de chambre supprimée",
        description: `${name} a été supprimée de la liste`,
      });
    }
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
            <Card>
              <CardHeader>
                <CardTitle>Chambres</CardTitle>
                <CardDescription>
                  Gestion des chambres de l'hôtel
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center text-muted-foreground">
                  <p>Liste des chambres ({roomData.length} chambres)</p>
                  <p className="mt-2">Utilisez l'interface de gestion pour configurer les chambres</p>
                </div>
              </CardContent>
            </Card>
            
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
            <Card>
              <CardHeader>
                <CardTitle>Rapports</CardTitle>
                <CardDescription>
                  Historique des rapports de nettoyage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center text-muted-foreground">
                  <p>Aucun rapport disponible pour le moment</p>
                  <p className="mt-2">Les rapports apparaîtront ici une fois générés</p>
                </div>
              </CardContent>
            </Card>
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
                <div className="text-center text-muted-foreground">
                  <p>Configuration de l'application</p>
                  <p className="mt-2">Les paramètres avancés seront disponibles prochainement</p>
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
                    <div key={index} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{name}</p>
                        <div className="text-xs text-muted-foreground">
                          {housekeeperAssignments[name]?.length || 0} chambres assignées
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleConfirmDelete(name)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </Button>
                    </div>
                  ))}
                  
                  {housekeeperNames.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      <p>Aucune femme de chambre configurée</p>
                      <p className="text-sm mt-1">Ajoutez votre première femme de chambre ci-dessous</p>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Input
                    placeholder="Nom de la femme de chambre"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const value = e.currentTarget.value.trim();
                        if (value) {
                          addHousekeeper(value);
                          e.currentTarget.value = '';
                          toast({
                            title: "Femme de chambre ajoutée",
                            description: `${value} a été ajoutée à l'équipe`,
                          });
                        }
                      }
                    }}
                  />
                  <Button
                    onClick={(e) => {
                      const input = (e.target as HTMLButtonElement)?.previousElementSibling as HTMLInputElement;
                      const value = input?.value?.trim();
                      if (value) {
                        addHousekeeper(value);
                        input.value = '';
                        toast({
                          title: "Femme de chambre ajoutée",
                          description: `${value} a été ajoutée à l'équipe`,
                        });
                      }
                    }}
                    className="shrink-0"
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