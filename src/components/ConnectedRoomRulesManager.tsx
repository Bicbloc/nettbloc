import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, Save, X, Link2, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConnectedRoomRule {
  id: string;
  hotel_id: string;
  rule_name: string;
  rule_type: 'family' | 'suite' | 'twin' | 'connecting' | 'custom';
  pattern_regex: string;
  description: string | null;
  is_active: boolean;
  priority: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface ConnectedRoomRulesManagerProps {
  hotelId: string;
}

const RULE_TYPE_LABELS: Record<string, string> = {
  family: 'Chambre Familiale',
  suite: 'Suite',
  twin: 'Chambre Jumelle',
  connecting: 'Chambre Communicante',
  custom: 'Personnalisée'
};

const RULE_TYPE_COLORS: Record<string, string> = {
  family: 'bg-purple-100 text-purple-800',
  suite: 'bg-blue-100 text-blue-800',
  twin: 'bg-green-100 text-green-800',
  connecting: 'bg-orange-100 text-orange-800',
  custom: 'bg-gray-100 text-gray-800'
};

const PRESET_PATTERNS = {
  family: [
    { name: 'Standard (ex: 101-102)', pattern: '(\\d{2,4})\\s*[-–]\\s*(\\d{2,4})', example: '101-102, 201–202' },
    { name: 'Avec Plus (ex: 101+102)', pattern: '(\\d{2,4})\\s*\\+\\s*(\\d{2,4})', example: '101+102, 201+202' },
    { name: 'Avec "et" (ex: 101 et 102)', pattern: '(\\d{2,4})\\s*et\\s*(\\d{2,4})', example: '101 et 102' }
  ],
  suite: [
    { name: 'Suite (ex: Suite 101-102)', pattern: 'Suite\\s+(\\d{2,4})\\s*[-–]\\s*(\\d{2,4})', example: 'Suite 101-102' },
    { name: 'Junior Suite', pattern: 'Junior\\s+Suite\\s+(\\d{2,4})', example: 'Junior Suite 101' }
  ],
  twin: [
    { name: 'Twin Standard', pattern: 'Twin\\s+(\\d{2,4})\\s*[-–]\\s*(\\d{2,4})', example: 'Twin 101-102' },
    { name: 'Jumelle', pattern: 'Jumelle\\s+(\\d{2,4})\\s*[-–]\\s*(\\d{2,4})', example: 'Jumelle 101-102' }
  ],
  connecting: [
    { name: 'Communicante', pattern: '(\\d{2,4})\\s*<->\\s*(\\d{2,4})', example: '101<->102' },
    { name: 'Avec Flèche', pattern: '(\\d{2,4})\\s*→\\s*(\\d{2,4})', example: '101→102' }
  ]
};

export const ConnectedRoomRulesManager = ({ hotelId }: ConnectedRoomRulesManagerProps) => {
  const { toast } = useToast();
  const [rules, setRules] = useState<ConnectedRoomRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<ConnectedRoomRule | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);
  const [showPatternHelper, setShowPatternHelper] = useState(false);

  const [formData, setFormData] = useState({
    rule_name: '',
    rule_type: 'custom' as ConnectedRoomRule['rule_type'],
    pattern_regex: '',
    description: '',
    is_active: true,
    priority: 1
  });

  useEffect(() => {
    loadRules();
  }, [hotelId]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('connected_room_rules')
        .select('*')
        .eq('hotel_id', hotelId)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRules((data || []) as ConnectedRoomRule[]);
    } catch (error) {
      console.error('Error loading rules:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les règles",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      if (editingRule) {
        // Update existing rule
        const { error } = await supabase
          .from('connected_room_rules')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingRule.id);

        if (error) throw error;
        
        toast({
          title: "Succès",
          description: "Règle mise à jour avec succès"
        });
      } else {
        // Create new rule
        const { error } = await supabase
          .from('connected_room_rules')
          .insert([{
            ...formData,
            hotel_id: hotelId,
            created_by: user.id
          }]);

        if (error) throw error;
        
        toast({
          title: "Succès",
          description: "Règle créée avec succès"
        });
      }

      setShowDialog(false);
      setEditingRule(null);
      resetForm();
      loadRules();
    } catch (error) {
      console.error('Error saving rule:', error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder la règle",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async () => {
    if (!ruleToDelete) return;

    try {
      const { error } = await supabase
        .from('connected_room_rules')
        .delete()
        .eq('id', ruleToDelete);

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Règle supprimée avec succès"
      });

      loadRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la règle",
        variant: "destructive"
      });
    } finally {
      setShowDeleteDialog(false);
      setRuleToDelete(null);
    }
  };

  const toggleRuleActive = async (ruleId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('connected_room_rules')
        .update({ is_active: !isActive })
        .eq('id', ruleId);

      if (error) throw error;

      toast({
        title: "Succès",
        description: `Règle ${!isActive ? 'activée' : 'désactivée'}`
      });

      loadRules();
    } catch (error) {
      console.error('Error toggling rule:', error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier la règle",
        variant: "destructive"
      });
    }
  };

  const openEditDialog = (rule: ConnectedRoomRule) => {
    setEditingRule(rule);
    setFormData({
      rule_name: rule.rule_name,
      rule_type: rule.rule_type,
      pattern_regex: rule.pattern_regex,
      description: rule.description || '',
      is_active: rule.is_active,
      priority: rule.priority
    });
    setShowDialog(true);
  };

  const openCreateDialog = () => {
    setEditingRule(null);
    resetForm();
    setShowDialog(true);
  };

  const resetForm = () => {
    setFormData({
      rule_name: '',
      rule_type: 'custom',
      pattern_regex: '',
      description: '',
      is_active: true,
      priority: 1
    });
  };

  const applyPresetPattern = (pattern: string) => {
    setFormData(prev => ({ ...prev, pattern_regex: pattern }));
    setShowPatternHelper(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Règles de Chambres Connectées</h3>
          <p className="text-sm text-muted-foreground">
            Définissez comment détecter automatiquement les chambres familiales, suites, et autres types connectés
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle Règle
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Chargement...</div>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Link2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              Aucune règle personnalisée définie
            </p>
            <Button onClick={openCreateDialog} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Créer votre première règle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rules.map(rule => (
            <Card key={rule.id} className={!rule.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-base">{rule.rule_name}</CardTitle>
                      <Badge className={RULE_TYPE_COLORS[rule.rule_type]}>
                        {RULE_TYPE_LABELS[rule.rule_type]}
                      </Badge>
                      <Badge variant="outline">Priorité: {rule.priority}</Badge>
                    </div>
                    <CardDescription className="text-xs">
                      {rule.description || 'Aucune description'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={() => toggleRuleActive(rule.id, rule.is_active)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(rule)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRuleToDelete(rule.id);
                        setShowDeleteDialog(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-xs font-mono">{rule.pattern_regex}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Modifier la règle' : 'Nouvelle règle'}
            </DialogTitle>
            <DialogDescription>
              Définissez un pattern pour détecter automatiquement les chambres connectées
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="rule_name">Nom de la règle</Label>
              <Input
                id="rule_name"
                value={formData.rule_name}
                onChange={(e) => setFormData(prev => ({ ...prev, rule_name: e.target.value }))}
                placeholder="ex: Suites familiales étage 1"
              />
            </div>

            <div>
              <Label htmlFor="rule_type">Type de règle</Label>
              <Select
                value={formData.rule_type}
                onValueChange={(value: ConnectedRoomRule['rule_type']) =>
                  setFormData(prev => ({ ...prev, rule_type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RULE_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label htmlFor="pattern_regex">Expression régulière (Regex)</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPatternHelper(!showPatternHelper)}
                >
                  <Info className="h-3 w-3 mr-1" />
                  Patterns prédéfinis
                </Button>
              </div>
              <Input
                id="pattern_regex"
                value={formData.pattern_regex}
                onChange={(e) => setFormData(prev => ({ ...prev, pattern_regex: e.target.value }))}
                placeholder="(\\d{2,4})\\s*[-–]\\s*(\\d{2,4})"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Format: expression regex pour capturer les numéros de chambres connectées
              </p>

              {showPatternHelper && formData.rule_type !== 'custom' && (
                <div className="mt-3 p-3 bg-muted rounded-md space-y-2">
                  <p className="text-sm font-medium">Patterns suggérés pour {RULE_TYPE_LABELS[formData.rule_type]} :</p>
                  {PRESET_PATTERNS[formData.rule_type]?.map((preset, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-background rounded">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{preset.name}</p>
                        <p className="text-xs text-muted-foreground">Exemple: {preset.example}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyPresetPattern(preset.pattern)}
                      >
                        Utiliser
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="description">Description (optionnel)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Décrivez comment cette règle identifie les chambres connectées"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="priority">Priorité</Label>
              <Input
                id="priority"
                type="number"
                min="1"
                max="100"
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 1 }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Les règles avec une priorité plus élevée seront appliquées en premier
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="is_active">Règle active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDialog(false);
              setEditingRule(null);
              resetForm();
            }}>
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={!formData.rule_name || !formData.pattern_regex}>
              <Save className="h-4 w-4 mr-2" />
              {editingRule ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette règle ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La règle sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};