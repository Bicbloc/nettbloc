import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Ban, Upload, Camera, X } from 'lucide-react';
import { Room } from '@/services/pdfService';
import { toast } from '@/hooks/use-toast';

interface DNDDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room;
  onUpdateRoom: (room: Room) => void;
  onNotifyAdmin?: (message: string, imageUrl?: string) => void;
}

export function DNDDialog({
  open,
  onOpenChange,
  room,
  onUpdateRoom,
  onNotifyAdmin
}: DNDDialogProps) {
  const [dndReason, setDndReason] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Fichier invalide",
        description: "Veuillez sélectionner une image (JPG, PNG, etc.)"
      });
      return;
    }

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Fichier trop volumineux",
        description: "La taille de l'image ne doit pas dépasser 5MB"
      });
      return;
    }

    setSelectedImage(file);

    // Créer un aperçu
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSetDND = async () => {
    if (!dndReason.trim()) {
      toast({
        variant: "destructive",
        title: "Raison requise",
        description: "Veuillez indiquer la raison du DND"
      });
      return;
    }

    try {
      // Simuler l'upload d'image (à remplacer par un vrai service)
      let imageUrl: string | undefined;
      if (selectedImage) {
        // Ici vous pourriez uploader vers un service comme Supabase Storage
        imageUrl = URL.createObjectURL(selectedImage);
      }

      // Mettre à jour la chambre
      const updatedRoom = {
        ...room,
        status: 'do-not-disturb',
        dndReason: dndReason.trim(),
        dndImageUrl: imageUrl,
        dndSetAt: new Date().toISOString()
      };

      onUpdateRoom(updatedRoom);

      // Notifier l'administration
      if (onNotifyAdmin) {
        const message = `Chambre ${room.number} mise en DND: ${dndReason.trim()}`;
        onNotifyAdmin(message, imageUrl);
      }

      toast({
        title: "DND activé",
        description: `Chambre ${room.number} mise en Do Not Disturb`
      });

      onOpenChange(false);
      
      // Reset form
      setDndReason('');
      setSelectedImage(null);
      setImagePreview(null);
    } catch (error) {
      console.error('Erreur lors de l\'activation du DND:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'activer le DND"
      });
    }
  };

  const handleRemoveDND = () => {
    const updatedRoom = {
      ...room,
      status: 'needs-cleaning',
      dndReason: undefined,
      dndImageUrl: undefined,
      dndSetAt: undefined
    };

    onUpdateRoom(updatedRoom);

    if (onNotifyAdmin) {
      onNotifyAdmin(`DND retiré de la chambre ${room.number}`);
    }

    toast({
      title: "DND retiré",
      description: `Chambre ${room.number} - Do Not Disturb retiré`
    });

    onOpenChange(false);
  };

  const isDNDActive = room.status === 'do-not-disturb';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-red-600" />
            Do Not Disturb - Chambre {room.number}
          </DialogTitle>
        </DialogHeader>
        
        {isDNDActive ? (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="destructive">DND ACTIF</Badge>
                <span className="text-sm text-red-700">
                  Depuis {room.dndSetAt ? new Date(room.dndSetAt).toLocaleString() : 'N/A'}
                </span>
              </div>
              <p className="text-sm text-red-800">
                <strong>Raison :</strong> {room.dndReason || 'Non spécifiée'}
              </p>
              {room.dndImageUrl && (
                <div className="mt-3">
                  <img 
                    src={room.dndImageUrl} 
                    alt="Photo DND"
                    className="max-w-full h-32 object-cover rounded border"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Fermer
              </Button>
              <Button variant="destructive" onClick={handleRemoveDND} className="flex-1">
                Retirer le DND
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <strong>Attention :</strong> Mettre cette chambre en "Do Not Disturb" 
                empêchera le nettoyage et notifiera immédiatement l'administration.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dnd-reason">Raison du DND *</Label>
              <Textarea
                id="dnd-reason"
                placeholder="Ex: Client ne souhaite pas être dérangé, problème technique..."
                value={dndReason}
                onChange={(e) => setDndReason(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label>Photo de la situation (optionnel)</Label>
              
              {!selectedImage ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Camera className="h-8 w-8 text-gray-400" />
                    <p className="text-sm text-gray-600">
                      Ajoutez une photo pour documenter la situation
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Sélectionner une image
                    </Button>
                  </div>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="relative border rounded-lg p-2">
                  <img 
                    src={imagePreview!} 
                    alt="Aperçu"
                    className="w-full h-32 object-cover rounded"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-1 right-1"
                    onClick={handleRemoveImage}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                  <p className="text-xs text-gray-600 mt-1">
                    {selectedImage.name} ({Math.round(selectedImage.size / 1024)}KB)
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Annuler
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleSetDND} 
                className="flex-1"
                disabled={!dndReason.trim()}
              >
                <Ban className="h-4 w-4 mr-2" />
                Activer DND
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}