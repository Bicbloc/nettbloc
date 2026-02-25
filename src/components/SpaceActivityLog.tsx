import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Brush, AlertTriangle, CheckCircle, ClipboardList, Clock, User } from 'lucide-react';

interface SpaceActivityLogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotelId: string;
  roomNumber: string;
  spaceName?: string;
}

interface ActivityEntry {
  id: string;
  timestamp: string;
  type: string;
  description: string;
  actor: string | null;
  source: 'action_log' | 'activity';
}

const typeIcons: Record<string, React.ReactNode> = {
  'cleaning-start': <Brush className="h-4 w-4 text-blue-500" />,
  'cleaning-end': <Brush className="h-4 w-4 text-green-500" />,
  'incident': <AlertTriangle className="h-4 w-4 text-orange-500" />,
  'inspection': <CheckCircle className="h-4 w-4 text-emerald-500" />,
  'inventory': <ClipboardList className="h-4 w-4 text-violet-500" />,
};

const getIcon = (type: string) => {
  if (type.includes('clean')) return type.includes('end') ? typeIcons['cleaning-end'] : typeIcons['cleaning-start'];
  if (type.includes('incident')) return typeIcons['incident'];
  if (type.includes('inspect')) return typeIcons['inspection'];
  if (type.includes('inventor')) return typeIcons['inventory'];
  return <Clock className="h-4 w-4 text-muted-foreground" />;
};

export function SpaceActivityLog({ open, onOpenChange, hotelId, roomNumber, spaceName }: SpaceActivityLogProps) {
  const { data: entries, isLoading } = useQuery({
    queryKey: ['space-activity', hotelId, roomNumber],
    queryFn: async () => {
      const [logsRes, activitiesRes] = await Promise.all([
        supabase
          .from('daily_action_logs')
          .select('*')
          .eq('hotel_id', hotelId)
          .eq('room_number', roomNumber)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('activities')
          .select('*')
          .eq('hotel_id', hotelId)
          .eq('entity_type', 'room')
          .order('timestamp', { ascending: false })
          .limit(200),
      ]);

      const fromLogs: ActivityEntry[] = (logsRes.data || []).map((l: any) => ({
        id: l.id,
        timestamp: l.created_at,
        type: l.action_type,
        description: l.description,
        actor: l.actor_name,
        source: 'action_log' as const,
      }));

      const fromActivities: ActivityEntry[] = (activitiesRes.data || [])
        .filter((a: any) => {
          const details = a.details as any;
          return details?.room_number === roomNumber || details?.room === roomNumber;
        })
        .map((a: any) => ({
          id: a.id,
          timestamp: a.timestamp,
          type: a.activity_type,
          description: (a.details as any)?.description || a.activity_type,
          actor: a.actor_name,
          source: 'activity' as const,
        }));

      const all = [...fromLogs, ...fromActivities];
      all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Deduplicate by similar timestamp + type
      const seen = new Set<string>();
      return all.filter(e => {
        const key = `${e.type}-${e.timestamp.substring(0, 16)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
    enabled: open && !!hotelId && !!roomNumber,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Journal d'activité — {spaceName || roomNumber}</SheetTitle>
          <SheetDescription>
            Historique des actions pour cet espace
          </SheetDescription>
          {entries && (
            <Badge variant="secondary" className="w-fit">
              {entries.length} entrée{entries.length > 1 ? 's' : ''}
            </Badge>
          )}
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)] mt-4 pr-2">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Chargement...</p>
          ) : !entries?.length ? (
            <p className="text-center text-muted-foreground py-8">
              Aucune activité enregistrée pour cet espace
            </p>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div key={entry.id} className="flex gap-3 p-3 rounded-lg border bg-card">
                  <div className="mt-0.5">{getIcon(entry.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{entry.description}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(entry.timestamp), 'dd MMM yyyy HH:mm', { locale: fr })}
                      {entry.actor && (
                        <>
                          <User className="h-3 w-3 ml-1" />
                          {entry.actor}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
