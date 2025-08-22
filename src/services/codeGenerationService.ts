import { supabase } from '@/integrations/supabase/client';

export class CodeGenerationService {
  
  /**
   * S'assurer que tous les hôtels ont un hotel_code
   */
  static async ensureHotelCodesExist(): Promise<number> {
    try {
      console.log('🏨 Vérification des codes d\'hôtel...');
      
      // Récupérer tous les hôtels sans hotel_code
      const { data: hotelsWithoutCode, error } = await supabase
        .from('hotels')
        .select('id, name')
        .or('hotel_code.is.null,hotel_code.eq.');

      if (error) throw error;

      let fixed = 0;
      for (const hotel of hotelsWithoutCode || []) {
        try {
          // Générer un nouveau code d'hôtel
          const hotelCode = `HTL${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;
          
          const { error: updateError } = await supabase
            .from('hotels')
            .update({ hotel_code: hotelCode })
            .eq('id', hotel.id);

          if (updateError) throw updateError;

          console.log(`✅ Code d'hôtel assigné: ${hotel.name} -> ${hotelCode}`);
          fixed++;
        } catch (error) {
          console.error(`❌ Erreur assignation code pour ${hotel.name}:`, error);
        }
      }

      console.log(`✅ ${fixed} codes d'hôtel assignés`);
      return fixed;
      
    } catch (error) {
      console.error('❌ Erreur ensureHotelCodesExist:', error);
      return 0;
    }
  }

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

      // Vérifier l'unicité dans TOUTES les tables
      const { data: existingInCodes } = await supabase
        .from('housekeeper_access_codes')
        .select('id')
        .eq('access_code', accessCode)
        .eq('is_active', true)
        .maybeSingle();

      const { data: existingInHousekeepers } = await supabase
        .from('housekeepers')
        .select('id')
        .eq('access_code', accessCode)
        .eq('is_active', true)
        .maybeSingle();

