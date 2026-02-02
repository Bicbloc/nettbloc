/**
 * Composant Inventaire Linge
 * Extrait de Index.tsx pour modularité
 */

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LinenTypeManager } from "@/components/linen/LinenTypeManager";
import { LinenTrainingManager } from "@/components/linen/LinenTrainingManager";
import { LinenTaskAssignment } from "@/components/linen/LinenTaskAssignment";
import { AdminLinenInventory } from "@/components/linen/AdminLinenInventory";
import { PrintableRuler } from "@/components/linen/PrintableRuler";
import { LinenDeliveryManager } from "@/components/linen/LinenDeliveryManager";

interface LinenTabProps {
  currentHotelId: string | null;
  hotelName?: string;
}

export function LinenTab({ currentHotelId, hotelName }: LinenTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">🧺 Inventaire du linge</h2>
          <p className="text-muted-foreground">Gérer les types de linge, livraisons et inventaires</p>
        </div>
      </div>

      <Tabs defaultValue="types" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="types">Types de linge</TabsTrigger>
          <TabsTrigger value="deliveries">🚚 Livraisons</TabsTrigger>
          <TabsTrigger value="inventory">Saisie & Validation</TabsTrigger>
          <TabsTrigger value="tasks">Attribution des tâches</TabsTrigger>
          <TabsTrigger value="training">Entraînement IA</TabsTrigger>
          <TabsTrigger value="ruler">📏 Règle Étalon</TabsTrigger>
        </TabsList>

        <TabsContent value="types" className="space-y-4">
          {currentHotelId ? (
            <LinenTypeManager hotelId={currentHotelId} />
          ) : (
            <Alert>
              <AlertDescription>Aucun hôtel sélectionné</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="deliveries" className="space-y-4">
          {currentHotelId ? (
            <LinenDeliveryManager hotelId={currentHotelId} />
          ) : (
            <Alert>
              <AlertDescription>Aucun hôtel sélectionné</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          {currentHotelId ? (
            <AdminLinenInventory hotelId={currentHotelId} hotelName={hotelName} />
          ) : (
            <Alert>
              <AlertDescription>Aucun hôtel sélectionné</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          {currentHotelId ? (
            <LinenTaskAssignment hotelId={currentHotelId} />
          ) : (
            <Alert>
              <AlertDescription>Aucun hôtel sélectionné</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="training" className="space-y-4">
          {currentHotelId ? (
            <LinenTrainingManager hotelId={currentHotelId} />
          ) : (
            <Alert>
              <AlertDescription>Aucun hôtel sélectionné</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="ruler" className="space-y-4">
          {currentHotelId ? (
            <PrintableRuler hotelId={currentHotelId} hotelName={hotelName} />
          ) : (
            <Alert>
              <AlertDescription>Aucun hôtel sélectionné</AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
