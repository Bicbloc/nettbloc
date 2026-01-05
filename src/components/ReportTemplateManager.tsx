import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Save, Trash2, Plus, FileText, ListTodo, Info, Loader2, Star } from "lucide-react";

interface Template {
  id: string;
  name: string;
  template_type: 'todo' | 'toknow' | 'instructions';
  content: string[];
  is_default: boolean;
}

interface ReportTemplateManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotelId: string;
  onTemplateSelected?: (type: string, content: string[]) => void;
}

const TEMPLATE_TYPES = [
  { value: 'todo', label: 'Choses à faire', icon: ListTodo, color: 'bg-blue-100 text-blue-800' },
  { value: 'toknow', label: 'Choses à savoir', icon: Info, color: 'bg-green-100 text-green-800' },
  { value: 'instructions', label: 'Instructions', icon: FileText, color: 'bg-purple-100 text-purple-800' },
];

export function ReportTemplateManager({
  open,
  onOpenChange,
  hotelId,
  onTemplateSelected
}: ReportTemplateManagerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Form state
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<'todo' | 'toknow' | 'instructions'>('todo');
  const [newContent, setNewContent] = useState("");

  useEffect(() => {
    if (open && hotelId) {
      loadTemplates();
    }
  }, [open, hotelId]);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('report_templates')
        .select('*')
        .eq('hotel_id', hotelId)
        .order('template_type')
        .order('name');

      if (error) throw error;
      
      setTemplates((data || []).map(t => ({
        ...t,
        content: Array.isArray(t.content) ? t.content : []
      })) as Template[]);
    } catch (error) {
      console.error('Erreur chargement templates:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les templates"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast({ variant: "destructive", title: "Erreur", description: "Le nom est requis" });
      return;
    }

    const contentLines = newContent.split('\n').filter(line => line.trim());
    if (contentLines.length === 0) {
      toast({ variant: "destructive", title: "Erreur", description: "Le contenu est requis" });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('report_templates')
        .insert({
          hotel_id: hotelId,
          name: newName.trim(),
          template_type: newType,
          content: contentLines
        });

      if (error) throw error;

      toast({ title: "Template créé", description: `"${newName}" a été créé avec succès` });
      setNewName("");
      setNewContent("");
      setShowCreateForm(false);
      loadTemplates();
    } catch (error) {
      console.error('Erreur création template:', error);
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de créer le template" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (template: Template) => {
    if (!confirm(`Supprimer le template "${template.name}" ?`)) return;

    try {
      const { error } = await supabase
        .from('report_templates')
        .delete()
        .eq('id', template.id);

      if (error) throw error;

      toast({ title: "Template supprimé" });
      loadTemplates();
    } catch (error) {
      console.error('Erreur suppression:', error);
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer" });
    }
  };

  const handleSetDefault = async (template: Template) => {
    try {
      // D'abord, retirer le défaut des autres templates du même type
      await supabase
        .from('report_templates')
        .update({ is_default: false })
        .eq('hotel_id', hotelId)
        .eq('template_type', template.template_type);

      // Puis définir celui-ci comme défaut
      const { error } = await supabase
        .from('report_templates')
        .update({ is_default: true })
        .eq('id', template.id);

      if (error) throw error;

      toast({ title: "Template par défaut", description: `"${template.name}" est maintenant le template par défaut` });
      loadTemplates();
    } catch (error) {
      console.error('Erreur:', error);
      toast({ variant: "destructive", title: "Erreur" });
    }
  };

  const handleUseTemplate = (template: Template) => {
    if (onTemplateSelected) {
      onTemplateSelected(template.template_type, template.content);
      toast({ title: "Template appliqué", description: `"${template.name}" a été appliqué` });
      onOpenChange(false);
    }
  };

  const getTypeConfig = (type: string) => {
    return TEMPLATE_TYPES.find(t => t.value === type) || TEMPLATE_TYPES[0];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Gérer les templates de rapport
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Bouton créer */}
          {!showCreateForm && (
            <Button onClick={() => setShowCreateForm(true)} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Créer un nouveau template
            </Button>
          )}

          {/* Formulaire création */}
          {showCreateForm && (
            <Card className="p-4 border-2 border-primary/20">
              <h3 className="font-semibold mb-3">Nouveau template</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Nom</Label>
                    <Input
                      placeholder="Ex: Instructions matin"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Type</Label>
                    <Select value={newType} onValueChange={(v: any) => setNewType(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATE_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            <span className="flex items-center gap-2">
                              <type.icon className="h-4 w-4" />
                              {type.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Contenu (une ligne par élément)</Label>
                  <Textarea
                    placeholder="Vérifier les mini-bars&#10;Compter le linge sale&#10;Signaler les réparations..."
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="min-h-[120px]"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleCreate} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" />
                    Créer
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Liste des templates */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Aucun template créé</p>
              <p className="text-sm">Créez des templates pour les réutiliser dans vos rapports</p>
            </div>
          ) : (
            <div className="space-y-2">
              {TEMPLATE_TYPES.map(typeConfig => {
                const typeTemplates = templates.filter(t => t.template_type === typeConfig.value);
                if (typeTemplates.length === 0) return null;
                
                return (
                  <div key={typeConfig.value} className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                      <typeConfig.icon className="h-4 w-4" />
                      {typeConfig.label}
                    </h4>
                    {typeTemplates.map(template => (
                      <Card key={template.id} className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{template.name}</span>
                              {template.is_default && (
                                <Badge variant="secondary" className="text-xs">
                                  <Star className="h-3 w-3 mr-1" />
                                  Défaut
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {template.content.length} élément(s): {template.content.slice(0, 2).join(', ')}
                              {template.content.length > 2 && '...'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {onTemplateSelected && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleUseTemplate(template)}
                              >
                                Utiliser
                              </Button>
                            )}
                            {!template.is_default && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleSetDefault(template)}
                                title="Définir par défaut"
                              >
                                <Star className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(template)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}