import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Calendar, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { HotelSessionService } from '@/services/hotelSessionService';
import { storageService } from '@/services/storageService';
import { ActionLogService } from '@/services/actionLogService';
import { RoomArchiveService } from '@/services/roomArchiveService';

interface DailyReportCloseButtonProps {
  hotelId: string;
  onReportClosed?: () => void;
}

export function DailyReportCloseButton({ hotelId, onReportClosed }: DailyReportCloseButtonProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [closingStep, setClosingStep] = useState('');

  const handleCloseDay = async () => {
    setIsClosing(true);

    try {
      console.log('🔚 Début de clôture de la journée pour hotel:', hotelId);

      // 1. Récupérer la session actuelle
      setClosingStep('Vérification de la session...');
      const currentToken = HotelSessionService.getSessionToken();
      if (!currentToken) {
        toast.error('Aucune session active à clôturer');
        setIsClosing(false);
        return;
      }

      const currentSession = await HotelSessionService.getSession(currentToken);
      if (!currentSession) {
        toast.error('Session introuvable');
        setIsClosing(false);
        return;
      }

      // 2. Archiver le journal d'actions du jour
      setClosingStep('Archivage du journal d\'actions...');
      console.log('📦 Archivage du journal d\'actions...');
      const logsArchived = await ActionLogService.archiveDailyLogs(hotelId);
      if (logsArchived) {
        console.log('✅ Journal d\'actions archivé');
      }

      // 3. Archiver et réinitialiser les chambres
      setClosingStep('Archivage des chambres...');
      console.log('📦 Archivage des chambres...');
      const archiveResult = await RoomArchiveService.archiveAndResetRooms(hotelId);
      console.log('✅ Chambres archivées:', archiveResult);

      // 4. Archiver le rapport de la journée (legacy)
      setClosingStep('Finalisation de l\'archivage...');
      console.log('📦 Archivage du rapport en cours...');

      // 5. Désactiver la session actuelle
      setClosingStep('Fermeture de la session...');
      console.log('🔒 Désactivation de la session actuelle...');
      await HotelSessionService.deactivateSession(currentToken);

      // 6. Nettoyer le stockage local
      storageService.clearHotel();
      localStorage.removeItem('sessionToken');
      localStorage.removeItem('hotelSessionToken');
      
      // Nettoyer les assignations locales
      localStorage.removeItem(`assignments_${hotelId}`);

      // 7. Créer une nouvelle session pour le lendemain
      setClosingStep('Création de la nouvelle session...');
      console.log('🆕 Création de la nouvelle session...');
      const newToken = await HotelSessionService.createSession(hotelId);

      if (!newToken) {
        toast.error('Impossible de créer la nouvelle session');
        setIsClosing(false);
        return;
      }

      // 8. Sauvegarder la nouvelle session
      storageService.saveHotel({
        id: hotelId,
        name: '',
        code: ''
      });

      toast.success(`Journée clôturée ! ${archiveResult.archived} chambres archivées, ${archiveResult.assignmentsCleared} assignations effacées.`);
      console.log('✅ Clôture terminée, nouveau token:', newToken);

      // 9. Notifier le parent pour rafraîchir l'interface
      if (onReportClosed) {
        onReportClosed();
      }

      // 10. Rafraîchir la page pour afficher la nouvelle session
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {
      console.error('❌ Erreur lors de la clôture de journée:', error);
      toast.error('Erreur lors de la clôture');
    } finally {
      setIsClosing(false);
      setClosingStep('');
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={isClosing}>
          {isClosing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {closingStep || 'Clôture en cours...'}
            </>
          ) : (
            <>
              <Calendar className="h-4 w-4" />
              Clôturer la journée
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clôturer la journée ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action va :
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-600" />
                Archiver le journal d'actions du jour
              </li>
              <li className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-600" />
                Archiver les chambres et créer un rapport
              </li>
              <li className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-600" />
                Supprimer toutes les affectations du jour
              </li>
              <li className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-600" />
                Réinitialiser les chambres à "à nettoyer"
              </li>
              <li className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-600" />
                Créer une nouvelle session vierge
              </li>
            </ul>
            <p className="mt-4 font-semibold text-destructive">Cette action est irréversible.</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={handleCloseDay}>
            Confirmer la clôture
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
