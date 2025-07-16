import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { X, FileText } from "lucide-react";

interface PdfProgressDialogProps {
  isOpen: boolean;
  progress: number;
  status: string;
  onCancel: () => void;
}

export const PdfProgressDialog = ({ isOpen, progress, status, onCancel }: PdfProgressDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Analyse du rapport PDF
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 mb-2">
              {progress}%
            </div>
            <p className="text-sm text-muted-foreground">
              {status}
            </p>
          </div>
          
          <Progress value={progress} className="w-full" />
          
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className={progress >= 10 ? "text-green-600" : ""}>
              ✓ Lecture du fichier PDF
            </div>
            <div className={progress >= 30 ? "text-green-600" : ""}>
              {progress >= 30 ? "✓" : "○"} Chargement du document
            </div>
            <div className={progress >= 50 ? "text-green-600" : ""}>
              {progress >= 50 ? "✓" : "○"} Extraction du texte
            </div>
            <div className={progress >= 85 ? "text-green-600" : ""}>
              {progress >= 85 ? "✓" : "○"} Analyse des données
            </div>
            <div className={progress >= 100 ? "text-green-600" : ""}>
              {progress >= 100 ? "✓" : "○"} Finalisation
            </div>
          </div>
        </div>

        {progress < 100 && (
          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={onCancel} size="sm">
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};