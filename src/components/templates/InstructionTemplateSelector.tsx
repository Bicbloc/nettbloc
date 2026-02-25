import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  FileText, 
  AlertCircle, 
  Lightbulb, 
  CheckSquare, 
  History, 
  Star, 
  Plus, 
  Save,
  Loader2,
  Trash2
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface InstructionTemplateSelectorProps {
  hotelId: string;
  instructions: string;
  toKnow: string;
  todoList: string;
  onInstructionsChange: (value: string) => void;
  onToKnowChange: (value: string) => void;
  onTodoListChange: (value: string) => void;
}

interface Template {
  id: string;
  name: string;
  template_type: string;
  content: string;
  is_default: boolean;
  day_of_week: number | null;
}

export function InstructionTemplateSelector({
  hotelId,
  instructions,
  toKnow,
  todoList,
  onInstructionsChange,
  onToKnowChange,
  onTodoListChange,
}: InstructionTemplateSelectorProps) {
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [savingType, setSavingType] = useState<string | null>(null);

  // Fetch templates
  const { data: templates, isLoading, refetch } = useQuery({
    queryKey: ["instruction-templates", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instruction_templates")
        .select("*")
        .eq("hotel_id", hotelId)
        .order("template_type")
        .order("is_default", { ascending: false });

      if (error) throw error;
      return data as Template[];
    },
  });

  // Fetch last used instructions
  const { data: lastInstructions } = useQuery({
    queryKey: ["last-instructions", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_instructions")
        .select("*")
        .eq("hotel_id", hotelId)
        .order("instruction_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Load day-of-week or default templates on mount
  useEffect(() => {
    if (templates && templates.length > 0 && !instructions && !toKnow && !todoList) {
      const currentDay = new Date().getDay();
      
      // Priority: day-of-week template > default template
      const findBestTemplate = (type: string) => {
        const dayTemplate = templates.find(t => t.template_type === type && t.day_of_week === currentDay);
        if (dayTemplate) return dayTemplate;
        return templates.find(t => t.template_type === type && t.is_default);
      };

      const bestInstruction = findBestTemplate('instructions');
      const bestToKnow = findBestTemplate('to_know');
      const bestTodo = findBestTemplate('todo');

      if (bestInstruction) onInstructionsChange(bestInstruction.content);
      if (bestToKnow) onToKnowChange(bestToKnow.content);
      if (bestTodo) onTodoListChange(bestTodo.content);
    }
  }, [templates]);

  const applyTemplate = (template: Template) => {
    switch (template.template_type) {
      case 'instructions':
        onInstructionsChange(template.content);
        break;
      case 'to_know':
        onToKnowChange(template.content);
        break;
      case 'todo':
        onTodoListChange(template.content);
        break;
    }
    toast({ title: "Template appliqué", description: `"${template.name}" a été appliqué` });
  };

  const applyLastUsed = () => {
    if (lastInstructions) {
      if (lastInstructions.instructions) onInstructionsChange(lastInstructions.instructions);
      if (lastInstructions.to_know) onToKnowChange(lastInstructions.to_know);
      if (lastInstructions.todo_list) onTodoListChange(lastInstructions.todo_list);
      toast({ title: "Dernières consignes chargées" });
    }
  };

  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number | null>(null);

  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

  const saveAsTemplate = async (type: string, content: string) => {
    if (!newTemplateName.trim() || !content.trim()) {
      toast({ variant: "destructive", title: "Erreur", description: "Nom et contenu requis" });
      return;
    }

    setSavingType(type);
    try {
      const { error } = await supabase
        .from("instruction_templates")
        .insert({
          hotel_id: hotelId,
          name: newTemplateName.trim(),
          template_type: type,
          content: content,
          is_default: false,
          day_of_week: selectedDayOfWeek,
        });

      if (error) throw error;

      toast({ title: "Template sauvegardé" });
      setNewTemplateName("");
      setSelectedDayOfWeek(null);
      refetch();
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Erreur" });
    } finally {
      setSavingType(null);
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from("instruction_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Template supprimé" });
      refetch();
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur" });
    }
  };

  const setAsDefault = async (template: Template) => {
    try {
      // Remove default from others of same type
      await supabase
        .from("instruction_templates")
        .update({ is_default: false })
        .eq("hotel_id", hotelId)
        .eq("template_type", template.template_type);

      // Set this one as default
      const { error } = await supabase
        .from("instruction_templates")
        .update({ is_default: true })
        .eq("id", template.id);

      if (error) throw error;
      toast({ title: "Défini par défaut" });
      refetch();
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur" });
    }
  };

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'instructions':
        return { icon: AlertCircle, label: "Consignes", color: "text-red-500" };
      case 'to_know':
        return { icon: Lightbulb, label: "À savoir", color: "text-amber-500" };
      case 'todo':
        return { icon: CheckSquare, label: "To-do", color: "text-green-500" };
      default:
        return { icon: FileText, label: type, color: "text-gray-500" };
    }
  };

  const instructionTemplates = templates?.filter(t => t.template_type === 'instructions') || [];
  const toKnowTemplates = templates?.filter(t => t.template_type === 'to_know') || [];
  const todoTemplates = templates?.filter(t => t.template_type === 'todo') || [];

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        {lastInstructions && (
          <Button variant="outline" size="sm" onClick={applyLastUsed}>
            <History className="h-4 w-4 mr-1" />
            Réutiliser les dernières
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setShowTemplateManager(true)}>
          <FileText className="h-4 w-4 mr-1" />
          Gérer les templates
        </Button>
      </div>

      {/* Instructions Fields with Template Quick Select */}
      <div className="space-y-4">
        {/* Consignes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Consignes
            </Label>
            {instructionTemplates.length > 0 && (
              <div className="flex gap-1">
                {instructionTemplates.slice(0, 3).map(t => (
                  <Button 
                    key={t.id} 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs"
                    onClick={() => applyTemplate(t)}
                  >
                    {t.is_default && <Star className="h-3 w-3 mr-1 text-amber-500" />}
                    {t.name}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <Textarea
            placeholder="Ex: VIP chambre 201, événement spécial au restaurant..."
            value={instructions}
            onChange={(e) => onInstructionsChange(e.target.value)}
            rows={3}
          />
        </div>

        {/* À savoir */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              À savoir
            </Label>
            {toKnowTemplates.length > 0 && (
              <div className="flex gap-1">
                {toKnowTemplates.slice(0, 3).map(t => (
                  <Button 
                    key={t.id} 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs"
                    onClick={() => applyTemplate(t)}
                  >
                    {t.is_default && <Star className="h-3 w-3 mr-1 text-amber-500" />}
                    {t.name}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <Textarea
            placeholder="Ex: Livraison linge à 10h, réunion à 14h..."
            value={toKnow}
            onChange={(e) => onToKnowChange(e.target.value)}
            rows={3}
          />
        </div>

        {/* To-do */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-green-500" />
              To-do du jour
            </Label>
            {todoTemplates.length > 0 && (
              <div className="flex gap-1">
                {todoTemplates.slice(0, 3).map(t => (
                  <Button 
                    key={t.id} 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs"
                    onClick={() => applyTemplate(t)}
                  >
                    {t.is_default && <Star className="h-3 w-3 mr-1 text-amber-500" />}
                    {t.name}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <Textarea
            placeholder="Ex: Vérifier les stocks de produits, préparer chambres 301-305..."
            value={todoList}
            onChange={(e) => onTodoListChange(e.target.value)}
            rows={3}
          />
        </div>
      </div>

      {/* Template Manager Dialog */}
      <Dialog open={showTemplateManager} onOpenChange={setShowTemplateManager}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Gérer les templates de consignes</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="instructions">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="instructions" className="gap-1">
                <AlertCircle className="h-4 w-4" />
                Consignes
              </TabsTrigger>
              <TabsTrigger value="to_know" className="gap-1">
                <Lightbulb className="h-4 w-4" />
                À savoir
              </TabsTrigger>
              <TabsTrigger value="todo" className="gap-1">
                <CheckSquare className="h-4 w-4" />
                To-do
              </TabsTrigger>
            </TabsList>

            {['instructions', 'to_know', 'todo'].map(type => {
              const typeTemplates = templates?.filter(t => t.template_type === type) || [];
              const config = getTypeConfig(type);
              const currentContent = type === 'instructions' ? instructions : type === 'to_know' ? toKnow : todoList;

              return (
                <TabsContent key={type} value={type} className="space-y-4">
                  {/* Save current as template */}
                  {currentContent && (
                    <Card className="p-3 bg-primary/5">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Nom du template..."
                            value={newTemplateName}
                            onChange={(e) => setNewTemplateName(e.target.value)}
                            className="flex-1"
                          />
                          <Button 
                            size="sm" 
                            onClick={() => saveAsTemplate(type, currentContent)}
                            disabled={savingType === type}
                          >
                            {savingType === type ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-1" />
                                Sauvegarder
                              </>
                            )}
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">Jour :</Label>
                          <select
                            className="text-xs border rounded px-2 py-1 bg-background"
                            value={selectedDayOfWeek ?? ''}
                            onChange={(e) => setSelectedDayOfWeek(e.target.value === '' ? null : Number(e.target.value))}
                          >
                            <option value="">Tous les jours</option>
                            {dayNames.map((day, i) => (
                              <option key={i} value={i}>{day}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Template List */}
                  <ScrollArea className="h-[300px]">
                    {isLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : typeTemplates.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <config.icon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Aucun template créé</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {typeTemplates.map(template => (
                          <Card key={template.id} className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">{template.name}</span>
                                  {template.is_default && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Star className="h-3 w-3 mr-1" />
                                      Défaut
                                    </Badge>
                                  )}
                                  {template.day_of_week !== null && template.day_of_week !== undefined && (
                                    <Badge variant="outline" className="text-xs">
                                      {dayNames[template.day_of_week]}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {template.content}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => applyTemplate(template)}
                                >
                                  Utiliser
                                </Button>
                                {!template.is_default && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setAsDefault(template)}
                                    title="Définir par défaut"
                                  >
                                    <Star className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() => deleteTemplate(template.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              );
            })}
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateManager(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
