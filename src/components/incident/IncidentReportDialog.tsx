import { useState, useEffect } from "react";
import { fetchPmsRooms } from "@/services/breakfastConfigService";
import { stayLabel } from "@/utils/stayStatus";
import { supabase } from "@/integrations/supabase/client";
import { createNotification } from "@/services/notificationService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Upload, X } from "lucide-react";
import { z } from "zod";

// Validation schema avec zod
const incidentSchema = z.object({
  title: z.string().trim().min(3, "Le titre doit contenir au moins 3 caractères").max(200, "Maximum 200 caractères"),
  description: z.string().trim().max(2000, "Maximum 2000 caractères").optional(),
  category_id: z.string().uuid("Sélectionnez une catégorie"),
  item_id: z.string().uuid().optional(),
  type_id: z.string().uuid("Sélectionnez un type"),
  location_type: z.enum(['room', 'common_area', 'technical', 'other']),
  location_reference: z.string().trim().max(100, "Maximum 100 caractères").optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  assigned_to_role_id: z.string().uuid().optional(),
  assigned_to_other: z.string().trim().max(100, "Maximum 100 caractères").optional(),
});

interface IncidentReportDialogProps {
  hotelId: string;
  userType: 'admin' | 'housekeeper';
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export const IncidentReportDialog = ({ hotelId, userType, trigger, onSuccess }: IncidentReportDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Data
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [registeredRooms, setRegisteredRooms] = useState<Array<{ room_number: string; id: string; guest: string | null; status: string | null; occupied: boolean }>>([]);

  // Form
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    item_id: '',
    type_id: '',
    location_type: 'room' as 'room' | 'common_area' | 'technical' | 'other',
    location_reference: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    assigned_to_role_id: '',
    assigned_to_other: '',
  });

  const [images, setImages] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      loadInventory();
      loadRegisteredRooms();
    }
  }, [open, hotelId]);

  const loadRegisteredRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('hotel_rooms_registry')
        .select('id, room_number')
        .eq('hotel_id', hotelId)
        .eq('is_active', true)
        .order('room_number');

      if (error) throw error;
      setRegisteredRooms(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des chambres:', error);
    }
  };

  const loadInventory = async () => {
    const [categoriesRes, typesRes, rolesRes] = await Promise.all([
      supabase.from('incident_categories').select('*').eq('hotel_id', hotelId).eq('is_active', true).order('display_order'),
      supabase.from('incident_types').select('*').eq('hotel_id', hotelId).eq('is_active', true),
      supabase.from('staff_roles').select('*').eq('hotel_id', hotelId).eq('is_active', true)
    ]);

    if (categoriesRes.data) setCategories(categoriesRes.data);
    if (typesRes.data) setTypes(typesRes.data);
    if (rolesRes.data) setRoles(rolesRes.data);
  };

  useEffect(() => {
    if (formData.category_id) {
      loadItemsForCategory(formData.category_id);
    } else {
      setItems([]);
      setFormData(prev => ({ ...prev, item_id: '' }));
    }
  }, [formData.category_id]);

  const loadItemsForCategory = async (categoryId: string) => {
    const { data } = await supabase
      .from('incident_items')
      .select('*')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .order('display_order');

    if (data) setItems(data);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(f => {
      // Validation: taille max 10MB, formats acceptés
      if (f.size > 10 * 1024 * 1024) {
        toast({ title: "Erreur", description: `${f.name}: fichier trop volumineux (max 10MB)`, variant: "destructive" });
        return false;
      }
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(f.type)) {
        toast({ title: "Erreur", description: `${f.name}: format non supporté`, variant: "destructive" });
        return false;
      }
      return true;
    });

    setImages(prev => [...prev, ...validFiles].slice(0, 5)); // Max 5 images
  };

  const handleSubmit = async () => {
    try {
      setErrors({});
      setLoading(true);

      // Validation avec zod
      const validated = incidentSchema.parse(formData);

      // Récupérer l'utilisateur
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      // Créer l'incident
      const { data: incident, error: incidentError } = await supabase
        .from('incidents')
        .insert([{
          hotel_id: hotelId,
          title: validated.title,
          description: validated.description || null,
          category_id: validated.category_id,
          item_id: validated.item_id || null,
          type_id: validated.type_id,
          location_type: validated.location_type,
          location_reference: validated.location_reference || null,
          priority: validated.priority,
          assigned_to_role_id: validated.assigned_to_role_id || null,
          assigned_to_other: validated.assigned_to_other || null,
          reported_by: user.id,
          reported_by_name: user.email || 'Utilisateur',
          reported_by_type: userType,
          status: 'new'
        }])
        .select()
        .single();

      if (incidentError) throw incidentError;

      // Upload des images
      if (images.length > 0 && incident) {
        await uploadImages(incident.id, user.id);
      }

      // Notification à l'établissement
      await createNotification({
        hotelId,
        title: "🛠️ Incident signalé",
        description: `${incident.title}${incident.location_reference ? ` — Chambre ${incident.location_reference}` : ''}`,
        type: "incident",
        roomNumber: incident.location_reference || undefined,
      });

      toast({
        title: "Incident signalé",
        description: "L'incident a été enregistré avec succès"
      });

      resetForm();
      setOpen(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path[0]) newErrors[err.path[0] as string] = err.message;
        });
        setErrors(newErrors);
      } else {
        toast({
          title: "Erreur",
          description: "Impossible de créer l'incident",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const uploadImages = async (incidentId: string, userId: string) => {
    for (const image of images) {
      const fileName = `${incidentId}/${Date.now()}_${image.name}`;
      const { data, error } = await supabase.storage
        .from('incident-images')
        .upload(fileName, image);

      if (!error && data) {
        await supabase.from('incident_images').insert([{
          incident_id: incidentId,
          image_url: data.path,
          uploaded_by: userId
        }]);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category_id: '',
      item_id: '',
      type_id: '',
      location_type: 'room',
      location_reference: '',
      priority: 'medium',
      assigned_to_role_id: '',
      assigned_to_other: '',
    });
    setImages([]);
    setErrors({});
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <AlertCircle className="h-4 w-4 mr-2" />
            Signaler un Incident
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Signaler un Incident</DialogTitle>
          <DialogDescription>
            Décrivez le problème rencontré pour permettre une intervention rapide
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Titre */}
          <div>
            <Label htmlFor="title">Titre de l'incident *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Robinet qui fuit dans la chambre 102"
              maxLength={200}
            />
            {errors.title && <p className="text-sm text-destructive mt-1">{errors.title}</p>}
          </div>

          {/* Catégorie */}
          <div>
            <Label>Catégorie *</Label>
            <Select value={formData.category_id} onValueChange={(v) => setFormData(prev => ({ ...prev, category_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category_id && <p className="text-sm text-destructive mt-1">{errors.category_id}</p>}
          </div>

          {/* Item */}
          {items.length > 0 && (
            <div>
              <Label>Item spécifique</Label>
              <Select value={formData.item_id} onValueChange={(v) => setFormData(prev => ({ ...prev, item_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Optionnel..." />
                </SelectTrigger>
                <SelectContent>
                  {items.map(item => (
                    <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Type */}
          <div>
            <Label>Type d'incident *</Label>
            <Select value={formData.type_id} onValueChange={(v) => setFormData(prev => ({ ...prev, type_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {types.map(type => (
                  <SelectItem key={type.id} value={type.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: type.color }} />
                      {type.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.type_id && <p className="text-sm text-destructive mt-1">{errors.type_id}</p>}
          </div>

          {/* Location */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type de localisation *</Label>
              <Select value={formData.location_type} onValueChange={(v: any) => setFormData(prev => ({ ...prev, location_type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="room">Chambre</SelectItem>
                  <SelectItem value="common_area">Espace commun</SelectItem>
                  <SelectItem value="technical">Local technique</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Numéro/Référence</Label>
              {formData.location_type === 'room' && registeredRooms.length > 0 ? (
                <Select
                  value={formData.location_reference}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, location_reference: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une chambre" />
                  </SelectTrigger>
                  <SelectContent>
                    {registeredRooms.map((room) => (
                      <SelectItem key={room.id} value={room.room_number}>
                        Chambre {room.room_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={formData.location_reference}
                  onChange={(e) => setFormData(prev => ({ ...prev, location_reference: e.target.value }))}
                  placeholder={
                    formData.location_type === 'room' 
                      ? "Ex: 102, 205..." 
                      : formData.location_type === 'common_area'
                      ? "Ex: Hall, Restaurant..."
                      : "Précisez la localisation"
                  }
                  maxLength={100}
                />
              )}
            </div>
          </div>

          {/* Priority */}
          <div>
            <Label>Priorité *</Label>
            <Select value={formData.priority} onValueChange={(v: any) => setFormData(prev => ({ ...prev, priority: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Faible</SelectItem>
                <SelectItem value="medium">Moyen</SelectItem>
                <SelectItem value="high">Élevé</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Assignment */}
          <div>
            <Label>Assigner à</Label>
            <Select value={formData.assigned_to_role_id} onValueChange={(v) => setFormData(prev => ({ ...prev, assigned_to_role_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Optionnel..." />
              </SelectTrigger>
              <SelectContent>
                {roles.map(role => (
                  <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                ))}
                <SelectItem value="other">Autre (préciser)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.assigned_to_role_id === 'other' && (
            <div>
              <Label>Préciser "Autre"</Label>
              <Input
                value={formData.assigned_to_other}
                onChange={(e) => setFormData(prev => ({ ...prev, assigned_to_other: e.target.value }))}
                placeholder="Nom du service ou personne"
                maxLength={100}
              />
            </div>
          )}

          {/* Description */}
          <div>
            <Label htmlFor="description">Description détaillée</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Décrivez le problème en détail..."
              rows={4}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground mt-1">{formData.description.length}/2000</p>
          </div>

          {/* Images */}
          <div>
            <Label>Photos (max 5, 10MB chacune)</Label>
            <div className="mt-2">
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                multiple
                onChange={handleImageSelect}
                disabled={images.length >= 5}
              />
            </div>
            {images.length > 0 && (
              <div className="grid grid-cols-5 gap-2 mt-3">
                {images.map((img, idx) => (
                  <div key={idx} className="relative">
                    <img
                      src={URL.createObjectURL(img)}
                      alt={`Preview ${idx}`}
                      className="w-full h-20 object-cover rounded"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1 h-6 w-6 p-0"
                      onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Envoi..." : "Signaler l'incident"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};