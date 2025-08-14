import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RealtimeAdminData {
  users: any[];
  hotels: any[];
  sessions: any[];
  stats: {
    total_users: number;
    active_users: number;
    total_hotels: number;
    total_sessions: number;
  };
  loading: boolean;
  lastUpdate: string;
}

export const useRealtimeAdmin = (isSuperAdmin: boolean) => {
  const { toast } = useToast();
  const [data, setData] = useState<RealtimeAdminData>({
    users: [],
    hotels: [],
    sessions: [],
    stats: { total_users: 0, active_users: 0, total_hotels: 0, total_sessions: 0 },
    loading: true,
    lastUpdate: ''
  });

  const loadData = async () => {
    if (!isSuperAdmin) return;

    try {
      console.log('🔄 Chargement données admin temps réel...');
      
      // Charger les profils utilisateurs
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Charger les hôtels
      const { data: hotels, error: hotelsError } = await supabase
        .from('hotels')
        .select('*')
        .order('created_at', { ascending: false });

      if (hotelsError) throw hotelsError;

      // Charger les sessions actives
      const { data: sessions, error: sessionsError } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('is_active', true)
        .order('last_activity', { ascending: false });

      if (sessionsError) throw sessionsError;

      // Calculer les statistiques
      const stats = {
        total_users: profiles?.length || 0,
        active_users: profiles?.filter(p => !p.is_suspended)?.length || 0,
        total_hotels: hotels?.length || 0,
        total_sessions: sessions?.length || 0
      };

      setData({
        users: profiles || [],
        hotels: hotels || [],
        sessions: sessions || [],
        stats,
        loading: false,
        lastUpdate: new Date().toLocaleTimeString()
      });

      console.log('✅ Données admin chargées:', stats);

    } catch (error) {
      console.error('❌ Erreur chargement données admin:', error);
      toast({
        variant: "destructive",
        title: "Erreur données temps réel",
        description: "Impossible de charger les données d'administration"
      });
      setData(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    if (!isSuperAdmin) return;

    // Chargement initial
    loadData();

    // Subscription temps réel pour les profils
    const profilesChannel = supabase
      .channel('admin-profiles-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          console.log('🔄 Changement profils détecté:', payload);
          loadData();
        }
      )
      .subscribe();

    // Subscription temps réel pour les hôtels
    const hotelsChannel = supabase
      .channel('admin-hotels-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'hotels' },
        (payload) => {
          console.log('🔄 Changement hôtels détecté:', payload);
          loadData();
        }
      )
      .subscribe();

    // Subscription temps réel pour les sessions
    const sessionsChannel = supabase
      .channel('admin-sessions-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'user_sessions' },
        (payload) => {
          console.log('🔄 Changement sessions détecté:', payload);
          loadData();
        }
      )
      .subscribe();

    // Nettoyage
    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(hotelsChannel);
      supabase.removeChannel(sessionsChannel);
    };
  }, [isSuperAdmin]);

  return {
    ...data,
    refresh: loadData
  };
};