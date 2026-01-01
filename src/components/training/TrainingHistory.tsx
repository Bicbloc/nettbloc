import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  History, Trash2, Edit, Brain, Calendar, 
  FileText, CheckCircle, RefreshCw, Building2
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// User-friendly PMS options
const pmsOptions = [
  { value: 'mews', label: 'Mews', description: 'Interface moderne' },
  { value: 'opera', label: 'Opera', description: 'Oracle Hospitality' },
  { value: 'protel', label: 'Protel', description: 'Format classique' },
  { value: 'fidelio', label: 'Fidelio', description: 'Suite Oracle' },
  { value: 'apaleo', label: 'Apaleo', description: 'Solution cloud' },
  { value: 'medialog', label: 'Medialog', description: 'PMS français' },
  { value: 'generic', label: 'Autre', description: 'Format générique' },
];

interface TrainingPattern {
  id: string;
  report_name: string;
  pms_type: string;
  validated: boolean;
  created_at: string;
  updated_at: string;
  extracted_data: any;
}

interface TrainingHistoryProps {
  hotelId: string;
  onEdit?: (pattern: TrainingPattern) => void;
  onDeleted?: () => void;
}

export const TrainingHistory = ({ hotelId, onEdit, onDeleted }: TrainingHistoryProps) => {
  const { toast } = useToast();
  const [patterns, setPatterns] = useState<TrainingPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletePattern, setDeletePattern] = useState<TrainingPattern | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editPmsPattern, setEditPmsPattern] = useState<TrainingPattern | null>(null);
  const [savingPms, setSavingPms] = useState(false);

  const loadPatterns = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("report_training_patterns")
        .select("id, report_name, pms_type, validated, created_at, updated_at, extracted_data")
        .eq("hotel_id", hotelId)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setPatterns(data || []);
    } catch (error) {
      console.error("Erreur chargement historique:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatterns();
  }, [hotelId]);

  const handleDelete = async () => {
    if (!deletePattern) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("report_training_patterns")
        .delete()
        .eq("id", deletePattern.id);

      if (error) throw error;

      toast({
        title: "Entraînement supprimé",
        description: `Le modèle ${deletePattern.pms_type.toUpperCase()} a été supprimé`,
      });

      setPatterns(prev => prev.filter(p => p.id !== deletePattern.id));
      onDeleted?.();
    } catch (error) {
      console.error("Erreur suppression:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'entraînement",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeletePattern(null);
    }
  };

  const handleChangePms = async (newPmsType: string) => {
    if (!editPmsPattern) return;
    
    setSavingPms(true);
    try {
      const { error } = await supabase
        .from("report_training_patterns")
        .update({ pms_type: newPmsType, updated_at: new Date().toISOString() })
        .eq("id", editPmsPattern.id);

      if (error) throw error;

      toast({
        title: "Type de rapport modifié",
        description: `Le modèle utilise maintenant le format ${newPmsType.toUpperCase()}`,
      });

      setPatterns(prev => prev.map(p => 
        p.id === editPmsPattern.id ? { ...p, pms_type: newPmsType } : p
      ));
    } catch (error) {
      console.error("Erreur modification PMS:", error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier le type de rapport",
        variant: "destructive",
      });
    } finally {
      setSavingPms(false);
      setEditPmsPattern(null);
    }
  };

  const getRoomCount = (pattern: TrainingPattern): number => {
    const data = pattern.extracted_data;
    if (Array.isArray(data)) return data.length;
    if (data?.rooms) return data.rooms.length;
    return 0;
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Chargement de l'historique...</span>
        </div>
      </Card>
    );
  }

  if (patterns.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <History className="w-5 h-5" />
          <span>Aucun entraînement sauvegardé</span>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <History className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Historique des entraînements</h3>
          <Badge variant="secondary">{patterns.length}</Badge>
        </div>

        <div className="space-y-3">
          {patterns.map((pattern) => (
            <div
              key={pattern.id}
              className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Brain className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditPmsPattern(pattern)}
                      className="font-medium hover:text-primary transition-colors flex items-center gap-1"
                      title="Cliquez pour modifier le type"
                    >
                      {pattern.pms_type.toUpperCase()}
                      <Edit className="w-3 h-3 opacity-50" />
                    </button>
                    {pattern.validated && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {pattern.report_name}
                    </span>
                    <span>•</span>
                    <span>{getRoomCount(pattern)} chambres</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(pattern.updated_at), "d MMM yyyy", { locale: fr })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(pattern)}
                    className="gap-1"
                  >
                    <Edit className="w-4 h-4" />
                    Modifier
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeletePattern(pattern)}
                  className="gap-1 text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletePattern} onOpenChange={() => setDeletePattern(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet entraînement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera définitivement le modèle entraîné pour{" "}
              <strong>{deletePattern?.pms_type.toUpperCase()}</strong>.
              <br /><br />
              L'IA ne pourra plus utiliser ces patterns pour la détection automatique.
              Vous pourrez réentraîner le système avec un nouveau rapport.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PMS Type Edit Dialog */}
      <Dialog open={!!editPmsPattern} onOpenChange={() => setEditPmsPattern(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le type de rapport</DialogTitle>
            <DialogDescription>
              Sélectionnez le bon format pour ce modèle d'entraînement
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            {pmsOptions.map((pms) => (
              <button
                key={pms.value}
                onClick={() => handleChangePms(pms.value)}
                disabled={savingPms}
                className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all hover:border-primary hover:bg-primary/5 disabled:opacity-50 ${
                  editPmsPattern?.pms_type === pms.value 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border'
                }`}
              >
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{pms.label}</span>
                    {editPmsPattern?.pms_type === pms.value && (
                      <Badge variant="secondary" className="text-xs">Actuel</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{pms.description}</p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Hook to check if a PMS type is already trained
export const useExistingTraining = (hotelId: string, pmsType: string | null) => {
  const [existingPattern, setExistingPattern] = useState<TrainingPattern | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pmsType || !hotelId) {
      setExistingPattern(null);
      return;
    }

    const checkExisting = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("report_training_patterns")
          .select("id, report_name, pms_type, validated, created_at, updated_at, extracted_data")
          .eq("hotel_id", hotelId)
          .eq("pms_type", pmsType)
          .eq("validated", true)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          setExistingPattern(data);
        } else {
          setExistingPattern(null);
        }
      } catch (error) {
        console.error("Erreur vérification PMS existant:", error);
        setExistingPattern(null);
      } finally {
        setLoading(false);
      }
    };

    checkExisting();
  }, [hotelId, pmsType]);

  return { existingPattern, loading };
};
