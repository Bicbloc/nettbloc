import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RotateCcw, AlertTriangle, CheckCircle } from 'lucide-react';
import { LocalStorageManager } from '@/utils/localStorageManager';
import { useAutoSetup } from '@/hooks/use-auto-setup';
import { toast } from '@/hooks/use-toast';

interface FullResetButtonProps {
  onResetComplete?: () => void;
}

export const FullResetButton: React.FC<FullResetButtonProps> = ({ onResetComplete }) => {
  const [isResetting, setIsResetting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const { forceCompleteReset } = useAutoSetup();

  const handleReset = async () => {
    setIsResetting(true);
    setShowConfirmation(false);
    
    try {
      console.log('🔄 Début reset complet application...');
      
      // Phase 1: Diagnostic et sauvegarde état initial
      const beforeDiagnostic = LocalStorageManager.getDiagnosticReport();
      console.log('📊 État avant reset:', beforeDiagnostic);
      
      // Phase 2: Reset indépendant et robuste
      try {
        console.log('🧹 Nettoyage localStorage...');
        // Reset complet du localStorage
        LocalStorageManager.resetHotelData();
        LocalStorageManager.cleanCorruptedValues();
        
        // Nettoyer toutes les données liées à l'application
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (
            key.startsWith('hotel') || 
            key.startsWith('housekeeper') || 
            key.startsWith('user') ||
            key.startsWith('session') ||
            key.startsWith('auth') ||
            key.startsWith('supabase')
          )) {
            keysToRemove.push(key);
          }
        }
        
        keysToRemove.forEach(key => {
          try {
            localStorage.removeItem(key);
            console.log(`🗑️ Supprimé: ${key}`);
          } catch (err) {
            console.warn(`⚠️ Impossible de supprimer ${key}:`, err);
          }
        });
        
        console.log('✅ Nettoyage localStorage terminé');
      } catch (localStorageError) {
        console.error('❌ Erreur nettoyage localStorage:', localStorageError);
        // Continuer même en cas d'erreur localStorage
      }
      
      // Phase 3: Nettoyage session et cache
      try {
        console.log('🧹 Nettoyage sessionStorage...');
        sessionStorage.clear();
        console.log('✅ SessionStorage vidé');
      } catch (sessionError) {
        console.warn('⚠️ Erreur sessionStorage:', sessionError);
      }
      
      // Phase 4: Tentative de reset useAutoSetup si disponible
      try {
        if (forceCompleteReset && typeof forceCompleteReset === 'function') {
          console.log('🔄 Appel forceCompleteReset...');
          forceCompleteReset();
          console.log('✅ forceCompleteReset appelé');
        }
      } catch (autoSetupError) {
        console.warn('⚠️ Erreur forceCompleteReset (continuant sans):', autoSetupError);
        // Ne pas échouer si useAutoSetup a des problèmes
      }
      
      // Phase 5: Événements de reset global
      try {
        console.log('📡 Déclenchement événements reset...');
        window.dispatchEvent(new Event('hotel-disconnected'));
        window.dispatchEvent(new Event('app-reset'));
        window.dispatchEvent(new Event('storage'));
        console.log('✅ Événements déclenchés');
      } catch (eventError) {
        console.warn('⚠️ Erreur événements:', eventError);
      }
      
      // Phase 6: Diagnostic final
      const afterDiagnostic = LocalStorageManager.getDiagnosticReport();
      console.log('📊 État après reset:', afterDiagnostic);
      
      setIsComplete(true);
      
      toast({
        title: "✅ Reset terminé",
        description: "Application réinitialisée. Rechargement dans 3 secondes...",
        duration: 3000
      });
      
      // Notification au parent
      onResetComplete?.();
      
      // Recharger après un délai
      setTimeout(() => {
        console.log('🔄 Rechargement de la page...');
        window.location.reload();
      }, 3000);
      
    } catch (error) {
      console.error('❌ Erreur critique pendant le reset:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      
      toast({
        variant: "destructive",
        title: "Erreur de reset",
        description: `Détails: ${errorMessage}. Rechargez manuellement la page.`,
        duration: 8000
      });
    } finally {
      setIsResetting(false);
    }
  };

  if (isComplete) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <span>Reset terminé ! Rechargement en cours...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (showConfirmation) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-800 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Confirmation requise
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Cette action va :</strong>
              <ul className="list-disc list-inside mt-2">
                <li>Effacer toutes les données en cache</li>
                <li>Supprimer tous les paramètres locaux</li>
                <li>Redémarrer la connexion à votre hôtel</li>
                <li>Recharger complètement l'application</li>
              </ul>
            </AlertDescription>
          </Alert>
          
          <div className="flex gap-2">
            <Button 
              variant="destructive" 
              onClick={handleReset}
              disabled={isResetting}
              className="flex-1"
            >
              {isResetting ? (
                <>
                  <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
                  Reset en cours...
                </>
              ) : (
                'Confirmer le reset'
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmation(false)}
              disabled={isResetting}
              className="flex-1"
            >
              Annuler
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardHeader>
        <CardTitle className="text-yellow-800">Reset complet</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-yellow-700">
          Si les problèmes persistent, vous pouvez effectuer un reset complet 
          de l'application qui supprimera toutes les données en cache.
        </p>
        
        <Button 
          variant="outline"
          onClick={() => setShowConfirmation(true)}
          className="w-full border-yellow-300 hover:bg-yellow-100"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset complet de l'application
        </Button>
      </CardContent>
    </Card>
  );
};