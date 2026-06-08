import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardCheck, Layers, UserCheck } from "lucide-react";
import { Room } from "@/services/pdfService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface InspectionRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: Room[];
  hotelId: string;
}

interface Governess {
  id: string;
  name: string;
}

const todayDate = () => new Date().toISOString().split("T")[0];

export function InspectionRequestDialog({ open, onOpenChange, rooms, hotelId }: InspectionRequestDialogProps) {
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [governesses, setGovernesses] = useState<Governess[]>([]);
  const [selectedGoverness, setSelectedGoverness] = useState<string>("");

  // Load approved governesses for this hotel
  useEffect(() => {
    if (!open || !hotelId) return;
    (async () => {
      const { data } = await supabase
        .from("governess_access_requests")
        .select("governess_profile_id, status, governess_profiles(id, name)")
        .eq("hotel_id", hotelId)
        .eq("status", "approved");
      const list: Governess[] = ((data as any[]) || []).map((g) => ({
        id: g.governess_profile_id,
        name: g.governess_profiles?.name || "Gouvernante",
      }));
      setGovernesses(list);
    })();
  }, [open, hotelId]);

  // Only show rooms that have been cleaned (status clean) or assigned
  const eligibleRooms = useMemo(() => {
    return rooms.filter(r => r.status === 'clean' || r.assignedTo);
  }, [rooms]);

  const roomsByFloor = useMemo(() => {
    const grouped: Record<number, Room[]> = {};
    eligibleRooms.forEach(room => {
      const floor = room.floor ?? (parseInt(room.number[0]) || 0);
      if (!grouped[floor]) grouped[floor] = [];
      grouped[floor].push(room);
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([floor, rooms]) => ({
        floor: parseInt(floor),
        rooms: rooms.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
      }));
  }, [eligibleRooms]);

  const toggleRoom = (roomNumber: string) => {
    setSelectedRooms(prev => {
      const next = new Set(prev);
      if (next.has(roomNumber)) next.delete(roomNumber);
      else next.add(roomNumber);
      return next;
    });
  };

  const toggleFloor = (floorRooms: Room[]) => {
    const allSelected = floorRooms.every(r => selectedRooms.has(r.number));
    setSelectedRooms(prev => {
      const next = new Set(prev);
      floorRooms.forEach(r => {
        if (allSelected) next.delete(r.number);
        else next.add(r.number);
      });
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedRooms.size === 0) return;
    if (!selectedGoverness) {
      toast.error("Choisissez une gouvernante à qui attribuer les chambres");
      return;
    }
    setIsSubmitting(true);

    try {
      const roomNumbers = Array.from(selectedRooms);
      const now = new Date().toISOString();

      // Get room IDs from the database
      const { data: dbRooms, error: fetchError } = await supabase
        .from("rooms")
        .select("id, room_number")
        .eq("hotel_id", hotelId)
        .in("room_number", roomNumbers);

      if (fetchError) throw fetchError;

      if (dbRooms && dbRooms.length > 0) {
        const ids = dbRooms.map(r => r.id);
        const { error } = await supabase
          .from("rooms")
          .update({
            needs_inspection: true,
            inspection_requested_at: now,
            inspection_requested_by: "manager",
          })
          .eq("hotel_id", hotelId)
          .in("id", ids);

        if (error) throw error;
      }

      // Attribuer les chambres précises à la gouvernante (daily_governess_assignments)
      const gov = governesses.find((g) => g.id === selectedGoverness);
      if (gov) {
        const { data: userData } = await supabase.auth.getUser();
        const { data: existing } = await supabase
          .from("daily_governess_assignments")
          .select("id, assigned_rooms, assigned_floors, assigned_housekeepers, assignment_type")
          .eq("hotel_id", hotelId)
          .eq("assignment_date", todayDate())
          .eq("governess_profile_id", gov.id)
          .maybeSingle();

        if (existing) {
          const mergedRooms = [...new Set([...(existing.assigned_rooms || []), ...roomNumbers])];
          await supabase
            .from("daily_governess_assignments")
            .update({ assigned_rooms: mergedRooms, assignment_type: "rooms" })
            .eq("id", existing.id);
        } else {
          await supabase.from("daily_governess_assignments").insert({
            hotel_id: hotelId,
            assignment_date: todayDate(),
            governess_profile_id: gov.id,
            governess_name: gov.name,
            assignment_type: "rooms",
            assigned_floors: [],
            assigned_housekeepers: [],
            assigned_rooms: roomNumbers,
            created_by: userData.user?.id ?? null,
          });
        }
      }

      toast.success(`${selectedRooms.size} chambre(s) attribuée(s) à ${gov?.name ?? "la gouvernante"} pour inspection`);
      setSelectedRooms(new Set());
      setSelectedGoverness("");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la demande d'inspection");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Demander une inspection
          </DialogTitle>
          <DialogDescription>
            Choisissez une gouvernante et sélectionnez les chambres à lui attribuer pour inspection
          </DialogDescription>
        </DialogHeader>

        {/* Choix de la gouvernante */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            Gouvernante
          </Label>
          <Select value={selectedGoverness} onValueChange={setSelectedGoverness}>
            <SelectTrigger>
              <SelectValue placeholder={
                governesses.length === 0 ? "Aucune gouvernante approuvée" : "Sélectionner une gouvernante"
              } />
            </SelectTrigger>
            <SelectContent>
              {governesses.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="max-h-[360px] pr-2">
          <div className="space-y-4">
            {roomsByFloor.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune chambre éligible à l'inspection
              </p>
            ) : (
              roomsByFloor.map(({ floor, rooms: floorRooms }) => {
                const allSelected = floorRooms.every(r => selectedRooms.has(r.number));
                const someSelected = floorRooms.some(r => selectedRooms.has(r.number));

                return (
                  <div key={floor}>
                    <div
                      className="flex items-center gap-2 mb-2 cursor-pointer hover:bg-accent/50 rounded px-2 py-1"
                      onClick={() => toggleFloor(floorRooms)}
                    >
                      <Checkbox
                        checked={allSelected}
                        className={someSelected && !allSelected ? "opacity-50" : ""}
                      />
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">
                        Étage {floor === 0 ? 'RDC' : floor}
                      </span>
                      <Badge variant="outline" className="ml-auto text-xs">
                        {floorRooms.length}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 ml-6">
                      {floorRooms.map(room => (
                        <div
                          key={room.number}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded border cursor-pointer transition-colors text-sm
                            ${selectedRooms.has(room.number)
                              ? 'bg-primary/10 border-primary/40'
                              : 'hover:bg-accent/50 border-transparent'}`}
                          onClick={() => toggleRoom(room.number)}
                        >
                          <Checkbox checked={selectedRooms.has(room.number)} />
                          <span className="font-mono">{room.number}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {selectedRooms.size} chambre(s) sélectionnée(s)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={selectedRooms.size === 0 || !selectedGoverness || isSubmitting}
            >
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Attribuer l'inspection
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
