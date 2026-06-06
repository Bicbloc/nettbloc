/**
 * Composant Demandes d'accès
 * Interface de navigation vers les pages dédiées pour chaque type d'utilisateur
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Crown, Wrench, ChevronRight, Bell, Loader2, Coffee } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface AccessCodesTabProps {
  currentHotelId: string | null;
}

export function AccessCodesTab({ currentHotelId }: AccessCodesTabProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [counts, setCounts] = useState({
    housekeepers: { total: 0, pending: 0 },
    governesses: { total: 0, pending: 0 },
    technicians: { total: 0, pending: 0 },
    cafetieres: { total: 0, pending: 0 }
  });
  const [loading, setLoading] = useState(true);

  const loadCounts = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data: userHotels } = await supabase
        .from('hotels')
        .select('id')
        .eq('user_id', user.id);

      const hotelIds = userHotels?.map(h => h.id) || [];
      if (hotelIds.length === 0) {
        setLoading(false);
        return;
      }

      const [housekeeperRes, governessRes, technicianRes, cafetiereRes] = await Promise.all([
        supabase
          .from('housekeeper_access_requests')
          .select('id, status')
          .in('hotel_id', hotelIds),
        supabase
          .from('governess_access_requests')
          .select('id, status')
          .in('hotel_id', hotelIds),
        supabase
          .from('technician_access_requests')
          .select('id, status')
          .in('hotel_id', hotelIds),
        supabase
          .from('cafetiere_access_requests')
          .select('id, status')
          .in('hotel_id', hotelIds)
      ]);

      setCounts({
        housekeepers: {
          total: housekeeperRes.data?.length || 0,
          pending: housekeeperRes.data?.filter(r => r.status === 'pending').length || 0
        },
        governesses: {
          total: governessRes.data?.length || 0,
          pending: governessRes.data?.filter(r => r.status === 'pending').length || 0
        },
        technicians: {
          total: technicianRes.data?.length || 0,
          pending: technicianRes.data?.filter(r => r.status === 'pending').length || 0
        },
        cafetieres: {
          total: cafetiereRes.data?.length || 0,
          pending: cafetiereRes.data?.filter(r => r.status === 'pending').length || 0
        }
      });
    } catch (error) {
      console.error('Error loading counts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCounts();
  }, [user, currentHotelId]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('access_requests_counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'housekeeper_access_requests' }, loadCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'governess_access_requests' }, loadCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'technician_access_requests' }, loadCounts)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalPending = counts.housekeepers.pending + counts.governesses.pending + counts.technicians.pending;

  return (
    <div className="space-y-6">
      {totalPending > 0 && (
        <div className="flex items-center gap-2 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <Bell className="h-5 w-5 text-amber-600" />
          <span className="text-amber-700 font-medium">
            {totalPending} demande{totalPending > 1 ? 's' : ''} en attente de validation
          </span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {/* Femmes de chambre */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50 group"
          onClick={() => navigate('/access/housekeepers')}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <UserPlus className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Femmes de chambre</CardTitle>
                  <CardDescription>Gérer les demandes d'accès</CardDescription>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-sm">
                {counts.housekeepers.total} demande{counts.housekeepers.total !== 1 ? 's' : ''}
              </Badge>
              {counts.housekeepers.pending > 0 && (
                <Badge className="bg-amber-500 hover:bg-amber-600">
                  {counts.housekeepers.pending} en attente
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Gouvernantes */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all hover:border-amber-500/50 group"
          onClick={() => navigate('/access/governesses')}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Crown className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">Gouvernantes</CardTitle>
                  <CardDescription>Gérer les demandes d'accès</CardDescription>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-amber-500 transition-colors" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-sm">
                {counts.governesses.total} demande{counts.governesses.total !== 1 ? 's' : ''}
              </Badge>
              {counts.governesses.pending > 0 && (
                <Badge className="bg-amber-500 hover:bg-amber-600">
                  {counts.governesses.pending} en attente
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Techniciens */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all hover:border-blue-500/50 group"
          onClick={() => navigate('/access/technicians')}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Wrench className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">Techniciens</CardTitle>
                  <CardDescription>Gérer les demandes d'accès</CardDescription>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-500 transition-colors" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-sm">
                {counts.technicians.total} demande{counts.technicians.total !== 1 ? 's' : ''}
              </Badge>
              {counts.technicians.pending > 0 && (
                <Badge className="bg-amber-500 hover:bg-amber-600">
                  {counts.technicians.pending} en attente
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
