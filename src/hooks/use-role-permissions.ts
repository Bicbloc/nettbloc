import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useRolePermissions(hotelId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: permissions, isLoading } = useQuery({
    queryKey: ["role-permissions", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_role_permissions")
        .select(`
          *,
          staff_roles(id, name),
          incident_types(id, name, color)
        `)
        .eq("hotel_id", hotelId);

      if (error) throw error;
      return data;
    },
    enabled: !!hotelId,
  });

  const updatePermissionMutation = useMutation({
    mutationFn: async ({
      roleId,
      typeId,
      canView,
      canResolve,
    }: {
      roleId: string;
      typeId: string;
      canView: boolean;
      canResolve: boolean;
    }) => {
      const { data: existing } = await supabase
        .from("staff_role_permissions")
        .select("id")
        .eq("role_id", roleId)
        .eq("incident_type_id", typeId)
        .single();

      if (existing) {
        const { error } = await supabase
          .from("staff_role_permissions")
          .update({ can_view: canView, can_resolve: canResolve })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("staff_role_permissions")
          .insert({
            role_id: roleId,
            incident_type_id: typeId,
            can_view: canView,
            can_resolve: canResolve,
            hotel_id: hotelId,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions", hotelId] });
      toast({
        title: "Permissions mises à jour",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const canViewIncidentType = (roleId: string, typeId: string): boolean => {
    if (!permissions) return true; // Par défaut, permettre si pas de permissions définies
    
    const permission = permissions.find(
      (p) => p.role_id === roleId && p.incident_type_id === typeId
    );

    return permission ? permission.can_view : true;
  };

  const canResolveIncidentType = (roleId: string, typeId: string): boolean => {
    if (!permissions) return false;
    
    const permission = permissions.find(
      (p) => p.role_id === roleId && p.incident_type_id === typeId
    );

    return permission ? permission.can_resolve : false;
  };

  return {
    permissions,
    isLoading,
    updatePermission: updatePermissionMutation.mutate,
    isUpdating: updatePermissionMutation.isPending,
    canViewIncidentType,
    canResolveIncidentType,
  };
}
