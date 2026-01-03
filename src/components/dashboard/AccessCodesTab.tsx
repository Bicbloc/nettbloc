/**
 * Composant Demandes d'accès
 * Gestion des demandes d'accès des femmes de chambre
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserPlus, Bell } from "lucide-react";
import { HousekeeperAccessRequests } from "@/components/HousekeeperAccessRequests";

interface AccessCodesTabProps {
  currentHotelId: string | null;
}

export function AccessCodesTab({ currentHotelId }: AccessCodesTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Demandes d'accès
          </CardTitle>
          <CardDescription>
            Validez les demandes des femmes de chambre qui souhaitent rejoindre votre établissement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-blue-50 border-blue-200">
            <Bell className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>📋 Comment ça marche ?</strong> Les femmes de chambre s'inscrivent sur l'application, 
              puis soumettent une demande avec votre code d'hôtel. Vous recevez une notification ici et 
              pouvez <strong>valider</strong> ou <strong>refuser</strong> leur accès.
            </AlertDescription>
          </Alert>
          
          <HousekeeperAccessRequests />
        </CardContent>
      </Card>
    </div>
  );
}
