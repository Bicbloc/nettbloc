import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StaffManagementProps {
  hotelId: string;
}

export function StaffManagement({ hotelId }: StaffManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [selectedRole, setSelectedRole] = useState("");

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

  const { data: housekeepers } = useQuery({
    queryKey: ["housekeepers", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("housekeepers")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  const addStaffMutation = useMutation({
    mutationFn: async ({ name, roleType }: { name: string; roleType: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Non authentifié");

      // Generate access code
      const { data: accessCodeData, error: codeError } = await supabase
        .rpc("generate_permanent_access_code", {
          p_hotel_id: hotelId,
          p_housekeeper_name: name
        });

      if (codeError) throw codeError;

      // Add to housekeepers table (works for all staff types)
      const { error: housekeeperError } = await supabase
        .from("housekeepers")
        .insert({
          hotel_id: hotelId,
          name: name,
          access_code: accessCodeData,
          user_id: user.id,
          is_active: true
        });

      if (housekeeperError) throw housekeeperError;

      return accessCodeData;
    },
    onSuccess: (accessCode) => {
      queryClient.invalidateQueries({ queryKey: ["housekeepers", hotelId] });
      setIsAddDialogOpen(false);
      setNewStaffName("");
      setSelectedRole("");
      toast({
        title: "Membre du personnel ajouté",
        description: `Code d'accès: ${accessCode}`,
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

  const deleteStaffMutation = useMutation({
    mutationFn: async (staffId: string) => {
      const { error } = await supabase
        .from("housekeepers")
        .update({ is_active: false })
        .eq("id", staffId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["housekeepers", hotelId] });
      toast({ title: "Membre supprimé" });
    },
  });

  const handleAddStaff = () => {
    if (!newStaffName.trim() || !selectedRole) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs",
        variant: "destructive",
      });
      return;
    }

    addStaffMutation.mutate({
      name: newStaffName.trim(),
      roleType: selectedRole,
    });
  };

  const getRoleLabel = (roleName: string) => {
    const roleMap: Record<string, string> = {
      housekeeper: "Femme de chambre",
      technician: "Technicien",
      maintenance: "Maintenance",
      team_member: "Équipier",
    };
    return roleMap[roleName] || roleName;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Gestion du personnel</CardTitle>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter un membre du personnel</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="staff-name">Nom</Label>
                  <Input
                    id="staff-name"
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    placeholder="Nom du membre"
                  />
                </div>
                <div>
                  <Label htmlFor="staff-role">Rôle</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger id="staff-role">
                      <SelectValue placeholder="Sélectionner un rôle" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles?.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {getRoleLabel(role.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={handleAddStaff}
                  disabled={addStaffMutation.isPending}
                  className="w-full"
                >
                  {addStaffMutation.isPending ? "Ajout..." : "Ajouter"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Code d'accès</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {housekeepers?.map((staff) => (
              <TableRow key={staff.id}>
                <TableCell className="font-medium">{staff.name}</TableCell>
                <TableCell>
                  <code className="bg-muted px-2 py-1 rounded text-xs">
                    {staff.access_code}
                  </code>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {staff.is_temporary ? "Temporaire" : "Permanent"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteStaffMutation.mutate(staff.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(!housekeepers || housekeepers.length === 0) && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Aucun membre du personnel
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
