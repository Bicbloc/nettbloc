/**
 * Composant Codes d'accès
 * Extrait de Index.tsx pour modularité
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Key, Bell } from "lucide-react";
import { HousekeeperAccessRequests } from "@/components/HousekeeperAccessRequests";
import { HousekeeperManagement } from "@/components/HousekeeperManagement";

interface AccessCodesTabProps {
  currentHotelId: string | null;
}

export function AccessCodesTab({ currentHotelId }: AccessCodesTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Gestion des codes d'accès
          </CardTitle>
          <CardDescription>
            Codes d'accès des femmes de chambre et demandes en attente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="requests" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="requests" className="relative">
                Demandes d'accès
                <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs animate-pulse">
                  !
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="codes">
                Codes existants
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="requests" className="space-y-4">
              <Alert className="bg-blue-50 border-blue-200">
                <Bell className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>📋 Comment ça marche ?</strong> Les femmes de chambre s'inscrivent et soumettent une demande avec votre code d'hôtel. 
                  Vous recevez une notification ici et pouvez <strong>valider</strong> ou <strong>suspendre</strong> leur accès.
                </AlertDescription>
              </Alert>
              
              <HousekeeperAccessRequests />
            </TabsContent>
            
            <TabsContent value="codes" className="space-y-4">
              <p className="text-muted-foreground">
                Codes d'accès des femmes de chambre déjà validées. 
                Gérez le personnel complet depuis l'onglet "Vue d'ensemble".
              </p>
              <div className="mt-4">
                <HousekeeperManagement />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
