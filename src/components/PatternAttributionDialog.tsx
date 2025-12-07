import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Globe, Building2, Trash2, Sparkles, CheckCircle, FileText, Monitor } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Hotel {
  id: string;
  name: string;
}

interface PatternAttributionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotelId: string;
  patternId?: string;
  extractedRoomsCount: number;
  averageConfidence: number;
  reportName: string;
  rawText?: string;
  onSave: () => void;
}

type AttributionType = 'client' | 'default' | 'discard';

const PMS_TYPES = [
  { value: 'mews', label: 'Mews', keywords: ['Nuit', 'Night', 'INS', 'SAL', 'DIR', 'DEP'] },
  { value: 'opera', label: 'Opera', keywords: ['Opera', 'PMS Opera', 'OPERA'] },
  { value: 'cloudbeds', label: 'Cloudbeds', keywords: ['Cloudbeds', 'Cloud Beds'] },
  { value: 'booking', label: 'Booking.com', keywords: ['Booking', 'booking.com'] },
  { value: 'protel', label: 'Protel', keywords: ['Protel', 'protel'] },
  { value: 'custom', label: 'Autre / Personnalisé', keywords: [] }
];

/**
 * Détecte le type de PMS en analysant le texte du rapport
 */
function detectPmsType(text: string): string {
  if (!text) return 'custom';
  
  const normalizedText = text.toLowerCase();
  
  // Mews - patterns spécifiques
  if (/nuit\s+\d+\/\d+/i.test(text) || /night\s+\d+\/\d+/i.test(text)) {
    return 'mews';
  }
  if (/\b(INS|SAL|DIR)\b/.test(text) && /\d+\s*[×x]\s*Adultes/i.test(text)) {
    return 'mews';
  }
  
  // Opera
  if (normalizedText.includes('opera') || normalizedText.includes('pms opera')) {
    return 'opera';
  }
  
  // Cloudbeds
  if (normalizedText.includes('cloudbeds') || normalizedText.includes('cloud beds')) {
    return 'cloudbeds';
  }
  
  // Booking
  if (normalizedText.includes('booking.com') || normalizedText.includes('booking')) {
    return 'booking';
  }
  
  // Protel
  if (normalizedText.includes('protel')) {
    return 'protel';
  }
  
  return 'custom';
}

