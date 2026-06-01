import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, MapPin, Clock, CheckCircle2, Wrench } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { realtimeManager } from '@/services/RealtimeManager';

interface HousekeeperIncidentsListProps {
  hotelId: string;
  housekeeperName: string;
}

const PRIORITY_STYLE: Record<string, string> = {
  urgent: 'border-l-red-500 bg-red-500/5',
  critical: 'border-l-red-500 bg-red-500/5',
  high: 'border-l-orange-500 bg-orange-500/5',
  medium: 'border-l-amber-500 bg-amber-500/5',
  low: 'border-l-blue-500 bg-blue-500/5',
};

const STATUS_LABEL: Record<string, string> = {
  new: 'Nouveau',
  in_progress: 'En cours',
  pending_validation: 'En attente de validation',
};

const normalize = (s?: string) =>
  (s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function HousekeeperIncidentsList({ hotelId, housekeeperName }: HousekeeperIncidentsListProps) {
  const { toast } = useToast();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffId, setStaffId] = useState<string | null>(null);

  const loadIncidents = useCallback(async () => {
    if (!hotelId) return;

    // Résoudre l'identifiant de la femme de chambre (table housekeepers)
    let resolvedId = staffId;
    if (!resolvedId) {
      const { data: staff } = await supabase
        .from('housekeepers')
        .select('id, name')
        .eq('hotel_id', hotelId);
      const match = (staff || []).find(
        (s) => normalize(s.name) === normalize(housekeeperName)
      );
      resolvedId = match?.id || null;
      setStaffId(resolvedId);
    }

    if (!resolvedId) {
      setIncidents([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('incidents')
      .select('*, incident_items(name), incident_categories(name)')
      .eq('hotel_id', hotelId)
      .eq('assigned_to_user_id', resolvedId)
      .in('status', ['new', 'in_progress', 'pending_validation'])
      .order('created_at', { ascending: false });

    if (!error) setIncidents(data || []);
    setLoading(false);
  }, [hotelId, housekeeperName, staffId]);

  useEffect(() => {
    loadIncidents();
    const subId = realtimeManager.subscribe('incidents', () => loadIncidents());
    return () => realtimeManager.unsubscribe(subId);
  }, [loadIncidents]);

  const updateStatus = async (incidentId: string, status: string) => {
    const { error } = await supabase
      .from('incidents')
      .update({ status })
      .eq('id', incidentId);
    if (error) {
      toast({ title: 'Erreur', description: "Impossible de mettre à jour l'incident", variant: 'destructive' });
      return;
    }
    toast({ title: status === 'in_progress' ? 'Incident démarré' : 'Incident marqué comme terminé' });
    loadIncidents();
  };

  if (loading) {
    return (
      <Card className="p-6 text-center text-muted-foreground text-sm">Chargement des incidents…</Card>
    );
  }

  if (incidents.length === 0) {
    return (
      <Card className="p-6 text-center">
        <CheckCircle2 className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Aucun incident qui vous est attribué</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {incidents.map((incident) => (
        <Card
          key={incident.id}
          className={cn('p-4 border-l-4', PRIORITY_STYLE[incident.priority] || 'border-l-muted')}
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-destructive/10 text-destructive shrink-0">
              <Wrench className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold leading-tight">{incident.title}</h4>
                <Badge variant="secondary" className="text-[10px]">
                  {STATUS_LABEL[incident.status] || incident.status}
                </Badge>
              </div>
              {incident.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{incident.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                {incident.location_reference && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {incident.location_reference}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(incident.created_at), 'dd MMM HH:mm', { locale: fr })}
                </span>
              </div>

              <div className="flex gap-2 mt-3">
                {incident.status === 'new' && (
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => updateStatus(incident.id, 'in_progress')}>
                    <AlertCircle className="h-3.5 w-3.5" /> Démarrer
                  </Button>
                )}
                {(incident.status === 'new' || incident.status === 'in_progress') && (
                  <Button size="sm" className="gap-1" onClick={() => updateStatus(incident.id, 'pending_validation')}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Terminé
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
