import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw } from 'lucide-react';
import { CodeGenerationService } from '@/services/codeGenerationService';

interface ForceCodeGenerationButtonProps {
  onRefresh?: () => void;
}

export const ForceCodeGenerationButton: React.FC<ForceCodeGenerationButtonProps> = ({ onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const forceGenerateAllCodes = async () => {
    setLoading(true);
    
    try {
      
      // D'abord, vérifier et corriger les hotel_codes manquants
      await CodeGenerationService.ensureHotelCodesExist();
      
      const results = await CodeGenerationService.forceGenerateAllMissingCodes();
      
      if (results.errors.length > 0) {
        toast({
          variant: "destructive",
          title: "Génération avec erreurs",
          description: `${results.generated} codes générés, ${results.errors.length} erreurs rencontrées.`
        });
      } else {
        toast({
          title: "Génération forcée terminée",
          description: `${results.generated} code(s) d'accès généré(s) pour toutes les femmes de chambre.`
        });
      }

      if (onRefresh) {
        onRefresh();
      }

    } catch (error) {
      console.error('❌ Erreur génération forcée:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de générer les codes d'accès automatiquement."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={forceGenerateAllCodes}
      disabled={loading}
      className="flex items-center gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Génération en cours...' : 'Forcer génération codes'}
    </Button>
  );
};