export function PatternAttributionDialog({
  open,
  onOpenChange,
  hotelId,
  patternId,
  extractedRoomsCount,
  averageConfidence,
  reportName,
  rawText,
  onSave
}: PatternAttributionDialogProps) {
  const [attributionType, setAttributionType] = useState<AttributionType>('client');
  const [patternName, setPatternName] = useState(reportName || 'Pattern');
  const [attributionReason, setAttributionReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [pmsType, setPmsType] = useState<string>('mews');
  const [selectedHotelId, setSelectedHotelId] = useState<string>(hotelId);
  const [availableHotels, setAvailableHotels] = useState<Hotel[]>([]);
  const [isLoadingHotels, setIsLoadingHotels] = useState(false);

  // Charger les hôtels disponibles et détecter le PMS
  useEffect(() => {
    if (open) {
      loadAvailableHotels();
      
      // Détecter le type de PMS
      const detectedPms = detectPmsType(rawText || '');
      setPmsType(detectedPms);
      
      // Pré-remplir le nom du pattern
      const pmsLabel = PMS_TYPES.find(p => p.value === detectedPms)?.label || 'Personnalisé';
      setPatternName(`Format ${pmsLabel} - ${reportName || 'Rapport'}`);
      
      // Réinitialiser l'hôtel sélectionné
      setSelectedHotelId(hotelId);
    }
  }, [open, rawText, reportName, hotelId]);

  const loadAvailableHotels = async () => {
    setIsLoadingHotels(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: hotels, error } = await supabase
        .from('hotels')
        .select('id, name')
        .eq('user_id', userData.user.id)
        .order('name');

      if (error) {
        console.error('Erreur chargement hôtels:', error);
        return;
      }

      setAvailableHotels(hotels || []);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setIsLoadingHotels(false);
    }
  };

  const handleSave = async () => {
    if (attributionType === 'discard') {
      if (patternId) {
        await supabase.from('report_training_patterns').delete().eq('id', patternId);
      }
      toast.info("Pattern non sauvegardé");
      onOpenChange(false);
      return;
    }

    setIsSaving(true);

    try {
      const updateData: Record<string, unknown> = {
        pattern_name: patternName,
        attribution_reason: attributionReason,
        pms_type: pmsType,
        is_default: attributionType === 'default',
        assigned_to_hotel_id: attributionType === 'client' ? selectedHotelId : null
      };

      if (patternId) {
        const { error } = await supabase
          .from('report_training_patterns')
          .update(updateData)
          .eq('id', patternId);

        if (error) throw error;
      }

      const targetHotel = availableHotels.find(h => h.id === selectedHotelId);
      
      toast.success(
        attributionType === 'default' 
          ? `Pattern "${patternName}" sauvegardé comme modèle par défaut pour ${PMS_TYPES.find(p => p.value === pmsType)?.label}`
          : `Pattern "${patternName}" attribué à ${targetHotel?.name || 'cet établissement'}`
      );
      
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Erreur attribution:', error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  const currentHotel = availableHotels.find(h => h.id === selectedHotelId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Valider et attribuer ce pattern
          </DialogTitle>
          <DialogDescription>
            Configurez le type de PMS et choisissez où utiliser ce pattern
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Statistiques */}
          <div className="flex gap-4 justify-center">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-primary">{extractedRoomsCount}</p>
              <p className="text-xs text-muted-foreground">chambres</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{Math.round(averageConfidence * 100)}%</p>
              <p className="text-xs text-muted-foreground">confiance</p>
            </div>
          </div>

          {/* Type de PMS */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              Type de PMS
            </Label>
            <Select value={pmsType} onValueChange={setPmsType}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner le type de PMS" />
              </SelectTrigger>
              <SelectContent>
                {PMS_TYPES.map(pms => (
                  <SelectItem key={pms.value} value={pms.value}>
                    {pms.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Détecté automatiquement : {PMS_TYPES.find(p => p.value === pmsType)?.label}
            </p>
          </div>

          {/* Nom du pattern */}
          <div className="space-y-2">
            <Label htmlFor="patternName" className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Nom du pattern
            </Label>
            <Input
              id="patternName"
              value={patternName}
              onChange={(e) => setPatternName(e.target.value)}
              placeholder="Ex: Format Mews Standard"
            />
          </div>

          {/* Type d'attribution */}
          <div className="space-y-3">
            <Label>Attribution</Label>
            <RadioGroup value={attributionType} onValueChange={(v) => setAttributionType(v as AttributionType)}>
              {/* Option: Ce client uniquement */}
              <div className={`flex items-start space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                attributionType === 'client' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`} onClick={() => setAttributionType('client')}>
                <RadioGroupItem value="client" id="client" className="mt-1" />
                <Label htmlFor="client" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="font-medium">Cet établissement uniquement</span>
                  </div>
                  
                  {attributionType === 'client' && (
                    <div className="mt-3">
                      <Select value={selectedHotelId} onValueChange={setSelectedHotelId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Sélectionner un établissement" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableHotels.map(hotel => (
                            <SelectItem key={hotel.id} value={hotel.id}>
                              {hotel.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {currentHotel && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Pattern disponible uniquement pour "{currentHotel.name}"
                        </p>
                      )}
                    </div>
                  )}
                </Label>
              </div>

              {/* Option: Par défaut pour ce PMS */}
              <div className={`flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                attributionType === 'default' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`} onClick={() => setAttributionType('default')}>
                <RadioGroupItem value="default" id="default" />
                <Label htmlFor="default" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">Par défaut pour ce PMS</span>
                    <Badge variant="secondary" className="text-xs">Recommandé</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Disponible pour tous les utilisateurs de {PMS_TYPES.find(p => p.value === pmsType)?.label}
                  </p>
                </Label>
              </div>

              {/* Option: Ne pas sauvegarder */}
              <div className={`flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                attributionType === 'discard' ? 'border-destructive bg-destructive/5' : 'border-border hover:border-destructive/50'
              }`} onClick={() => setAttributionType('discard')}>
                <RadioGroupItem value="discard" id="discard" />
                <Label htmlFor="discard" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4 text-destructive" />
                    <span className="font-medium">Ne pas sauvegarder</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Utiliser une seule fois sans mémoriser
                  </p>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Notes (optionnel) */}
          {attributionType !== 'discard' && (
            <div className="space-y-2">
              <Label htmlFor="reason">Notes (optionnel)</Label>
              <Textarea
                id="reason"
                value={attributionReason}
                onChange={(e) => setAttributionReason(e.target.value)}
                placeholder="Ex: Format spécifique au rapport journalier..."
                rows={2}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              "Enregistrement..."
            ) : attributionType === 'discard' ? (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Ignorer
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Valider
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
