import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Building } from "lucide-react";

interface Hotel {
  id: string;
  name: string;
  hotel_code: string;
}

interface HotelSelectionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  availableHotels: Hotel[];
  onSelectHotel: (hotel: Hotel) => void;
}

export const HotelSelectionDialog = ({
  isOpen,
  onOpenChange,
  availableHotels,
  onSelectHotel
}: HotelSelectionDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sélectionner un hôtel</DialogTitle>
          <DialogDescription>
            Vous devez sélectionner un hôtel avant de distribuer les chambres.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {availableHotels.length === 0 ? (
            <div className="text-center py-4">
              <Building className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Aucun hôtel configuré</p>
              <p className="text-sm text-muted-foreground">
                Créez d'abord un hôtel dans la section Configuration
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableHotels.map((hotel) => (
                <div 
                  key={hotel.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => onSelectHotel(hotel)}
                >
                  <div className="flex items-center gap-3">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{hotel.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Code: {hotel.hotel_code}
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Sélectionner
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
