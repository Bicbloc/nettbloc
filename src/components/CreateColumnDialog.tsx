import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { UserPlus, Users, Mail, Plus, Check, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useHousekeeping } from '@/contexts/HousekeepingContext';

interface Housekeeper {
  id: string;
  name: string;
  access_code: string;
  is_active: boolean;
}

interface CreateColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotelId: string;
  assignedHousekeeperNames: string[]; // Noms des femmes de chambre déjà avec des chambres
  onSelectExisting?: (name: string) => void;
  onInviteNew?: () => void;
}

export function CreateColumnDialog({
  open,
  onOpenChange,
  hotelId,
  assignedHousekeeperNames,
  onSelectExisting,
  onInviteNew
}: CreateColumnDialogProps) {
  const [mode, setMode] = useState<'select' | 'create' | 'invite'>('select');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [availableHousekeepers, setAvailableHousekeepers] = useState<Housekeeper[]>([]);
  const { toast } = useToast();
  const { setHousekeeperNames, refreshHousekeepers } = useHousekeeping();

  // Charger les femmes de chambre disponibles (sans chambres assignées)
  useEffect(() => {
    if (open && hotelId) {
      loadAvailableHousekeepers();
    }
  }, [open, hotelId, assignedHousekeeperNames]);

  const loadAvailableHousekeepers = async () => {
    try {
      const { data, error } = await supabase
        .from('housekeepers')
        .select('id, name, access_code, is_active')
        .eq('hotel_id', hotelId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      // Filtrer ceux qui n'ont pas de chambres assignées
      const available = (data || []).filter(
        h => !assignedHousekeeperNames.includes(h.name)
      );
      setAvailableHousekeepers(available);
    } catch (error) {
      console.error('Erreur chargement femmes de chambre:', error);
    }
  };

  const handleSelectExisting = (housekeeper: Housekeeper) => {
    if (onSelectExisting) {
      onSelectExisting(housekeeper.name);
    }
    toast({
      description: `Colonne créée pour ${housekeeper.name}. Assignez-lui des chambres.`
    });
    onOpenChange(false);
    resetState();
  };

  const handleQuickCreate = async () => {
    const trimmedName = name.trim();
    
    if (!trimmedName) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir un nom",
        variant: "destructive"
      });
      return;
    }

    if (trimmedName.length < 2) {
      toast({
        title: "Erreur",
        description: "Le nom doit contenir au moins 2 caractères",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Vérifier si le nom existe déjà
      const { data: existing } = await supabase
        .from('housekeepers')
        .select('id, name')
        .eq('hotel_id', hotelId)
        .eq('name', trimmedName)
        .maybeSingle();

      if (existing) {
        toast({
          title: "Existe déjà",
          description: `${trimmedName} existe déjà dans votre équipe`,
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      // Générer un code d'accès
      const { data: accessCode, error: codeError } = await supabase.rpc(
        'generate_housekeeper_access_code_simple',
        {
          p_hotel_id: hotelId,
          p_housekeeper_name: trimmedName
        }
      );

      if (codeError) throw codeError;

      // Créer la femme de chambre
      const { data: user } = await supabase.auth.getUser();
      const { error: insertError } = await supabase
        .from('housekeepers')
        .insert({
          hotel_id: hotelId,
          name: trimmedName,
          access_code: accessCode,
          user_id: user.user?.id,
          is_active: true,
          is_temporary: false
        });

      if (insertError) throw insertError;

      // Mettre à jour le contexte
      setHousekeeperNames(prev => [...prev, trimmedName]);
      await refreshHousekeepers();

      toast({
        title: "Colonne créée",
        description: `${trimmedName} a été ajouté(e) avec le code ${accessCode}`
      });

      onOpenChange(false);
      resetState();
    } catch (error) {
      console.error('Erreur création:', error);
      toast({
        title: "Erreur",
        description: "Impossible de créer la femme de chambre",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    
    if (!trimmedName || !trimmedEmail) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir le nom et l'email",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Générer un code d'accès
      const { data: accessCode, error: codeError } = await supabase.rpc(
        'generate_housekeeper_access_code_simple',
        {
          p_hotel_id: hotelId,
          p_housekeeper_name: trimmedName
        }
      );

      if (codeError) throw codeError;

      // Créer l'invitation
      const { data: user } = await supabase.auth.getUser();
      const { error: inviteError } = await supabase
        .from('housekeeper_invitations')
        .insert({
          hotel_id: hotelId,
          invited_name: trimmedName,
          invited_email: trimmedEmail,
          access_code: accessCode,
          created_by: user.user?.id,
          status: 'pending'
        });

      if (inviteError) throw inviteError;

      // Créer aussi la femme de chambre
      const { error: insertError } = await supabase
        .from('housekeepers')
        .insert({
          hotel_id: hotelId,
          name: trimmedName,
          access_code: accessCode,
          user_id: user.user?.id,
          is_active: true,
          is_temporary: false
        });

      if (insertError) throw insertError;

      // Mettre à jour le contexte
      setHousekeeperNames(prev => [...prev, trimmedName]);
      await refreshHousekeepers();

      toast({
        title: "Invitation créée",
        description: `${trimmedName} a été invité(e). Code: ${accessCode}`
      });

      onOpenChange(false);
      resetState();
    } catch (error) {
      console.error('Erreur invitation:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer l'invitation",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetState = () => {
    setMode('select');
    setName('');
    setEmail('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (mode === 'create') {
        handleQuickCreate();
      } else if (mode === 'invite') {
        handleInvite();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetState(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Créer une colonne
          </DialogTitle>
        </DialogHeader>

        {mode === 'select' && (
          <div className="space-y-4">
            {/* Femmes de chambre disponibles */}
            {availableHousekeepers.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4" />
                  Femmes de chambre disponibles
                </Label>
                <ScrollArea className="h-[150px] border rounded-lg p-2">
                  <div className="space-y-1">
                    {availableHousekeepers.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => handleSelectExisting(h)}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{h.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {availableHousekeepers.length > 0 && <Separator />}

            {/* Options de création */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Ou ajouter quelqu'un</Label>
              
              <div className="grid gap-2">
                <Button
                  variant="outline"
                  className="justify-start h-auto py-3"
                  onClick={() => setMode('create')}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Plus className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">Création rapide</div>
                      <div className="text-xs text-muted-foreground">
                        Juste nom et prénom, sans invitation
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="ml-auto">Rapide</Badge>
                </Button>

                <Button
                  variant="outline"
                  className="justify-start h-auto py-3"
                  onClick={() => setMode('invite')}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-blue-500/10">
                      <Mail className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">Inviter par email</div>
                      <div className="text-xs text-muted-foreground">
                        Envoyer un code d'accès par email
                      </div>
                    </div>
                  </div>
                  <Badge className="ml-auto bg-blue-500">Invitation</Badge>
                </Button>
              </div>
            </div>
          </div>
        )}

        {mode === 'create' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
              <Badge variant="secondary">Création rapide</Badge>
              <span className="text-xs text-muted-foreground">Sans invitation email</span>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="quick-name">Nom et prénom</Label>
              <Input
                id="quick-name"
                placeholder="Ex: Marie Dupont"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyPress={handleKeyPress}
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode('select')} className="flex-1">
                Retour
              </Button>
              <Button onClick={handleQuickCreate} className="flex-1" disabled={!name.trim() || isLoading}>
                <Plus className="h-4 w-4 mr-2" />
                {isLoading ? 'Création...' : 'Créer'}
              </Button>
            </div>
          </div>
        )}

        {mode === 'invite' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
              <Badge className="bg-blue-500">Invitation</Badge>
              <span className="text-xs text-muted-foreground">Avec envoi par email</span>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="invite-name">Nom et prénom</Label>
              <Input
                id="invite-name"
                placeholder="Ex: Marie Dupont"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="marie.dupont@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={handleKeyPress}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode('select')} className="flex-1">
                Retour
              </Button>
              <Button onClick={handleInvite} className="flex-1" disabled={!name.trim() || !email.trim() || isLoading}>
                <Mail className="h-4 w-4 mr-2" />
                {isLoading ? 'Envoi...' : 'Inviter'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
