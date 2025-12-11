import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserIcon } from "lucide-react";
import { HousekeeperManagement } from "@/components/HousekeeperManagement";

interface PersonnelSectionProps {
  housekeeperCount: number;
}

export const PersonnelSection = ({ housekeeperCount }: PersonnelSectionProps) => {
  return (
    <Card className="border-border/50 bg-gradient-to-br from-card to-card/80">
      <CardHeader className="border-b border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-success/10 text-success">
              <UserIcon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Personnel</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Gérez vos femmes de chambre et leurs codes d'accès
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="w-fit text-xs px-3 py-1">
            {housekeeperCount} membre{housekeeperCount > 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <HousekeeperManagement />
      </CardContent>
    </Card>
  );
};
