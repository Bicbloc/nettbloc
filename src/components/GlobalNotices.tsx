import React from 'react';
import { useProfileLanguageSync } from '@/hooks/useProfileLanguageSync';
import { AdminBannersStack } from '@/components/AdminBannersStack';

/**
 * Composant à monter une seule fois dans App pour :
 * - synchroniser la langue avec le profil utilisateur
 * - afficher la pile de bannières admin actives
 */
const GlobalNotices: React.FC = () => {
  useProfileLanguageSync();
  return <AdminBannersStack />;
};

export default GlobalNotices;
