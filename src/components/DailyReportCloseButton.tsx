import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Calendar, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { HotelSessionService } from '@/services/hotelSessionService';
import { storageService } from '@/services/storageService';
import { ActionLogService } from '@/services/actionLogService';
import { RoomArchiveService } from '@/services/roomArchiveService';
import { generateAndUploadDailyReportPdf } from '@/services/dailyReportPdfService';
import { supabase } from '@/integrations/supabase/client';
import { createNotification } from '@/services/notificationService';

interface DailyReportCloseButtonProps {
  hotelId: string;
  onReportClosed?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export function DailyReportCloseButton({ hotelId, onReportClosed, open: controlledOpen, onOpenChange, hideTrigger }: DailyReportCloseButtonProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    onOpenChange?.(v);
  };
  const [isClosing, setIsClosing] = useState(false);
  const [closingStep, setClosingStep] = useState('');

  const handleCloseDay = async () => {
    setIsClosing(true);
    const today = new Date().toISOString().split('T')[0];

    try {

      // 0. Récupérer les données AVANT archivage pour le PDF
      setClosingStep('Préparation des données...');
      
      const { data: currentRooms } = await supabase
        .from('rooms')
        .select('*')
        .eq('hotel_id', hotelId);
      
      const { data: currentAssignments } = await supabase
        .from('assignments')
        .select('*')
        .eq('hotel_id', hotelId);
      
      const { data: todayLogs } = await supabase
        .from('daily_action_logs')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('log_date', today);

      const { data: hotelData } = await supabase
        .from('hotels')
        .select('name')
        .eq('id', hotelId)
        .single();

      // 1. Générer et uploader le PDF de clôture
      setClosingStep('Génération du rapport PDF...');
      
      let pdfUrl: string | null = null;
      try {
        pdfUrl = await generateAndUploadDailyReportPdf(
          hotelId,
          today,
          currentRooms || [],
          currentAssignments || [],
          todayLogs || [],
          hotelData?.name
        );
        if (pdfUrl) {
        }
      } catch (pdfError) {
      }

      // 2. Vérifier la session actuelle (optionnel - on continue même sans)
      setClosingStep('Vérification de la session...');
      const currentToken = HotelSessionService.getSessionToken();
      
      // 3. Archiver le journal d'actions du jour en premier
      setClosingStep('Archivage du journal d\'actions...');
      try {
        const logsArchived = await ActionLogService.archiveDailyLogs(hotelId);
        if (logsArchived) {
        }
      } catch (logError) {
      }

      // 4. Archiver chambres, assignations, inventaire linge et notifications
      setClosingStep('Archivage des chambres et inventaire...');
      const archiveResult = await RoomArchiveService.archiveAndResetRooms(hotelId);

      // Marquer la journée comme clôturée pour éviter un double-archivage par la clôture automatique
      try {
        await supabase
          .from('hotels')
          .update({ last_auto_close_date: today })
          .eq('id', hotelId);
      } catch (markError) {
        console.error('Impossible de marquer la date de clôture:', markError);
      }

      // 5. Mettre à jour le rapport daily_reports avec l'URL du PDF
      if (pdfUrl) {
        await supabase
          .from('daily_reports')
          .update({ pdf_url: pdfUrl })
          .eq('hotel_id', hotelId)
          .eq('report_date', today);

        // Notifier l'établissement qu'un rapport est prêt à imprimer
        await createNotification({
          hotelId,
          title: "🖨️ Rapport disponible",
          description: `Le rapport du ${new Date(today).toLocaleDateString('fr-FR')} est prêt à être consulté et imprimé.`,
          type: "report",
        });
      }

      // 6. Désactiver la session actuelle si elle existe
      if (currentToken) {
        setClosingStep('Fermeture de la session...');
        try {
          await HotelSessionService.deactivateSession(currentToken);
        } catch (sessionError) {
        }
      }

      // 4. Désactiver la session actuelle si elle existe
      if (currentToken) {
        setClosingStep('Fermeture de la session...');
        try {
          await HotelSessionService.deactivateSession(currentToken);
        } catch (sessionError) {
        }
      }

      // 5. Nettoyer le stockage local
      setClosingStep('Nettoyage du stockage local...');
      storageService.clearHotel();
      localStorage.removeItem('sessionToken');
      localStorage.removeItem('hotelSessionToken');
      localStorage.removeItem(`assignments_${hotelId}`);
      localStorage.removeItem(`housekeepers_${hotelId}`);

      // 6. Créer une nouvelle session pour le lendemain
      setClosingStep('Création de la nouvelle session...');
      let newToken: string | null = null;
      try {
        newToken = await HotelSessionService.createSession(hotelId);
      } catch (newSessionError) {
      }

      // 7. Sauvegarder la nouvelle session
      if (newToken) {
        storageService.saveHotel({
          id: hotelId,
          name: '',
          code: ''
        });
      }

      // 8. Message de succès avec détails
      const successParts = [
        `${archiveResult.archived} chambre(s)`,
        `${archiveResult.assignmentsCleared} assignation(s)`,
        `${archiveResult.linenTasksArchived} inventaire(s) linge`
      ];
      toast.success(`Journée clôturée ! Archivés: ${successParts.join(', ')}`);

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
      toast.error(`Erreur lors de la clôture: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
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
          <AlertDialogDescription asChild>
            <div>
              <p className="mb-3">Cette action va archiver toutes les données du jour :</p>
              <ul className="list-none space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span>Rapport des femmes de chambre (assignations et statuts)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span>Journal des actions (nettoyages, remarques, incidents)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span>Inventaire linge (comptages et photos)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span>Notifications et commentaires du jour</span>
                </li>
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">
                Ensuite, les chambres et assignations seront réinitialisées pour le lendemain.
              </p>
              <p className="mt-3 font-semibold text-destructive">
                ⚠️ Cette action est irréversible. Les données archivées seront accessibles dans les rapports.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={handleCloseDay} className="bg-destructive hover:bg-destructive/90">
            Confirmer la clôture
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
