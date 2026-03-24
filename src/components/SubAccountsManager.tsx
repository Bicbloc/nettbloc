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
import { Progress } from "@/components/ui/progress";
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
  UserPlus, 
  Users, 
  Shield, 
  Trash2, 
  Save, 
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  Mail,
  CheckCircle,
  Send,
  Loader2,
  Copy,
  Link2,
  RotateCcw,
  Pencil
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
  invitation_status?: string;
  invitation_code?: string | null;
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
  { key: 'rooms.view', label: 'Voir les chambres', category: 'Chambres' },
  { key: 'rooms.import', label: 'Importer des chambres', category: 'Chambres' },
  { key: 'rooms.edit', label: 'Modifier les chambres', category: 'Chambres' },
  { key: 'rooms.delete', label: 'Supprimer des chambres', category: 'Chambres' },
  { key: 'linen.view', label: 'Voir l\'inventaire linge', category: 'Linge' },
  { key: 'linen.add_types', label: 'Ajouter des types de linge', category: 'Linge' },
  { key: 'linen.scan', label: 'Scanner le linge', category: 'Linge' },
  { key: 'ai.training', label: 'Entraînement IA', category: 'Configuration IA' },
  { key: 'ai.rules', label: 'Règles de nettoyage', category: 'Configuration IA' },
  { key: 'reports.view', label: 'Voir les rapports', category: 'Rapports' },
  { key: 'reports.export', label: 'Exporter les rapports', category: 'Rapports' },
  { key: 'staff.view', label: 'Voir le personnel', category: 'Personnel' },
  { key: 'staff.manage', label: 'Gérer le personnel', category: 'Personnel' },
  { key: 'incidents.view', label: 'Voir les incidents', category: 'Incidents' },
  { key: 'incidents.manage', label: 'Gérer les incidents', category: 'Incidents' },
  { key: 'incidents.add_items', label: 'Ajouter des items', category: 'Incidents' },
];

const STEPS = [
  { id: 1, title: 'Informations', icon: Users },
  { id: 2, title: 'Rôle & Permissions', icon: Shield },
  { id: 3, title: 'Confirmation', icon: Mail },
];

