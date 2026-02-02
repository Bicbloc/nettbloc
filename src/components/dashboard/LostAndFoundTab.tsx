import { Alert, AlertDescription } from "@/components/ui/alert";
import { Package, AlertTriangle } from "lucide-react";
import { LostItemReportWizard } from "@/components/lost-and-found/LostItemReportWizard";
import { LostAndFoundList } from "@/components/lost-and-found/LostAndFoundList";

interface LostAndFoundTabProps {
  currentHotelId: string | null;
}

export function LostAndFoundTab({ currentHotelId }: LostAndFoundTabProps) {
  if (!currentHotelId) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Veuillez sélectionner un hôtel pour gérer les objets trouvés.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            Objets Trouvés
          </h2>
          <p className="text-muted-foreground">
            Gérez les objets trouvés et leur restitution aux clients
          </p>
        </div>
        <LostItemReportWizard
          hotelId={currentHotelId}
          reporterName="Admin"
          reporterType="admin"
        />
      </div>

      <LostAndFoundList hotelId={currentHotelId} />
    </div>
  );
}
