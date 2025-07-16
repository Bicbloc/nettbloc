import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface GuestModeAlertProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
}

export const GuestModeAlert = ({ isOpen, onClose, feature }: GuestModeAlertProps) => {
  const navigate = useNavigate();

  const handleRegister = () => {
    navigate("/auth");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Fonctionnalité restreinte
          </DialogTitle>
          <DialogDescription>
            Cette fonctionnalité n'est pas disponible en mode invité.
          </DialogDescription>
        </DialogHeader>
        
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            L'accès à <strong>{feature}</strong> nécessite un compte utilisateur.
            En mode invité, vous pouvez uniquement consulter et gérer les chambres.
          </AlertDescription>
        </Alert>

        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            <strong>Avantages d'un compte complet :</strong>
          </p>
          <ul className="space-y-1 text-muted-foreground ml-4">
            <li>• Génération de codes d'accès pour femmes de chambre</li>
            <li>• Gestion complète de l'équipe</li>
            <li>• Configuration avancée des paramètres</li>
            <li>• Rapports et analytiques détaillés</li>
            <li>• Sauvegarde automatique des données</li>
          </ul>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Continuer en mode invité
          </Button>
          <Button onClick={handleRegister} className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Créer un compte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};