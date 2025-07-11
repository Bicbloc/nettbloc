import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const useAdminRole = () => {
  const { user, isAuthenticated } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      if (!isAuthenticated || !user) {
        setIsSuperAdmin(false);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) {
          console.error('Erreur vérification rôles:', error);
          setIsSuperAdmin(false);
          setIsAdmin(false);
        } else {
          const roles = data?.map(r => r.role) || [];
          setIsSuperAdmin(roles.includes('super_admin'));
          setIsAdmin(roles.includes('admin') || roles.includes('super_admin'));
        }
      } catch (error) {
        console.error('Erreur:', error);
        setIsSuperAdmin(false);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkRole();
  }, [user, isAuthenticated]);

  return { isSuperAdmin, isAdmin, loading };
};