export function SubAccountsManager() {
  const { user } = useAuth();
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([]);
  const [roleTemplates, setRoleTemplates] = useState<RoleTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SubAccount | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSending, setIsSending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Always use production domain for activation URLs
  const activationBaseUrl = 'https://nettobloc.bicbloc.eu';
  const getActivationUrl = (code: string) => `${activationBaseUrl}/activate-account?code=${encodeURIComponent(code)}`;
  
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    role_name: 'staff',
  });
  const [customPermissions, setCustomPermissions] = useState<Record<string, boolean>>({});
  const [editFormData, setEditFormData] = useState({ role_name: '' });
  const [editCustomPermissions, setEditCustomPermissions] = useState<Record<string, boolean>>({});
  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data: accounts, error: accountsError } = await supabase
        .from('sub_accounts')
        .select('*')
        .eq('parent_user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (accountsError) throw accountsError;
      setSubAccounts(accounts || []);

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

  const handleSendInvitation = async () => {
    if (!user) return;
    
    setIsSending(true);
    try {
      const { data: hotelData, error: hotelError } = await supabase
        .from('hotels')
        .select('id, name')
        .eq('user_id', user.id)
        .single();

      if (hotelError || !hotelData?.id) {
        throw new Error("Aucun établissement trouvé. Veuillez d'abord créer votre établissement.");
      }

      const { data: newAccount, error } = await supabase
        .from('sub_accounts')
        .insert({
          parent_user_id: user.id,
          hotel_id: hotelData.id, // Always required
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

      const permissionOverrides = Object.entries(customPermissions)
        .filter(([_, value]) => value !== undefined)
        .map(([key, is_allowed]) => ({
          sub_account_id: newAccount.id,
          permission_key: key,
          is_allowed,
        }));

      if (permissionOverrides.length > 0) {
        await supabase.from('sub_account_permissions').insert(permissionOverrides);
      }

      const { data: inviteData, error: inviteError } = await supabase.functions.invoke(
        'send-subaccount-invitation',
        {
          body: {
            subAccountId: newAccount.id,
            email: formData.email,
            firstName: formData.first_name,
            lastName: formData.last_name,
            roleName: roleTemplates.find(r => r.role_name === formData.role_name)?.display_name || formData.role_name,
            hotelName: hotelData?.name || 'NettBloc',
          },
        }
      );

      if (inviteError) {
        toast({
          variant: "default",
          title: "⚠️ Sous-compte créé",
          description: `L'email d'invitation n'a pas pu être envoyé. Réessayez plus tard.`,
        });
      } else {
        const code = (inviteData as any)?.invitationCode as string | undefined;
        const hint = code ? ` Code: ${code} (visible/copier dans la liste).` : '';
        toast({
          title: "✅ Invitation envoyée",
          description: `Un email a été envoyé à ${formData.email} pour activer son compte.${hint}`,
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
    } finally {
      setIsSending(false);
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
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    }
  };

  const handleDeleteAccount = async (account: SubAccount) => {
    if (!confirm(`Supprimer le sous-compte de ${account.first_name} ${account.last_name} ?`)) {
      return;
    }

    try {
      const { error } = await supabase.from('sub_accounts').delete().eq('id', account.id);
      if (error) throw error;

      toast({
        title: "Sous-compte supprimé",
        description: `${account.first_name} ${account.last_name} a été supprimé.`,
      });

      loadData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    }
  };

  const resetForm = () => {
    setFormData({ email: '', first_name: '', last_name: '', role_name: 'staff' });
    setCustomPermissions({});
    setCurrentStep(1);
  };

  const getRoleDefaultPermissions = (roleName: string): string[] => {
    return roleTemplates.find(r => r.role_name === roleName)?.default_permissions || [];
  };

  const isPermissionEnabled = (permKey: string): boolean => {
    if (customPermissions[permKey] !== undefined) return customPermissions[permKey];
    return getRoleDefaultPermissions(formData.role_name).includes(permKey);
  };

  const togglePermission = (permKey: string) => {
    const roleDefault = getRoleDefaultPermissions(formData.role_name).includes(permKey);
    const current = customPermissions[permKey];
    
    if (current === undefined) {
      setCustomPermissions({ ...customPermissions, [permKey]: !roleDefault });
    } else if (current === !roleDefault) {
      const { [permKey]: _, ...rest } = customPermissions;
      setCustomPermissions(rest);
    } else {
      setCustomPermissions({ ...customPermissions, [permKey]: !current });
    }
  };

  const permissionsByCategory = ALL_PERMISSIONS.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const canProceedStep1 = formData.first_name && formData.last_name && formData.email && formData.email.includes('@');
  const canProceedStep2 = formData.role_name;

  const getInvitationStatusBadge = (status?: string) => {
    switch (status) {
      case 'invited':
        return <Badge variant="outline" className="border-orange-400 text-orange-600">En attente</Badge>;
      case 'pending':
        return <Badge variant="outline" className="border-orange-400 text-orange-600">En attente</Badge>;
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Actif</Badge>;
      default:
        return <Badge variant="secondary">Invité</Badge>;
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copié", description: `${label} copié dans le presse-papiers.` });
    } catch (e) {
      // Fallback (older browsers)
      window.prompt(`Copiez ${label} :`, text);
    }
  };

  const handleResendInvitation = async (account: SubAccount) => {
    if (!user) return;
    try {
      setIsSending(true);
      const { data: hotelData } = await supabase
        .from('hotels')
        .select('name')
        .eq('user_id', user.id)
        .single();

      const { data, error } = await supabase.functions.invoke('send-subaccount-invitation', {
        body: {
          subAccountId: account.id,
          email: account.email,
          firstName: account.first_name,
          lastName: account.last_name,
          roleName: roleTemplates.find(r => r.role_name === account.role_name)?.display_name || account.role_name,
          hotelName: hotelData?.name || 'NettBloc',
        },
      });

      if (error) throw error;

      const code = (data as any)?.invitationCode as string | undefined;
      toast({
        title: "📨 Invitation renvoyée",
        description: code ? `Nouvelle invitation envoyée. Code: ${code}` : "Nouvelle invitation envoyée.",
      });
      loadData();
    } catch (error: any) {
      console.error('Resend invitation error:', error);
      toast({ variant: "destructive", title: "Erreur", description: error.message || "Impossible de renvoyer l'invitation." });
    } finally {
      setIsSending(false);
    }
  };

  const openEditDialog = async (account: SubAccount) => {
    setEditingAccount(account);
    setEditFormData({ role_name: account.role_name });
    
    // Load existing permission overrides
    try {
      const { data: overrides } = await supabase
        .from('sub_account_permissions')
        .select('permission_key, is_allowed')
        .eq('sub_account_id', account.id);
      
      const permMap: Record<string, boolean> = {};
      (overrides || []).forEach(o => {
        permMap[o.permission_key] = o.is_allowed;
      });
      setEditCustomPermissions(permMap);
    } catch (error) {
      console.error('Error loading permissions:', error);
      setEditCustomPermissions({});
    }
    
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingAccount) return;
    
    setIsSaving(true);
    try {
      // Update role
      const { error: updateError } = await supabase
        .from('sub_accounts')
        .update({ role_name: editFormData.role_name })
        .eq('id', editingAccount.id);
      
      if (updateError) throw updateError;

      // Delete existing permission overrides
      await supabase
        .from('sub_account_permissions')
        .delete()
        .eq('sub_account_id', editingAccount.id);

      // Insert new permission overrides
      const permissionOverrides = Object.entries(editCustomPermissions)
        .filter(([_, value]) => value !== undefined)
        .map(([key, is_allowed]) => ({
          sub_account_id: editingAccount.id,
          permission_key: key,
          is_allowed,
        }));

      if (permissionOverrides.length > 0) {
        await supabase.from('sub_account_permissions').insert(permissionOverrides);
      }

      toast({
        title: "✅ Modifications enregistrées",
        description: `Les permissions de ${editingAccount.first_name} ${editingAccount.last_name} ont été mises à jour.`,
      });

      setIsEditDialogOpen(false);
      setEditingAccount(null);
      loadData();
    } catch (error: any) {
      console.error('Error saving edit:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible de sauvegarder les modifications.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getEditRoleDefaultPermissions = (roleName: string): string[] => {
    return roleTemplates.find(r => r.role_name === roleName)?.default_permissions || [];
  };

  const isEditPermissionEnabled = (permKey: string): boolean => {
    if (editCustomPermissions[permKey] !== undefined) return editCustomPermissions[permKey];
    return getEditRoleDefaultPermissions(editFormData.role_name).includes(permKey);
  };

  const toggleEditPermission = (permKey: string) => {
    const roleDefault = getEditRoleDefaultPermissions(editFormData.role_name).includes(permKey);
    const current = editCustomPermissions[permKey];
    
    if (current === undefined) {
      setEditCustomPermissions({ ...editCustomPermissions, [permKey]: !roleDefault });
    } else if (current === !roleDefault) {
      const { [permKey]: _, ...rest } = editCustomPermissions;
      setEditCustomPermissions(rest);
    } else {
      setEditCustomPermissions({ ...editCustomPermissions, [permKey]: !current });
    }
  };

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
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Inviter un membre
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <DialogHeader className="flex-shrink-0 pb-2">
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Inviter un membre de l'équipe
              </DialogTitle>
              <DialogDescription>
                Une invitation par email sera envoyée pour activer le compte.
              </DialogDescription>
            </DialogHeader>

            {/* Stepper */}
            <div className="flex-shrink-0 py-4">
              <div className="flex items-center justify-between mb-2">
                {STEPS.map((step, idx) => (
                  <div key={step.id} className="contents">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                        currentStep >= step.id 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {currentStep > step.id ? <CheckCircle className="h-4 w-4" /> : step.id}
                      </div>
                      <span className={`text-sm font-medium hidden sm:block ${
                        currentStep >= step.id ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {step.title}
                      </span>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-2 ${
                        currentStep > step.id ? 'bg-primary' : 'bg-muted'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
              <Progress value={(currentStep / STEPS.length) * 100} className="h-1" />
            </div>

            <ScrollArea className="flex-1 pr-4">
              {/* Step 1: Personal Info */}
              {currentStep === 1 && (
                <div className="space-y-4 py-2">
                  <div className="bg-muted/50 rounded-lg p-4 mb-4">
                    <h3 className="font-medium flex items-center gap-2 mb-1">
                      <Users className="h-4 w-4" />
                      Informations personnelles
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Renseignez les coordonnées du nouveau membre.
                    </p>
                  </div>

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
                    <Label htmlFor="email">Adresse email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="jean.dupont@hotel.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      L'invitation sera envoyée à cette adresse.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 2: Role & Permissions */}
              {currentStep === 2 && (
                <div className="space-y-4 py-2">
                  <div className="bg-muted/50 rounded-lg p-4 mb-4">
                    <h3 className="font-medium flex items-center gap-2 mb-1">
                      <Shield className="h-4 w-4" />
                      Rôle et permissions
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Choisissez un rôle de base puis personnalisez les accès si nécessaire.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Rôle de base</Label>
                    <Select
                      value={formData.role_name}
                      onValueChange={(value) => {
                        setFormData({ ...formData, role_name: value });
                        setCustomPermissions({});
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

                  <Separator className="my-4" />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Permissions</h4>
                      {Object.keys(customPermissions).length > 0 && (
                        <Badge variant="secondary">
                          {Object.keys(customPermissions).length} modifiée(s)
                        </Badge>
                      )}
                    </div>

                    <ScrollArea className="h-[280px] border rounded-lg p-3">
                      <div className="space-y-4 pr-3">
                        {Object.entries(permissionsByCategory).map(([category, perms]) => (
                          <div key={category} className="space-y-2">
                            <h5 className="text-sm font-medium text-muted-foreground sticky top-0 bg-background py-1">{category}</h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                    </ScrollArea>
                  </div>
                </div>
              )}

              {/* Step 3: Confirmation */}
              {currentStep === 3 && (
                <div className="space-y-4 py-2">
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
                    <h3 className="font-medium flex items-center gap-2 mb-1 text-green-800 dark:text-green-300">
                      <Mail className="h-4 w-4" />
                      Prêt à envoyer l'invitation
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-400">
                      Un email sera envoyé avec un code d'activation unique.
                    </p>
                  </div>

                  <div className="bg-muted rounded-lg p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Destinataire</span>
                      <span className="font-medium">{formData.first_name} {formData.last_name}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Email</span>
                      <span className="font-medium">{formData.email}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Rôle</span>
                      <Badge variant="secondary">
                        {roleTemplates.find(r => r.role_name === formData.role_name)?.display_name || formData.role_name}
                      </Badge>
                    </div>
                    {Object.keys(customPermissions).length > 0 && (
                      <>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Permissions personnalisées</span>
                          <Badge variant="outline">{Object.keys(customPermissions).length}</Badge>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-sm text-muted-foreground">
                      Le membre recevra un email avec un lien pour créer son mot de passe et activer son compte.
                    </p>
                  </div>
                </div>
              )}
            </ScrollArea>

            <DialogFooter className="flex-shrink-0 pt-4 gap-2 sm:gap-0">
              {currentStep > 1 && (
                <Button variant="outline" onClick={() => setCurrentStep(currentStep - 1)} disabled={isSending}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Précédent
                </Button>
              )}
              
              {currentStep < 3 ? (
                <Button 
                  onClick={() => setCurrentStep(currentStep + 1)} 
                  disabled={currentStep === 1 ? !canProceedStep1 : !canProceedStep2}
                >
                  Suivant
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleSendInvitation} disabled={isSending} className="gap-2">
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Envoyer l'invitation
                    </>
                  )}
                </Button>
              )}
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
          <h3 className="text-lg font-semibold mb-2">Aucun membre invité</h3>
          <p className="text-muted-foreground mb-4">
            Invitez des membres de votre équipe pour leur donner accès à l'application.
          </p>
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Inviter un membre
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
              <TableHead>Code</TableHead>
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
                  {account.invitation_status === 'pending' || account.invitation_status === 'invited' ? (
                    getInvitationStatusBadge(account.invitation_status)
                  ) : account.is_active ? (
                    <Badge className="bg-green-100 text-green-800">Actif</Badge>
                  ) : (
                    <Badge variant="secondary">Inactif</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {(account.invitation_status === 'pending' || account.invitation_status === 'invited') && account.invitation_code ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono tracking-widest">
                        {account.invitation_code}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(account.invitation_code as string, 'le code')}
                        title="Copier le code"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(getActivationUrl(account.invitation_code as string), 'le lien')}
                        title="Copier le lien d'activation"
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
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
                      onClick={() => openEditDialog(account)}
                      title="Modifier le rôle et les permissions"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {(account.invitation_status === 'pending' || account.invitation_status === 'invited') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleResendInvitation(account)}
                        title="Renvoyer l'invitation"
                        disabled={isSending}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
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

      {/* Dialog d'édition */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { 
        setIsEditDialogOpen(open); 
        if (!open) {
          setEditingAccount(null);
          setEditCustomPermissions({});
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Modifier {editingAccount?.first_name} {editingAccount?.last_name}
            </DialogTitle>
            <DialogDescription>
              Modifiez le rôle et les permissions de ce membre.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4 py-2">
              <div className="bg-muted/50 rounded-lg p-4 mb-4">
                <h3 className="font-medium flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4" />
                  Rôle et permissions
                </h3>
                <p className="text-sm text-muted-foreground">
                  Modifiez le rôle de base et personnalisez les accès.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Rôle de base</Label>
                <Select
                  value={editFormData.role_name}
                  onValueChange={(value) => {
                    setEditFormData({ ...editFormData, role_name: value });
                    setEditCustomPermissions({});
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

              <Separator className="my-4" />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Permissions</h4>
                  {Object.keys(editCustomPermissions).length > 0 && (
                    <Badge variant="secondary">
                      {Object.keys(editCustomPermissions).length} modifiée(s)
                    </Badge>
                  )}
                </div>

                <ScrollArea className="h-[300px] border rounded-lg p-3">
                  <div className="space-y-4 pr-3">
                    {Object.entries(permissionsByCategory).map(([category, perms]) => (
                      <div key={category} className="space-y-2">
                        <h5 className="text-sm font-medium text-muted-foreground sticky top-0 bg-background py-1">{category}</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {perms.map((perm) => {
                            const enabled = isEditPermissionEnabled(perm.key);
                            const isOverridden = editCustomPermissions[perm.key] !== undefined;
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
                                  onCheckedChange={() => toggleEditPermission(perm.key)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="flex-shrink-0 pt-4">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSaving}>
              Annuler
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving} className="gap-2">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Enregistrer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
