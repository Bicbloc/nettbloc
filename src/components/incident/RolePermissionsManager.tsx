import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useRolePermissions } from "@/hooks/use-role-permissions";
import { Loader2 } from "lucide-react";

interface RolePermissionsManagerProps {
  hotelId: string;
}

export function RolePermissionsManager({ hotelId }: RolePermissionsManagerProps) {
  const { permissions, updatePermission, isUpdating } = useRolePermissions(hotelId);

  const { data: roles } = useQuery({
    queryKey: ["staff-roles", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_roles")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const { data: incidentTypes } = useQuery({
    queryKey: ["incident-types", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incident_types")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const getPermission = (roleId: string, typeId: string) => {
    return permissions?.find(
      (p) => p.role_id === roleId && p.incident_type_id === typeId
    );
  };

  const handlePermissionChange = (
    roleId: string,
    typeId: string,
    field: "can_view" | "can_resolve",
    checked: boolean
  ) => {
    const existing = getPermission(roleId, typeId);
    updatePermission({
      roleId,
      typeId,
      canView: field === "can_view" ? checked : (existing?.can_view ?? true),
      canResolve: field === "can_resolve" ? checked : (existing?.can_resolve ?? false),
    });
  };

  if (!roles || !incidentTypes) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Permissions par rôle</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {roles.map((role) => (
            <div key={role.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{role.name}</Badge>
                {role.description && (
                  <span className="text-sm text-muted-foreground">{role.description}</span>
                )}
              </div>

              <div className="grid gap-3 pl-4 border-l-2 border-border">
                {incidentTypes.map((type) => {
                  const permission = getPermission(role.id, type.id);
                  return (
                    <div key={type.id} className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: type.color || "#6b7280" }}
                          />
                          <span className="text-sm font-medium">{type.name}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`view-${role.id}-${type.id}`}
                            checked={permission?.can_view ?? true}
                            disabled={isUpdating}
                            onCheckedChange={(checked) =>
                              handlePermissionChange(role.id, type.id, "can_view", checked as boolean)
                            }
                          />
                          <Label
                            htmlFor={`view-${role.id}-${type.id}`}
                            className="text-sm cursor-pointer"
                          >
                            Voir
                          </Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`resolve-${role.id}-${type.id}`}
                            checked={permission?.can_resolve ?? false}
                            disabled={isUpdating}
                            onCheckedChange={(checked) =>
                              handlePermissionChange(role.id, type.id, "can_resolve", checked as boolean)
                            }
                          />
                          <Label
                            htmlFor={`resolve-${role.id}-${type.id}`}
                            className="text-sm cursor-pointer"
                          >
                            Résoudre
                          </Label>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
