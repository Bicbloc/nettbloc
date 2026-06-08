/**
 * Carte admin (page Petit-déjeuner) : partage des chambres avec une cafetière.
 * L'admin choisit une cafetière existante et lui donne accès à l'hôtel.
 * Une fois partagée, la cafetière voit automatiquement toutes les chambres du
 * registre ainsi que les chambres en séjour en cours (remontées du PMS).
 */
import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Coffee, Share2, Trash2, Check, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface CafetiereProfile {
  id: string;
  name: string | null;
  first_name: string | null;
  email: string;
  phone: string | null;
}

interface SharedAccess {
  id: string;
  cafetiere_profile_id: string;
  status: string;
  cafetiere_profiles: { name: string | null; first_name: string | null; email: string; phone: string | null } | null;
}

export function CafetiereShareCard({ hotelId }: { hotelId: string }) {
  const [profiles, setProfiles] = useState<CafetiereProfile[]>([]);
  const [shared, setShared] = useState<SharedAccess[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [hotelCode, setHotelCode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: profs }, { data: reqs }, { data: hotel }] = await Promise.all([
      supabase.from('cafetiere_profiles')
        .select('id, name, first_name, email, phone')
        .eq('is_active', true)
        .order('name'),
      supabase.from('cafetiere_access_requests')
        .select('id, cafetiere_profile_id, status, cafetiere_profiles(name, first_name, email, phone)')
        .eq('hotel_id', hotelId)
        .eq('status', 'approved'),
      supabase.from('hotels').select('hotel_code').eq('id', hotelId).maybeSingle(),
    ]);
    setProfiles((profs as CafetiereProfile[]) || []);
    setShared((reqs as unknown as SharedAccess[]) || []);
    setHotelCode(hotel?.hotel_code || '');
    setLoading(false);
  }, [hotelId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`cafetiere-share-${hotelId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'cafetiere_access_requests', filter: `hotel_id=eq.${hotelId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [hotelId, load]);

  const sharedIds = new Set(shared.map((s) => s.cafetiere_profile_id));
  const selectableProfiles = profiles.filter((p) => !sharedIds.has(p.id));

  const handleShare = async () => {
    if (!selected) {
      toast.error('Choisissez un membre du personnel à qui partager les chambres.');
      return;
    }
    setSharing(true);
    const { data: userData } = await supabase.auth.getUser();
    const reviewedBy = userData.user?.id ?? null;
    const now = new Date().toISOString();

    // Pas de contrainte unique sur (cafetiere, hotel) : on met à jour s'il existe
    // déjà une demande, sinon on en crée une approuvée.
    const { data: existing } = await supabase
      .from('cafetiere_access_requests')
      .select('id')
      .eq('cafetiere_profile_id', selected)
      .eq('hotel_id', hotelId)
      .maybeSingle();

    const { error } = existing
      ? await supabase
          .from('cafetiere_access_requests')
          .update({ status: 'approved', reviewed_at: now, reviewed_by: reviewedBy })
          .eq('id', existing.id)
      : await supabase
          .from('cafetiere_access_requests')
          .insert({
            cafetiere_profile_id: selected,
            hotel_id: hotelId,
            hotel_code: hotelCode || '—',
            status: 'approved',
            requested_at: now,
            reviewed_at: now,
            reviewed_by: reviewedBy,
          });
    setSharing(false);
    if (error) {
      console.error('[cafetiere] share error:', error);
      toast.error("Échec du partage des chambres");
      return;
    }
    const name = profiles.find((p) => p.id === selected)?.name || 'Personnel';
    toast.success(`Chambres partagées avec ${name}`);
    setSelected('');
    load();
  };

  const handleRevoke = async (id: string, name: string | null) => {
    const { error } = await supabase
      .from('cafetiere_access_requests')
      .update({ status: 'suspended', reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast.error('Échec de la révocation');
      return;
    }
    toast.success(`Accès retiré à ${name || 'le personnel'}`);
    load();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Coffee className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Personnel point de vente du jour</CardTitle>
        </div>
        <CardDescription>
          Choisissez un membre du personnel point de vente pour lui partager toutes les
          chambres du registre et les chambres en séjour en cours.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={
                loading ? 'Chargement…'
                  : selectableProfiles.length === 0 ? 'Aucun personnel disponible'
                  : 'Sélectionner un membre du personnel'
              } />
            </SelectTrigger>
            <SelectContent>
              {selectableProfiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name || p.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleShare} disabled={sharing || !selected} className="gap-2">
            <Share2 className="h-4 w-4" />
            {sharing ? 'Partage…' : 'Partager les chambres'}
          </Button>
        </div>

        {shared.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Personnel ayant accès</p>
            {shared.map((s) => {
              const p = s.cafetiere_profiles;
              const fullName = [p?.first_name, p?.name].filter(Boolean).join(' ') || p?.email || 'Personnel';
              return (
                <div key={s.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                          <Check className="h-3 w-3" /> Partagé
                        </Badge>
                        <span className="font-medium truncate">{fullName}</span>
                      </div>
                      {p?.phone && (
                        <a href={`tel:${p.phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
                          <Phone className="h-3 w-3" /> {p.phone}
                        </a>
                      )}
                      {p?.email && (
                        <a href={`mailto:${p.email}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary break-all">
                          <Mail className="h-3 w-3" /> {p.email}
                        </a>
                      )}
                    </div>
                    <Button
                      variant="ghost" size="icon" className="shrink-0"
                      onClick={() => handleRevoke(s.id, p?.name ?? null)}
                      title="Retirer l'accès"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}

          </div>
        )}
      </CardContent>
    </Card>
  );
}
