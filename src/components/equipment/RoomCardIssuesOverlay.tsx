import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RoomIssuesOverlay } from './RoomIssuesOverlay';
import type { EquipmentIssue } from '@/hooks/use-equipment';

interface Props {
  hotelId?: string;
  roomNumber: string;
  compact?: boolean;
}

/**
 * Lightweight overlay that fetches open equipment issues for a room by number
 * and displays a persistent badge. Subscribes to realtime updates.
 */
export function RoomCardIssuesOverlay({ hotelId, roomNumber, compact }: Props) {
  const [issues, setIssues] = useState<EquipmentIssue[]>([]);

  useEffect(() => {
    if (!hotelId || !roomNumber) return;
    let cancelled = false;

    const load = async () => {
      // Resolve room registry id by number
      const { data: reg } = await supabase
        .from('hotel_rooms_registry')
        .select('id')
        .eq('hotel_id', hotelId)
        .eq('room_number', roomNumber)
        .maybeSingle();
      if (cancelled || !reg?.id) return;

      const { data } = await supabase
        .from('equipment_issues')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('room_registry_id', reg.id)
        .neq('status', 'resolved');
      if (!cancelled) setIssues((data as any) || []);
    };

    load();

    const channel = supabase
      .channel(`room-issues-${hotelId}-${roomNumber}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'equipment_issues', filter: `hotel_id=eq.${hotelId}` },
        () => load()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [hotelId, roomNumber]);

  const resolve = async (id: string) => {
    await supabase
      .from('equipment_issues')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', id);
  };

  if (issues.length === 0) return null;
  return <RoomIssuesOverlay issues={issues} roomNumber={roomNumber} onResolve={resolve} compact={compact} />;
}
