import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Check, X, DoorClosed, Loader2 } from 'lucide-react';

interface PendingRoom {
  id: string;
  room_number: string;
  floor: number | null;
  room_type: string | null;
  pms_type: string | null;
}

interface PendingRoomsSectionProps {
  hotelId?: string;
  refreshKey?: number;
}

export function PendingRoomsSection({ hotelId, refreshKey }: PendingRoomsSectionProps) {
  const [rooms, setRooms] = useState<PendingRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    const { data } = await supabase
      .from('pms_pending_rooms')
      .select('id, room_number, floor, room_type, pms_type')
      .eq('hotel_id', hotelId)
      .eq('status', 'pending')
      .order('room_number', { ascending: true });
    setRooms((data as PendingRoom[]) || []);
    setLoading(false);
  }, [hotelId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const addToRegistry = async (room: PendingRoom) => {
    if (!hotelId) return;
    setBusyId(room.id);
    try {
      const { error: insertError } = await supabase
        .from('hotel_rooms_registry')
        .upsert({
          hotel_id: hotelId,
          room_number: room.room_number,
          floor: room.floor,
          room_type: room.room_type,
          source: 'pms',
          imported_from: room.pms_type,
          is_active: true,
          space_category: 'room',
        } as any, { onConflict: 'hotel_id,room_number', ignoreDuplicates: true });
      if (insertError) throw insertError;

      await supabase
        .from('pms_pending_rooms')
        .update({ status: 'added', resolved_at: new Date().toISOString() })
        .eq('id', room.id);

      toast({ title: 'Chambre ajoutée', description: `${room.room_number} ajoutée au registre.` });
      setRooms(prev => prev.filter(r => r.id !== room.id));
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message || "Impossible d'ajouter la chambre.", variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const ignore = async (room: PendingRoom) => {
    setBusyId(room.id);
    try {
      await supabase
        .from('pms_pending_rooms')
        .update({ status: 'ignored', resolved_at: new Date().toISOString() })
        .eq('id', room.id);
      setRooms(prev => prev.filter(r => r.id !== room.id));
    } finally {
      setBusyId(null);
    }
  };

  const addAll = async () => {
    if (!hotelId || rooms.length === 0) return;
    setBulkBusy(true);
    try {
      const { error: insertError } = await supabase
        .from('hotel_rooms_registry')
        .upsert(
          rooms.map(room => ({
            hotel_id: hotelId,
            room_number: room.room_number,
            floor: room.floor,
            room_type: room.room_type,
            source: 'pms',
            imported_from: room.pms_type,
            is_active: true,
            space_category: 'room',
          })) as any,
          { onConflict: 'hotel_id,room_number', ignoreDuplicates: true }
        );
      if (insertError) throw insertError;

      await supabase
        .from('pms_pending_rooms')
        .update({ status: 'added', resolved_at: new Date().toISOString() })
        .in('id', rooms.map(r => r.id));

      toast({ title: 'Chambres ajoutées', description: `${rooms.length} chambres ajoutées au registre.` });
      setRooms([]);
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message || "Impossible d'ajouter les chambres.", variant: 'destructive' });
    } finally {
      setBulkBusy(false);
    }
  };

  if (!hotelId || (!loading && rooms.length === 0)) return null;

  return (
    <>
      <Separator />
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
            <DoorClosed className="h-4 w-4" />
            Nouvelles chambres détectées ({rooms.length})
          </div>
          {rooms.length > 0 && (
            <Button size="sm" disabled={bulkBusy || loading} onClick={addAll}>
              {bulkBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              Tout valider
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Ces chambres ont été synchronisées pour les opérations du jour mais ne sont pas encore dans le registre permanent. Validez leur ajout ou ignorez-les.
        </p>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {rooms.map(room => (
              <div key={room.id} className="flex items-center justify-between gap-2 rounded-md border bg-background p-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-sm">{room.room_number}</span>
                  {room.floor != null && <Badge variant="outline" className="text-xs">Étage {room.floor}</Badge>}
                  {room.room_type && <Badge variant="outline" className="text-xs truncate">{room.room_type}</Badge>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="outline" disabled={busyId === room.id} onClick={() => addToRegistry(room)}>
                    <Check className="h-4 w-4 mr-1" />
                    Ajouter
                  </Button>
                  <Button size="icon" variant="ghost" className="text-muted-foreground" disabled={busyId === room.id} onClick={() => ignore(room)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
