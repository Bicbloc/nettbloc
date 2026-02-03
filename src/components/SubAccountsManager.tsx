import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  UserPlus, 
  Users, 
  Shield, 
  Trash2, 
  Edit, 
  Save, 
  X,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface SubAccount {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role_name: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

interface RoleTemplate {
  id: string;
  role_name: string;
  display_name: string;
  description: string;
  default_permissions: string[];
}

interface Permission {
  key: string;
  label: string;
  category: string;
}

const ALL_PERMISSIONS: Permission[] = [
  // Chambres
  { key: 'rooms.view', label: 'Voir les chambres', category: 'Chambres' },
  { key: 'rooms.import', label: 'Importer des chambres', category: 'Chambres' },
  { key: 'rooms.edit', label: 'Modifier les chambres', category: 'Chambres' },
  { key: 'rooms.delete', label: 'Supprimer des chambres', category: 'Chambres' },
  // Linge
  { key: 'linen.view', label: 'Voir l\'inventaire linge', category: 'Linge' },
  { key: 'linen.add_types', label: 'Ajouter des types de linge', category: 'Linge' },
  { key: 'linen.scan', label: 'Scanner le linge', category: 'Linge' },
  // IA & Configuration
  { key: 'ai.training', label: 'Entraînement IA', category: 'Configuration IA' },
  { key: 'ai.rules', label: 'Règles de nettoyage', category: 'Configuration IA' },
  // Rapports
  { key: 'reports.view', label: 'Voir les rapports', category: 'Rapports' },
  { key: 'reports.export', label: 'Exporter les rapports', category: 'Rapports' },
  // Personnel
  { key: 'staff.view', label: 'Voir le personnel', category: 'Personnel' },
  { key: 'staff.manage', label: 'Gérer le personnel', category: 'Personnel' },
  // Incidents
  { key: 'incidents.view', label: 'Voir les incidents', category: 'Incidents' },
  { key: 'incidents.manage', label: 'Gérer les incidents', category: 'Incidents' },
  { key: 'incidents.add_items', label: 'Ajouter des items', category: 'Incidents' },
];

export function SubAccountsManager() {
  const { user } = useAuth();
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([]);
  const [roleTemplates, setRoleTemplates] = useState<RoleTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SubAccount | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role_name: 'staff',
  });
  const [customPermissions, setCustomPermissions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Load sub-accounts
      const { data: accounts, error: accountsError } = await supabase
        .from('sub_accounts')
        .select('*')
        .eq('parent_user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (accountsError) throw accountsError;
      setSubAccounts(accounts || []);

      // Load role templates
      const { data: roles, error: rolesError } = await supabase
        .from('permission_role_templates')
        .select('*')
        .order('role_name');
      
      if (rolesError) throw rolesError;
      setRoleTemplates((roles || []).map(r => ({
        id: r.id,
        role_name: r.role_name,
        display_name: r.display_name,
        description: r.description || '',
        default_permissions: Array.isArray(r.default_permissions) 
          ? (r.default_permissions as unknown as string[])
          : []
      })));
      
    } catch (error: any) {
      console.error('Error loading sub-accounts:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible de charger les sous-comptes.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!user) return;
    
    if (!formData.email || !formData.first_name || !formData.last_name) {
      toast({
        variant: "destructive",
        title: "Champs requis",
        description: "Veuillez remplir tous les champs obligatoires.",
      });
      return;
    }

    try {
      // Get the hotel info for the email
      const { data: hotelData } = await supabase
        .from('hotels')
        .select('id, name')
        .eq('user_id', user.id)
        .single();

      // Create sub-account record
      const { data: newAccount, error } = await supabase
        .from('sub_accounts')
        .insert({
          parent_user_id: user.id,
          hotel_id: hotelData?.id,
          email: formData.email,
          first_name: formData.first_name,
          last_name: formData.last_name,
          role_name: formData.role_name,
          created_by: user.id,
          invitation_status: 'invited',
        })
        .select()
        .single();

      if (error) throw error;

      // Save custom permissions if any
      const permissionOverrides = Object.entries(customPermissions)
        .filter(([_, value]) => value !== undefined)
        .map(([key, is_allowed]) => ({
          sub_account_id: newAccount.id,
          permission_key: key,
          is_allowed,
        }));

      if (permissionOverrides.length > 0) {
        await supabase
          .from('sub_account_permissions')
          .insert(permissionOverrides);
      }

      // Send invitation email via edge function
      try {
        const { data: inviteResult, error: inviteError } = await supabase.functions.invoke(
          'send-subaccount-invitation',
          {
            body: {
              subAccountId: newAccount.id,
              email: formData.email,
              firstName: formData.first_name,
              lastName: formData.last_name,
              roleName: formData.role_name,
              hotelName: hotelData?.name || 'NettBloc',
            },
          }
        );

        if (inviteError) {
          console.error('Error sending invitation:', inviteError);
          toast({
            variant: "default",
            title: "⚠️ Sous-compte créé",
            description: `${formData.first_name} ${formData.last_name} a été ajouté, mais l'email d'invitation n'a pas pu être envoyé.`,
          });
        } else {
          toast({
            title: "✅ Sous-compte créé",
            description: `Une invitation a été envoyée à ${formData.email}.`,
          });
        }
      } catch (emailError) {
        console.error('Error invoking edge function:', emailError);
        toast({
          variant: "default",
          title: "⚠️ Sous-compte créé",
          description: `${formData.first_name} ${formData.last_name} a été ajouté. L'email sera envoyé ultérieurement.`,
        });
      }

      setIsDialogOpen(false);
      resetForm();
      loadData();
      
    } catch (error: any) {
      console.error('Error creating sub-account:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible de créer le sous-compte.",
      });
    }
  };

  const handleToggleActive = async (account: SubAccount) => {
    try {
      const { error } = await supabase
        .from('sub_accounts')
        .update({ is_active: !account.is_active })
        .eq('id', account.id);

      if (error) throw error;

      toast({
        title: account.is_active ? "Compte désactivé" : "Compte activé",
        description: `${account.first_name} ${account.last_name}`,
      });

      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message,
      });
    }
  };

  const handleDeleteAccount = async (account: SubAccount) => {
    if (!confirm(`Supprimer le sous-compte de ${account.first_name} ${account.last_name} ?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('sub_accounts')
        .delete()
        .eq('id', account.id);

      if (error) throw error;

      toast({
        title: "Sous-compte supprimé",
        description: `${account.first_name} ${account.last_name} a été supprimé.`,
      });

      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message,
      });
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      role_name: 'staff',
    });
    setCustomPermissions({});
    setEditingAccount(null);
  };

  const getRoleDefaultPermissions = (roleName: string): string[] => {
    const role = roleTemplates.find(r => r.role_name === roleName);
    return role?.default_permissions || [];
  };

  const isPermissionEnabled = (permKey: string): boolean => {
    if (customPermissions[permKey] !== undefined) {
      return customPermissions[permKey];
    }
    return getRoleDefaultPermissions(formData.role_name).includes(permKey);
  };

  const togglePermission = (permKey: string) => {
    const roleDefault = getRoleDefaultPermissions(formData.role_name).includes(permKey);
    const current = customPermissions[permKey];
    
    if (current === undefined) {
      // First toggle: set to opposite of role default
      setCustomPermissions({ ...customPermissions, [permKey]: !roleDefault });
    } else if (current === !roleDefault) {
      // Second toggle: clear override (back to role default)
      const { [permKey]: _, ...rest } = customPermissions;
      setCustomPermissions(rest);
    } else {
      // Toggle the value
      setCustomPermissions({ ...customPermissions, [permKey]: !current });
    }
  };

  const permissionsByCategory = ALL_PERMISSIONS.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Sous-comptes
          </h2>
          <p className="text-muted-foreground">
            Gérez les accès de votre équipe avec des permissions personnalisées
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={resetForm}>
              <UserPlus className="h-4 w-4" />
              Nouveau sous-compte
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                {editingAccount ? 'Modifier le sous-compte' : 'Créer un sous-compte'}
              </DialogTitle>
              <DialogDescription>
                Ajoutez un membre de votre équipe avec des permissions personnalisées.
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 min-h-0 pr-4">
              <div className="space-y-6 py-4">
                {/* Informations personnelles */}
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Informations personnelles
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">Prénom *</Label>
                      <Input
                        id="first_name"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        placeholder="Jean"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Nom *</Label>
                      <Input
                        id="last_name"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        placeholder="Dupont"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="jean.dupont@hotel.com"
                    />
                  </div>
                </div>

                <Separator />

                {/* Rôle */}
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Rôle et permissions
                  </h3>
                  <div className="space-y-2">
                    <Label>Rôle de base</Label>
                    <Select
                      value={formData.role_name}
                      onValueChange={(value) => {
                        setFormData({ ...formData, role_name: value });
                        setCustomPermissions({}); // Reset custom permissions
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roleTemplates.map((role) => (
                          <SelectItem key={role.role_name} value={role.role_name}>
                            <div className="flex flex-col">
                              <span className="font-medium">{role.display_name}</span>
                              <span className="text-xs text-muted-foreground">{role.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Permissions granulaires */}
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="permissions">
                      <AccordionTrigger className="text-sm">
                        Personnaliser les permissions
                        {Object.keys(customPermissions).length > 0 && (
                          <Badge variant="secondary" className="ml-2">
                            {Object.keys(customPermissions).length} modifiée(s)
                          </Badge>
                        )}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2">
                          {Object.entries(permissionsByCategory).map(([category, perms]) => (
                            <div key={category} className="space-y-2">
                              <h4 className="text-sm font-medium text-muted-foreground">{category}</h4>
                              <div className="grid grid-cols-2 gap-2">
                                {perms.map((perm) => {
                                  const enabled = isPermissionEnabled(perm.key);
                                  const isOverridden = customPermissions[perm.key] !== undefined;
                                  return (
                                    <div
                                      key={perm.key}
                                      className={`flex items-center justify-between p-2 rounded-md border ${
                                        isOverridden ? 'border-primary bg-primary/5' : 'border-border'
                                      }`}
                                    >
                                      <span className="text-sm">{perm.label}</span>
                                      <Switch
                                        checked={enabled}
                                        onCheckedChange={() => togglePermission(perm.key)}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleCreateAccount} className="gap-2">
                <Save className="h-4 w-4" />
                {editingAccount ? 'Enregistrer' : 'Créer le sous-compte'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Liste des sous-comptes */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Chargement...</div>
      ) : subAccounts.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Aucun sous-compte</h3>
          <p className="text-muted-foreground mb-4">
            Créez des sous-comptes pour permettre à votre équipe d'accéder à l'application.
          </p>
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Créer un sous-compte
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Dernière connexion</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subAccounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell className="font-medium">
                  {account.first_name} {account.last_name}
                </TableCell>
                <TableCell>{account.email}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {roleTemplates.find(r => r.role_name === account.role_name)?.display_name || account.role_name}
                  </Badge>
                </TableCell>
                <TableCell>
                  {account.is_active ? (
                    <Badge className="bg-green-100 text-green-800">Actif</Badge>
                  ) : (
                    <Badge variant="secondary">Inactif</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {account.last_login_at 
                    ? new Date(account.last_login_at).toLocaleDateString('fr-FR')
                    : 'Jamais'
                  }
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleActive(account)}
                      title={account.is_active ? 'Désactiver' : 'Activer'}
                    >
                      {account.is_active ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteAccount(account)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
