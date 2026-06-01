/**
 * Composant Incidents
 * Extrait de Index.tsx pour modularité
 */

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IncidentList } from "@/components/incident/IncidentList";
import { StaffManagement } from "@/components/incident/StaffManagement";
import { IncidentInventoryManager } from "@/components/incident/IncidentInventoryManager";
import { IncidentReportDialogSimple } from "@/components/incident/IncidentReportDialogSimple";
import { IncidentDashboard } from "@/components/incident/IncidentDashboard";
import { RolePermissionsManager } from "@/components/incident/RolePermissionsManager";
import { IncidentReportPrint } from "@/components/incident/IncidentReportPrint";

interface IncidentsTabProps {
  currentHotelId: string | null;
}

export function IncidentsTab({ currentHotelId }: IncidentsTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Gestion des incidents</h2>
          <p className="text-muted-foreground">Gérer les incidents, le personnel et l'inventaire</p>
        </div>
        {currentHotelId && (
          <IncidentReportDialogSimple hotelId={currentHotelId} userType="admin" />
        )}
      </div>

      <Tabs defaultValue="incidents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="incidents">Liste des incidents</TabsTrigger>
          <TabsTrigger value="dashboard">Tableau de bord</TabsTrigger>
          <TabsTrigger value="staff">Personnel</TabsTrigger>
          <TabsTrigger value="inventory">Inventaire</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="print">Imprimer rapport</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          {currentHotelId ? (
            <IncidentDashboard hotelId={currentHotelId} />
          ) : (
            <Alert>
              <AlertDescription>Aucun hôtel sélectionné pour afficher le tableau de bord</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="incidents" className="space-y-4">
          {currentHotelId ? (
            <IncidentList hotelId={currentHotelId} />
          ) : (
            <Alert>
              <AlertDescription>Aucun hôtel sélectionné pour gérer les incidents</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="staff" className="space-y-4">
          {currentHotelId ? (
            <StaffManagement hotelId={currentHotelId} />
          ) : (
            <Alert>
              <AlertDescription>Aucun hôtel sélectionné pour gérer le personnel</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          {currentHotelId ? (
            <IncidentInventoryManager hotelId={currentHotelId} />
          ) : (
            <Alert>
              <AlertDescription>Aucun hôtel sélectionné pour gérer l'inventaire</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          {currentHotelId ? (
            <RolePermissionsManager hotelId={currentHotelId} />
          ) : (
            <Alert>
              <AlertDescription>Aucun hôtel sélectionné pour gérer les permissions</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="print" className="space-y-4">
          {currentHotelId ? (
            <IncidentReportPrint hotelId={currentHotelId} />
          ) : (
            <Alert>
              <AlertDescription>Aucun hôtel sélectionné pour imprimer les rapports</AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
