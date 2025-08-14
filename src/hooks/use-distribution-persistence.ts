import { useEffect, useState } from 'react';

interface DistributionPersistence {
  isDistributed: boolean;
  restoreDistribution: () => boolean;
  saveDistribution: (distributed: boolean) => void;
  clearDistribution: () => void;
}

export const useDistributionPersistence = (): DistributionPersistence => {
  const [isDistributed, setIsDistributed] = useState<boolean>(false);

  // Charger l'état de distribution au démarrage
  useEffect(() => {
    const savedDistribution = localStorage.getItem('rooms-distributed') === 'true';
    const timestamp = localStorage.getItem('distribution-timestamp');
    
    // Vérifier que la distribution n'est pas trop ancienne (24h max)
    if (savedDistribution && timestamp) {
      const age = Date.now() - parseInt(timestamp);
      const maxAge = 24 * 60 * 60 * 1000; // 24 heures
      
      if (age < maxAge) {
        setIsDistributed(true);
        console.log('✅ Distribution restaurée depuis localStorage');
      } else {
        // Trop ancien, nettoyer
        localStorage.removeItem('rooms-distributed');
        localStorage.removeItem('distribution-timestamp');
        console.log('🧹 Distribution expirée, nettoyage effectué');
      }
    }
  }, []);

  const restoreDistribution = (): boolean => {
    const savedDistribution = localStorage.getItem('rooms-distributed') === 'true';
    if (savedDistribution) {
      setIsDistributed(true);
      return true;
    }
    return false;
  };

  const saveDistribution = (distributed: boolean) => {
    setIsDistributed(distributed);
    
    if (distributed) {
      localStorage.setItem('rooms-distributed', 'true');
      localStorage.setItem('distribution-timestamp', Date.now().toString());
      console.log('💾 État de distribution sauvegardé');
    } else {
      localStorage.removeItem('rooms-distributed');
      localStorage.removeItem('distribution-timestamp');
      console.log('🧹 État de distribution supprimé');
    }
  };

  const clearDistribution = () => {
    setIsDistributed(false);
    localStorage.removeItem('rooms-distributed');
    localStorage.removeItem('distribution-timestamp');
    console.log('🧹 Distribution forcée cleared');
  };

  return {
    isDistributed,
    restoreDistribution,
    saveDistribution,
    clearDistribution
  };
};