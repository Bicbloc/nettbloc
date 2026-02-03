import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Plus, Trash2, Edit, Calendar as CalendarIcon, 
  Repeat, Clock, MapPin, User, Loader2, CheckCircle, Save
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface TaskTemplateManagerProps {
  hotelId: string;
}

interface TaskTemplate {
  id: string;
  title: string;
  description: string | null;
  location_type: string;
  location_reference: string | null;
  assigned_to_type: string;
  priority: string;
  days_of_week: number[];
  is_active: boolean;
  is_one_time: boolean;
  one_time_date: string | null;
  created_at: string;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Lundi', short: 'Lun' },
  { value: 2, label: 'Mardi', short: 'Mar' },
  { value: 3, label: 'Mercredi', short: 'Mer' },
  { value: 4, label: 'Jeudi', short: 'Jeu' },
  { value: 5, label: 'Vendredi', short: 'Ven' },
  { value: 6, label: 'Samedi', short: 'Sam' },
  { value: 0, label: 'Dimanche', short: 'Dim' },
];

const LOCATION_TYPES = [
  { value: 'room', label: 'Chambre', icon: '🛏️' },
  { value: 'corridor', label: 'Couloir', icon: '🚪' },
  { value: 'lobby', label: 'Lobby', icon: '🏨' },
  { value: 'restaurant', label: 'Restaurant', icon: '🍽️' },
  { value: 'spa', label: 'Spa/Piscine', icon: '🏊' },
  { value: 'technical', label: 'Local technique', icon: '🔧' },
  { value: 'other', label: 'Autre', icon: '📍' },
];

const STAFF_TYPES = [
  { value: 'housekeeper', label: 'Femme de chambre', icon: '🧹' },
  { value: 'governess', label: 'Gouvernante', icon: '👩‍💼' },
  { value: 'technician', label: 'Technicien', icon: '🔧' },
];