      if (!existingInCodes && !existingInHousekeepers) {
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
        const sessionAny = session as any;
        try {
          if (!Array.isArray(sessionAny.housekeeper_names) || sessionAny.housekeeper_names.length === 0) {
            continue;
          }

          const hotelCode = sessionAny.hotels?.hotel_code || 'HTL';
          
          // Vérifier les femmes de chambre existantes pour cet hôtel
          const { data: existingHousekeepers } = await supabase
            .from('housekeepers')
            .select('name')
            .eq('hotel_id', sessionAny.hotel_id)
            .eq('is_active', true);

          const existingNames = existingHousekeepers?.map(h => h.name) || [];
          const newHousekeepers = (sessionAny.housekeeper_names as string[]).filter(name => !existingNames.includes(name));

          // Créer les nouvelles femmes de chambre
          for (const name of newHousekeepers) {
            try {
              const accessCode = await this.generateUniqueCode(hotelCode, name);

              // Récupérer l'utilisateur pour obtenir user_id
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) {
                throw new Error('Utilisateur non connecté');
              }

              // Créer la femme de chambre
              const { data: housekeeper, error: housekeeperError } = await supabase
                .from('housekeepers')
                .insert({
                  hotel_id: sessionAny.hotel_id,
                  name: name,
                  access_code: accessCode,
                  user_id: user.id
                })
                .select('id')
                .single();

              if (housekeeperError) throw housekeeperError;

              // Créer le code d'accès
              const { error: codeError } = await supabase
                .from('housekeeper_access_codes')
                .insert({
                  hotel_id: sessionAny.hotel_id,
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
          
        } catch (error: any) {
          const errorMsg = `Erreur session ${sessionAny.id}: ${error.message}`;
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
   * Génère les codes UNIQUEMENT pour les femmes de chambre assignées aux chambres
   */
  static async ensureCodesForAssignedHousekeepers(hotelId: string, assignedHousekeepers: string[]): Promise<number> {
    if (!hotelId || !assignedHousekeepers.length) {
      console.log('🔄 Aucune femme de chambre assignée, aucun code à générer');
      return 0;
    }

    console.log('🔧 Génération codes pour femmes de chambre assignées:', assignedHousekeepers);
    
    try {
      // Récupérer le code de l'hôtel
      const { data: hotel } = await supabase
        .from('hotels')
        .select('hotel_code')
        .eq('id', hotelId)
        .single();

      const hotelCode = hotel?.hotel_code || 'HTL';
      let generated = 0;

      // Traiter chaque femme de chambre UNE SEULE FOIS
      const processedNames = new Set<string>();

      for (const housekeeperName of assignedHousekeepers) {
        // Éviter les doublons dans la même boucle
        if (processedNames.has(housekeeperName)) {
          console.log('⚠️ Nom déjà traité, ignoré:', housekeeperName);
          continue;
        }
        processedNames.add(housekeeperName);

        console.log('🔍 Vérification code pour:', housekeeperName);
        
        // Vérifier si elle existe déjà avec un code actif (chercher le PREMIER seulement)
        const { data: existingHousekeepers } = await supabase
          .from('housekeepers')
          .select('*')
          .eq('hotel_id', hotelId)
          .eq('name', housekeeperName)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1);

        const existingHousekeeper = existingHousekeepers?.[0];

        if (existingHousekeeper?.access_code) {
          console.log('✅ Code déjà existant pour:', housekeeperName, existingHousekeeper.access_code);
          continue;
        }

        try {
          // Générer un nouveau code d'accès
          const accessCode = await this.generateUniqueCode(hotelCode, housekeeperName);

          if (existingHousekeeper) {
            // Mettre à jour SEULEMENT le premier
            const { error: updateError } = await supabase
              .from('housekeepers')
              .update({ 
                access_code: accessCode,
                is_active: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingHousekeeper.id);

            if (updateError) throw updateError;

            // Créer ou mettre à jour le code d'accès dans la table dédiée
            await supabase
              .from('housekeeper_access_codes')
              .upsert({
                hotel_id: hotelId,
                housekeeper_id: existingHousekeeper.id,
                access_code: accessCode,
                is_active: true,
                created_by: (await supabase.auth.getUser()).data.user?.id
              }, {
                onConflict: 'hotel_id,housekeeper_id'
              });

          } else {
            // Récupérer l'utilisateur pour obtenir user_id
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
              throw new Error('Utilisateur non connecté');
            }

            // Créer une nouvelle femme de chambre
            const { data: newHousekeeper, error: createError } = await supabase
              .from('housekeepers')
              .insert({
                hotel_id: hotelId,
                name: housekeeperName,
                access_code: accessCode,
                is_active: true,
                user_id: user.id
              })
              .select('id')
              .single();

            if (createError) throw createError;

            // Créer le code d'accès dans la table dédiée
            await supabase
              .from('housekeeper_access_codes')
              .insert({
                hotel_id: hotelId,
                housekeeper_id: newHousekeeper.id,
                access_code: accessCode,
                is_active: true,
                created_by: (await supabase.auth.getUser()).data.user?.id
              });
          }

          generated++;
          console.log(`✅ Code généré pour ${housekeeperName}: ${accessCode}`);
          
        } catch (error) {
          console.error(`❌ Erreur génération code pour ${housekeeperName}:`, error);
        }
      }

      console.log(`🎯 Génération terminée: ${generated} codes créés pour les femmes assignées`);
      return generated;
      
    } catch (error) {
      console.error('❌ Erreur ensureCodesForAssignedHousekeepers:', error);
      return 0;
    }
  }

  /**
   * DEPRECATED: Utiliser ensureCodesForAssignedHousekeepers à la place
   */
  static async ensureCodesForHotel(hotelId: string, housekeeperNames: string[]): Promise<number> {
    console.warn('⚠️ ensureCodesForHotel est dépréciée, utilisez ensureCodesForAssignedHousekeepers');
    return this.ensureCodesForAssignedHousekeepers(hotelId, housekeeperNames);
  }
}