import { supabase } from '@/integrations/supabase/client';

export class CodeGenerationService {
  
  /**
   * Nettoie les codes d'accès orphelins et les doublons
   */
  static async cleanupOrphanedCodes(): Promise<number> {
    try {
      console.log('🧹 Nettoyage des codes orphelins...');
      
      // Supprimer les codes d'accès sans femme de chambre associée
      const { data: orphanedCodes, error: orphanedError } = await supabase
        .from('housekeeper_access_codes')
        .delete()
        .is('housekeeper_id', null)
        .select('id');

      if (orphanedError) throw orphanedError;

      // Note: fonction de nettoyage des doublons à implémenter si nécessaire
      console.log('📝 Nettoyage des codes orphelins terminé');

      const cleanedCount = orphanedCodes?.length || 0;
      console.log(`✅ ${cleanedCount} codes orphelins nettoyés`);
      
      return cleanedCount;
    } catch (error) {
      console.error('❌ Erreur nettoyage codes orphelins:', error);
      return 0;
    }
  }

  /**
   * Génère un code d'accès unique pour une femme de chambre
   */
  static async generateUniqueCode(hotelCode: string, housekeeperName: string): Promise<string> {
    const namePart = housekeeperName.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 6);
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const accessCode = `${hotelCode}-${namePart}-${randomSuffix}`;

      // Vérifier l'unicité
      const { data: existing } = await supabase
        .from('housekeeper_access_codes')
        .select('id')
        .eq('access_code', accessCode)
        .eq('is_active', true)
        .single();

      if (!existing) {
        return accessCode;
      }

      attempts++;
    }

    throw new Error(`Impossible de générer un code unique après ${maxAttempts} tentatives`);
  }

  /**
   * Force la génération de codes pour toutes les sessions actives
   */
  static async forceGenerateAllMissingCodes(): Promise<{generated: number, errors: string[]}> {
    const results = { generated: 0, errors: [] as string[] };
    
    try {
      console.log('🔄 Génération forcée de tous les codes manquants...');
      
      // Nettoyer d'abord les codes orphelins
      await this.cleanupOrphanedCodes();

      // Récupérer toutes les sessions actives avec données de femmes de chambre
      const { data: sessions, error: sessionsError } = await supabase
        .from('hotel_sessions')
        .select(`
          id,
          hotel_id,
          housekeeper_names,
          hotels!inner(name, hotel_code)
        `)
        .eq('is_active', true)
        .not('housekeeper_names', 'eq', '[]');

      if (sessionsError) throw sessionsError;

      for (const session of sessions || []) {
        try {
          if (!Array.isArray(session.housekeeper_names) || session.housekeeper_names.length === 0) {
            continue;
          }

          const hotelCode = (session.hotels as any)?.hotel_code || 'HTL';
          
          // Vérifier les femmes de chambre existantes pour cet hôtel
          const { data: existingHousekeepers } = await supabase
            .from('housekeepers')
            .select('name')
            .eq('hotel_id', session.hotel_id)
            .eq('is_active', true);

          const existingNames = existingHousekeepers?.map(h => h.name) || [];
          const newHousekeepers = (session.housekeeper_names as string[]).filter(name => !existingNames.includes(name));

          // Créer les nouvelles femmes de chambre
          for (const name of newHousekeepers) {
            try {
              const accessCode = await this.generateUniqueCode(hotelCode, name);

              // Créer la femme de chambre
              const { data: housekeeper, error: housekeeperError } = await supabase
                .from('housekeepers')
                .insert({
                  hotel_id: session.hotel_id as string,
                  name: name,
                  access_code: accessCode
                })
                .select('id')
                .single();

              if (housekeeperError) throw housekeeperError;

              // Créer le code d'accès
              const { error: codeError } = await supabase
                .from('housekeeper_access_codes')
                .insert({
                  hotel_id: session.hotel_id as string,
                  housekeeper_id: housekeeper.id,
                  access_code: accessCode,
                  created_by: null
                });

              if (codeError) throw codeError;

              results.generated++;
              console.log(`✅ Code généré: ${name} -> ${accessCode}`);
              
            } catch (error) {
              const errorMsg = `Erreur pour ${name}: ${error.message}`;
              results.errors.push(errorMsg);
              console.error('❌', errorMsg);
            }
          }
          
        } catch (error) {
          const errorMsg = `Erreur session ${session.id}: ${error.message}`;
          results.errors.push(errorMsg);
          console.error('❌', errorMsg);
        }
      }

      console.log(`✅ Génération forcée terminée: ${results.generated} codes générés, ${results.errors.length} erreurs`);
      
    } catch (error) {
      results.errors.push(`Erreur globale: ${error.message}`);
      console.error('❌ Erreur génération forcée globale:', error);
    }

    return results;
  }

  /**
   * Vérifie et génère les codes manquants pour un hôtel spécifique
   */
  static async ensureCodesForHotel(hotelId: string, housekeeperNames: string[]): Promise<number> {
    if (!hotelId || !housekeeperNames.length) return 0;

    try {
      // Récupérer le code de l'hôtel
      const { data: hotel } = await supabase
        .from('hotels')
        .select('hotel_code')
        .eq('id', hotelId)
        .single();

      const hotelCode = hotel?.hotel_code || 'HTL';

      // Vérifier les femmes de chambre existantes
      const { data: existingHousekeepers } = await supabase
        .from('housekeepers')
        .select('name')
        .eq('hotel_id', hotelId)
        .eq('is_active', true);

      const existingNames = existingHousekeepers?.map(h => h.name) || [];
      const newHousekeepers = housekeeperNames.filter(name => !existingNames.includes(name));

      let generated = 0;

      for (const name of newHousekeepers) {
        try {
          const accessCode = await this.generateUniqueCode(hotelCode, name);

          // Créer la femme de chambre
          const { data: housekeeper, error: housekeeperError } = await supabase
            .from('housekeepers')
            .insert({
              hotel_id: hotelId,
              name: name,
              access_code: accessCode
            })
            .select('id')
            .single();

          if (housekeeperError) throw housekeeperError;

          // Créer le code d'accès
          await supabase
            .from('housekeeper_access_codes')
            .insert({
              hotel_id: hotelId,
              housekeeper_id: housekeeper.id,
              access_code: accessCode,
              created_by: null
            });

          generated++;
          console.log(`✅ Code généré pour ${name}: ${accessCode}`);
          
        } catch (error) {
          console.error(`❌ Erreur génération code pour ${name}:`, error);
        }
      }

      return generated;
      
    } catch (error) {
      console.error('❌ Erreur ensureCodesForHotel:', error);
      return 0;
    }
  }
}