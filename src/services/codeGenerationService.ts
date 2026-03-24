import { supabase } from '@/integrations/supabase/client';

export class CodeGenerationService {
  
  /**
   * S'assurer que tous les hôtels ont un hotel_code
   */
  static async ensureHotelCodesExist(): Promise<number> {
    try {
      
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

          fixed++;
        } catch (error) {
          console.error(`❌ Erreur assignation code pour ${hotel.name}:`, error);
        }
      }

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
      
      // Supprimer les codes d'accès sans femme de chambre associée
      const { data: orphanedCodes, error: orphanedError } = await supabase
        .from('housekeeper_access_codes')
        .delete()
        .is('housekeeper_id', null)
        .select('id');

      if (orphanedError) throw orphanedError;

      // Note: fonction de nettoyage des doublons à implémenter si nécessaire

      const cleanedCount = orphanedCodes?.length || 0;
      
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
   * Force la génération de codes pour toutes les femmes de chambre sans codes
   */
  static async forceGenerateAllMissingCodes(): Promise<{generated: number, errors: string[]}> {
    const results = { generated: 0, errors: [] as string[] };
    
    try {
      
      // Nettoyer d'abord les codes orphelins
      await this.cleanupOrphanedCodes();

      // Récupérer toutes les femmes de chambre actives sans codes d'accès
      const { data: housekeepersWithoutCodes, error: housekeepersError } = await supabase
        .from('housekeepers')
        .select(`
          id,
          name,
          hotel_id,
          access_code,
          hotels!inner(name, hotel_code)
        `)
        .eq('is_active', true)
        .or('access_code.is.null,access_code.eq.');

      if (housekeepersError) throw housekeepersError;

      for (const housekeeper of housekeepersWithoutCodes || []) {
        const housekeeperAny = housekeeper as any;
        try {
          const hotelCode = housekeeperAny.hotels?.hotel_code || 'HTL';
          
          // Générer un nouveau code d'accès
          const accessCode = await this.generateUniqueCode(hotelCode, housekeeperAny.name);

          // Mettre à jour la femme de chambre avec le nouveau code
          const { error: updateError } = await supabase
            .from('housekeepers')
            .update({ 
              access_code: accessCode,
              updated_at: new Date().toISOString()
            })
            .eq('id', housekeeperAny.id);

          if (updateError) throw updateError;

          // Créer ou mettre à jour le code d'accès dans la table dédiée
          const { error: codeError } = await supabase
            .from('housekeeper_access_codes')
            .upsert({
              hotel_id: housekeeperAny.hotel_id,
              housekeeper_id: housekeeperAny.id,
              access_code: accessCode,
              is_active: true,
              created_by: (await supabase.auth.getUser()).data.user?.id
            }, {
              onConflict: 'hotel_id,housekeeper_id'
            });

          if (codeError) throw codeError;

          results.generated++;
          
        } catch (error: any) {
          const errorMsg = `Erreur pour ${housekeeperAny.name}: ${error.message}`;
          results.errors.push(errorMsg);
          console.error('❌', errorMsg);
        }
      }

      
    } catch (error: any) {
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
      return 0;
    }

    
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
          continue;
        }
        processedNames.add(housekeeperName);

        
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
          
        } catch (error) {
          console.error(`❌ Erreur génération code pour ${housekeeperName}:`, error);
        }
      }

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
    return this.ensureCodesForAssignedHousekeepers(hotelId, housekeeperNames);
  }
}