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
      
      // Obtenir le diagnostic avant reset
      const beforeDiagnostic = LocalStorageManager.getDiagnosticReport();
      console.log('📊 État avant reset:', beforeDiagnostic);
      
      // Appeler le reset depuis useAutoSetup pour coordination complète
      forceCompleteReset();
      
      // Vérifier le nettoyage
      const afterDiagnostic = LocalStorageManager.getDiagnosticReport();
      console.log('📊 État après reset:', afterDiagnostic);
      
      setIsComplete(true);
      
      toast({
        title: "✅ Reset terminé",
        description: "Application réinitialisée. Rechargement automatique...",
        duration: 2000
      });
      
      // Notification au parent
      onResetComplete?.();
      
      // Recharger après un délai
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      console.error('❌ Erreur pendant le reset:', error);
      toast({
        variant: "destructive",
        title: "Erreur de reset",
        description: "Impossible de réinitialiser complètement. Rechargez manuellement la page.",
        duration: 5000
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