const PRIORITIES = [
  { value: 'low', label: 'Faible', color: 'bg-gray-100 text-gray-700' },
  { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'Élevée', color: 'bg-orange-100 text-orange-700' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700' },
];

export function TaskTemplateManager({ hotelId }: TaskTemplateManagerProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [activeTab, setActiveTab] = useState<'recurring' | 'one-time'>('recurring');
  const [selectedDate, setSelectedDate] = useState<Date>();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location_type: 'lobby',
    location_reference: '',
    assigned_to_type: 'housekeeper',
    priority: 'normal',
    days_of_week: [] as number[],
    is_one_time: false,
    one_time_date: null as string | null,
  });

  const queryClient = useQueryClient();

  // Fetch templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ["task-templates", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_templates")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as TaskTemplate[];
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const payload = {
        hotel_id: hotelId,
        title: data.title,
        description: data.description || null,
        location_type: data.location_type,
        location_reference: data.location_reference || null,
        assigned_to_type: data.assigned_to_type,
        priority: data.priority,
        days_of_week: data.days_of_week,
        is_one_time: data.is_one_time,
        one_time_date: data.one_time_date,
      };

      if (data.id) {
        const { error } = await supabase
          .from("task_templates")
          .update(payload)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("task_templates")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates", hotelId] });
      toast({ title: editingTemplate ? "Template modifié" : "Template créé" });
      closeDialog();
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erreur lors de la sauvegarde" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("task_templates")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates", hotelId] });
      toast({ title: "Template supprimé" });
    },
  });

  const openCreateDialog = (isOneTime: boolean) => {
    setEditingTemplate(null);
    setFormData({
      title: '',
      description: '',
      location_type: 'lobby',
      location_reference: '',
      assigned_to_type: 'housekeeper',
      priority: 'normal',
      days_of_week: [],
      is_one_time: isOneTime,
      one_time_date: null,
    });
    setSelectedDate(undefined);
    setShowDialog(true);
  };

  const openEditDialog = (template: TaskTemplate) => {
    setEditingTemplate(template);
    setFormData({
      title: template.title,
      description: template.description || '',
      location_type: template.location_type,
      location_reference: template.location_reference || '',
      assigned_to_type: template.assigned_to_type,
      priority: template.priority,
      days_of_week: template.days_of_week || [],
      is_one_time: template.is_one_time,
      one_time_date: template.one_time_date,
    });
    setSelectedDate(template.one_time_date ? new Date(template.one_time_date) : undefined);
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingTemplate(null);
  };

  const toggleDay = (day: number) => {
    setFormData(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day]
    }));
  };

  const handleSave = () => {
    if (!formData.title.trim()) {
      toast({ variant: "destructive", title: "Titre requis" });
      return;
    }

    if (!formData.is_one_time && formData.days_of_week.length === 0) {
      toast({ variant: "destructive", title: "Sélectionnez au moins un jour" });
      return;
    }

    if (formData.is_one_time && !formData.one_time_date) {
      toast({ variant: "destructive", title: "Sélectionnez une date" });
      return;
    }

    saveMutation.mutate({
      ...formData,
      id: editingTemplate?.id
    });
  };

  const recurringTemplates = templates?.filter(t => !t.is_one_time) || [];
  const oneTimeTemplates = templates?.filter(t => t.is_one_time) || [];

  const getDaysLabel = (days: number[]) => {
    if (days.length === 7) return "Tous les jours";
    if (days.length === 0) return "Aucun jour";
    return days
      .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
      .map(d => DAYS_OF_WEEK.find(day => day.value === d)?.short)
      .join(", ");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Repeat className="h-6 w-6" />
            Templates de tâches
          </h2>
          <p className="text-muted-foreground">
            Planifiez des tâches récurrentes ou ponctuelles pour votre équipe
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="recurring" className="gap-2">
              <Repeat className="h-4 w-4" />
              Récurrentes ({recurringTemplates.length})
            </TabsTrigger>
            <TabsTrigger value="one-time" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              Ponctuelles ({oneTimeTemplates.length})
            </TabsTrigger>
          </TabsList>

          <Button onClick={() => openCreateDialog(activeTab === 'one-time')}>
            <Plus className="h-4 w-4 mr-2" />
            {activeTab === 'recurring' ? 'Nouvelle tâche récurrente' : 'Nouvelle tâche ponctuelle'}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <TabsContent value="recurring" className="mt-4">
              {recurringTemplates.length === 0 ? (
                <Card className="p-8 text-center">
                  <Repeat className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="font-semibold mb-2">Aucune tâche récurrente</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Créez des tâches qui se répètent chaque semaine
                  </p>
                  <Button onClick={() => openCreateDialog(false)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Créer une tâche récurrente
                  </Button>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {recurringTemplates.map(template => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onEdit={() => openEditDialog(template)}
                      onDelete={() => deleteMutation.mutate(template.id)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="one-time" className="mt-4">
              {oneTimeTemplates.length === 0 ? (
                <Card className="p-8 text-center">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="font-semibold mb-2">Aucune tâche ponctuelle</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Créez des tâches pour une date spécifique
                  </p>
                  <Button onClick={() => openCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Créer une tâche ponctuelle
                  </Button>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {oneTimeTemplates.map(template => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onEdit={() => openEditDialog(template)}
                      onDelete={() => deleteMutation.mutate(template.id)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Modifier le template' : 
               formData.is_one_time ? 'Nouvelle tâche ponctuelle' : 'Nouvelle tâche récurrente'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Titre de la tâche *</Label>
              <Input
                placeholder="Ex: Nettoyage du lobby"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Détails de la tâche..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            <Separator />

            {/* Recurring: Days selection */}
            {!formData.is_one_time && (
              <div className="space-y-2">
                <Label>Jours de la semaine *</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map(day => (
                    <Button
                      key={day.value}
                      type="button"
                      variant={formData.days_of_week.includes(day.value) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleDay(day.value)}
                    >
                      {day.short}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* One-time: Date selection */}
            {formData.is_one_time && (
              <div className="space-y-2">
                <Label>Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {selectedDate 
                        ? format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })
                        : "Sélectionner une date"
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        setSelectedDate(date);
                        setFormData({ 
                          ...formData, 
                          one_time_date: date ? format(date, 'yyyy-MM-dd') : null 
                        });
                      }}
                      locale={fr}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type de lieu</Label>
                <Select
                  value={formData.location_type}
                  onValueChange={(v) => setFormData({ ...formData, location_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATION_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Référence</Label>
                <Input
                  placeholder="Ex: Étage 2..."
                  value={formData.location_reference}
                  onChange={(e) => setFormData({ ...formData, location_reference: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type de personnel</Label>
                <Select
                  value={formData.assigned_to_type}
                  onValueChange={(v) => setFormData({ ...formData, assigned_to_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAFF_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priorité</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(v) => setFormData({ ...formData, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {editingTemplate ? 'Modifier' : 'Créer'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Template Card Component
function TemplateCard({
  template,
  onEdit,
  onDelete,
}: {
  template: TaskTemplate;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const locationType = LOCATION_TYPES.find(l => l.value === template.location_type);
  const staffType = STAFF_TYPES.find(s => s.value === template.assigned_to_type);
  const priority = PRIORITIES.find(p => p.value === template.priority);

  const getDaysLabel = (days: number[]) => {
    if (days.length === 7) return "Tous les jours";
    if (days.length === 0) return "";
    return days
      .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
      .map(d => DAYS_OF_WEEK.find(day => day.value === d)?.short)
      .join(", ");
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{template.title}</h3>
            <Badge className={priority?.color}>{priority?.label}</Badge>
          </div>

          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
            {template.is_one_time ? (
              <span className="flex items-center gap-1">
                <CalendarIcon className="h-4 w-4" />
                {template.one_time_date 
                  ? format(new Date(template.one_time_date), "d MMM yyyy", { locale: fr })
                  : "Date non définie"
                }
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Repeat className="h-4 w-4" />
                {getDaysLabel(template.days_of_week)}
              </span>
            )}

            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {locationType?.icon} {locationType?.label}
              {template.location_reference && ` - ${template.location_reference}`}
            </span>

            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {staffType?.icon} {staffType?.label}
            </span>
          </div>

          {template.description && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-1">
              {template.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={onEdit}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button 
            size="icon" 
            variant="ghost" 
            className="text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
