import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type Permission = 
  | 'rooms:read' 
  | 'rooms:write' 
  | 'rooms:delete'
  | 'housekeepers:read'
  | 'housekeepers:write' 
  | 'housekeepers:delete'
  | 'reports:read'
  | 'reports:write'
  | 'settings:read'
  | 'settings:write'
  | 'admin:access'
  | 'admin:users'
  | 'admin:system';

export type Role = 'admin' | 'manager' | 'housekeeper' | 'viewer';

const rolePermissions: Record<Role, Permission[]> = {
  admin: [
    'rooms:read', 'rooms:write', 'rooms:delete',
    'housekeepers:read', 'housekeepers:write', 'housekeepers:delete',
    'reports:read', 'reports:write',
    'settings:read', 'settings:write',
    'admin:access', 'admin:users', 'admin:system'
  ],
  manager: [
    'rooms:read', 'rooms:write',
    'housekeepers:read', 'housekeepers:write',
    'reports:read', 'reports:write',
    'settings:read'
  ],
  housekeeper: [
    'rooms:read', 'rooms:write'
  ],
  viewer: [
    'rooms:read', 'reports:read'
  ]
};

export function usePermission() {
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();

  // Load user role and permissions
  const loadPermissions = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setUserRole(null);
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      // Check if user is super admin
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error loading user roles:', error);
        setLoading(false);
        return;
      }

      // Determine user role priority: super_admin > admin > manager > housekeeper > viewer
      let effectiveRole: Role = 'viewer';
      
      if (roles?.some(r => r.role === 'super_admin')) {
        effectiveRole = 'admin'; // Super admin gets admin permissions
      } else if (roles?.some(r => r.role === 'admin')) {
        effectiveRole = 'admin';
      } else {
        // Check hotel-specific roles or default to viewer
        const hotelId = localStorage.getItem('selectedHotelId');
        if (hotelId) {
          const { data: hotelUsers } = await supabase
            .from('hotel_users')
            .select('role')
            .eq('hotel_id', hotelId)
            .eq('user_id', user.id)
            .single();

          if (hotelUsers?.role) {
            effectiveRole = hotelUsers.role as Role;
          }
        }
      }

      setUserRole(effectiveRole);
      setPermissions(rolePermissions[effectiveRole] || []);
    } catch (error) {
      console.error('Failed to load permissions:', error);
    } finally {
      setLoading(false);
    }
  }, [user, isAuthenticated]);

  // Check if user has specific permission
  const hasPermission = useCallback((permission: Permission): boolean => {
    return permissions.includes(permission);
  }, [permissions]);

  // Check if user has any of the specified permissions
  const hasAnyPermission = useCallback((requiredPermissions: Permission[]): boolean => {
    return requiredPermissions.some(permission => permissions.includes(permission));
  }, [permissions]);

  // Check if user has all specified permissions
  const hasAllPermissions = useCallback((requiredPermissions: Permission[]): boolean => {
    return requiredPermissions.every(permission => permissions.includes(permission));
  }, [permissions]);

  // Check role-based access
  const hasRole = useCallback((role: Role): boolean => {
    if (!userRole) return false;
    
    // Role hierarchy: admin > manager > housekeeper > viewer
    const roleHierarchy: Role[] = ['admin', 'manager', 'housekeeper', 'viewer'];
    const userRoleIndex = roleHierarchy.indexOf(userRole);
    const requiredRoleIndex = roleHierarchy.indexOf(role);
    
    return userRoleIndex <= requiredRoleIndex;
  }, [userRole]);

  // Check if user can access specific resource
  const canAccess = useCallback((resource: string, action: 'read' | 'write' | 'delete' = 'read'): boolean => {
    const permission: Permission = `${resource}:${action}` as Permission;
    return hasPermission(permission);
  }, [hasPermission]);

  // Load permissions on auth state change
  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  return {
    userRole,
    permissions,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    canAccess,
    loadPermissions,
    isAdmin: hasRole('admin'),
    isManager: hasRole('manager'),
    isHousekeeper: userRole === 'housekeeper',
    isViewer: userRole === 'viewer',
  };
}
