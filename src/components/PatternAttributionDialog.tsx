import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Save, Globe, User, Trash2, Sparkles, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PatternAttributionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotelId: string;
  patternId?: string;
  extractedRoomsCount: number;
  averageConfidence: number;
  reportName: string;
  onSave: () => void;
}

type AttributionType = 'client' | 'default' | 'discard';

export function PatternAttributionDialog({
  open,
  onOpenChange,
  hotelId,
  patternId,
  extractedRoomsCount,
  averageConfidence,
  reportName,
  onSave
}: PatternAttributionDialogProps) {
  const [attributionType, setAttributionType] = useState<AttributionType>('client');
  const [patternName, setPatternName] = useState(reportName || 'Pattern Mews');
  const [attributionReason, setAttributionReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
        is_default: attributionType === 'default',
        assigned_to_hotel_id: attributionType === 'client' ? hotelId : null
      };

      if (patternId) {
        const { error } = await supabase
          .from('report_training_patterns')
          .update(updateData)
          .eq('id', patternId);

        if (error) throw error;
      }

      toast.success(
        attributionType === 'default' 
          ? "Pattern sauvegardé comme modèle par défaut"
          : "Pattern attribué à cet établissement"
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Attribuer ce pattern
          </DialogTitle>
          <DialogDescription>
            Choisissez comment utiliser ce pattern appris
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
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

          {/* Nom du pattern */}
          <div className="space-y-2">
            <Label htmlFor="patternName">Nom du pattern</Label>
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
              <div className={`flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                attributionType === 'client' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`} onClick={() => setAttributionType('client')}>
                <RadioGroupItem value="client" id="client" />
                <Label htmlFor="client" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    <span className="font-medium">Ce client uniquement</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pattern utilisé seulement pour cet établissement
                  </p>
                </Label>
              </div>

              <div className={`flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                attributionType === 'default' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`} onClick={() => setAttributionType('default')}>
                <RadioGroupItem value="default" id="default" />
                <Label htmlFor="default" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">Pattern par défaut</span>
                    <Badge variant="secondary" className="text-xs">Recommandé</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Disponible pour tous les établissements
                  </p>
                </Label>
              </div>

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

          {/* Raison (optionnel) */}
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
                Enregistrer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
