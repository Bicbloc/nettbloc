import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Calendar, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { HotelSessionService } from '@/services/hotelSessionService';
import { SessionPersistenceService } from '@/services/sessionPersistenceService';
import { supabase } from '@/integrations/supabase/client';

interface DailyReportCloseButtonProps {
  hotelId: string;
  onReportClosed?: () => void;
}

export function DailyReportCloseButton({ hotelId, onReportClosed }: DailyReportCloseButtonProps) {
  const [isClosing, setIsClosing] = useState(false);

  const handleCloseDay = async () => {
    setIsClosing(true);

    try {
      console.log('🔚 Début de clôture de la journée pour hotel:', hotelId);

      // 1. Récupérer la session actuelle
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

      // 2. Archiver le rapport de la journée
      console.log('📦 Archivage du rapport en cours...');
      const archived = await SessionPersistenceService.archiveOldReport(currentToken, hotelId);

      if (!archived) {
        toast.error("Impossible d'archiver le rapport");
        setIsClosing(false);
        return;
      }

      // 3. Désactiver la session actuelle
      console.log('🔒 Désactivation de la session actuelle...');
      await HotelSessionService.deactivateSession(currentToken);

      // 4. Supprimer les assignations en cours
      console.log('🗑️ Suppression des assignations en cours...');
      const { error: deleteError } = await supabase
        .from('assignments')
        .delete()
        .eq('hotel_id', hotelId)
        .in('status', ['assigned', 'in_progress']);

      if (deleteError) {
        console.warn('⚠️ Erreur lors de la suppression des assignations:', deleteError);
      }

      // 5. Réinitialiser les chambres à "dirty"
      console.log('🔄 Réinitialisation des chambres...');
      const { error: updateError } = await supabase
        .from('rooms')
        .update({ status: 'dirty' })
        .eq('hotel_id', hotelId)
        .neq('status', 'out_of_order');

      if (updateError) {
        console.warn('⚠️ Erreur lors de la réinitialisation des chambres:', updateError);
      }

      // 6. Nettoyer le stockage local
      SessionPersistenceService.clearSavedSession();
      localStorage.removeItem('sessionToken');
      localStorage.removeItem('hotelSessionToken');
      localStorage.removeItem('is_distributed');
      localStorage.removeItem('housekeeper_assignments');

      // 7. Créer une nouvelle session pour le lendemain
      console.log('🆕 Création de la nouvelle session...');
      const newToken = await HotelSessionService.createSession(hotelId);

      if (!newToken) {
        toast.error('Impossible de créer la nouvelle session');
        setIsClosing(false);
        return;
      }

      // 8. Sauvegarder la nouvelle session
      SessionPersistenceService.saveSessionData({
        sessionToken: newToken,
        hotelId: hotelId,
        lastActiveDate: new Date().toISOString()
      });

      toast.success('Journée clôturée ! Assignations réinitialisées, nouvelle session créée.');
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
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={isClosing}>
          {isClosing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Clôture en cours...
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
              <li>Archiver le rapport de la journée actuelle</li>
              <li>Supprimer toutes les assignations en cours</li>
              <li>Réinitialiser toutes les chambres à "À nettoyer"</li>
              <li>Créer une nouvelle session vierge pour demain</li>
              <li>Réinitialiser l'état de distribution</li>
            </ul>
            <p className="mt-4 font-semibold">Cette action est irréversible.</p>
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
