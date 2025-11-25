import { supabase } from '@/integrations/supabase/client';

interface Hotel {
  id: string;
  name: string;
  email: string;
  address?: string; // Nouvelle adresse
  hotel_code?: string; // Optional for compatibility
  created_at: string;
  updated_at: string;
}

interface Housekeeper {
  id: string;
  hotel_id: string | null;
  name: string;
  access_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RoomStatusUpdate {
  id: string;
  hotel_id: string | null;
  housekeeper_id: string | null;
  room_number: string;
  status: string;
  message: string | null;
  created_at: string;
}

export class SupabaseService {
  // Gestion des hôtels - Version simplifiée
  static async createSimpleHotel(name: string, address: string, userEmail: string): Promise<Hotel | null> {
    try {
      // Récupérer l'utilisateur actuel pour obtenir son ID
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('Aucun utilisateur connecté');
        return null;
      }

      // Générer un code hôtel si absent via RPC, avec repli local
      let generatedCode: string | null = null;
      try {
        const { data: rpcCode, error: rpcErr } = await supabase.rpc('generate_short_hotel_id');
        if (!rpcErr && rpcCode) generatedCode = rpcCode as string;
      } catch (e) {
        console.warn('⚠️ RPC generate_short_hotel_id indisponible, fallback local');
      }
      if (!generatedCode) {
        const rand = Math.floor(1 + Math.random() * 999);
        generatedCode = `HTL${String(rand).padStart(3, '0')}`;
      }

      const { data, error } = await supabase
        .from('hotels')
        .insert({ 
          name, 
          address, 
          email: userEmail,
          user_id: user.id,  // Assigner explicitement le user_id
          hotel_code: generatedCode
        })
        .select('id, name, email, address, hotel_code, created_at, updated_at')
        .single();
      
      if (error || !data) {
        console.error('Erreur création hôtel simple:', error);
        return null;
      }
      return data as Hotel;
    } catch (err) {
      console.error('Erreur createSimpleHotel:', err);
      return null;
    }
  }

  // Version legacy pour compatibilité
  static async createHotel(name: string, email: string, hotelCode: string): Promise<Hotel | null> {
    try {
      const { data, error } = await supabase
        .from('hotels')
        .insert({ name, email, hotel_code: hotelCode })
        .select('id, name, email, hotel_code, created_at, updated_at')
        .single();
      
      if (error || !data) {
        console.error('Erreur création hôtel:', error);
        return null;
      }
      return data as Hotel;
    } catch (err) {
      console.error('Erreur createHotel:', err);
      return null;
    }
  }

  // Créer un hôtel avec un ID spécifique
  static async createHotelWithId(id: string, name: string, email: string, hotelCode: string): Promise<Hotel | null> {
    try {
      const { data, error } = await supabase
        .from('hotels')
        .insert({ id, name, email, hotel_code: hotelCode })
        .select('id, name, email, hotel_code, created_at, updated_at')
        .single();
      
      if (error || !data) {
        console.error('Erreur création hôtel avec ID:', error);
        return null;
      }
      return data as Hotel;
    } catch (err) {
      console.error('Erreur createHotelWithId:', err);
      return null;
    }
  }

  // Mettre à jour l'ID d'un hôtel existant
  static async updateHotelId(oldId: string, newId: string): Promise<Hotel | null> {
    try {
      // D'abord récupérer l'hôtel existant
      const { data: existingHotel, error: fetchError } = await supabase
        .from('hotels')
        .select('*')
        .eq('id', oldId)
        .single();

      if (fetchError || !existingHotel) {
        console.error('Erreur récupération hôtel pour mise à jour ID:', fetchError);
        return null;
      }

      // Créer un nouvel hôtel avec le nouvel ID
      const { data: newHotel, error: createError } = await supabase
        .from('hotels')
        .insert({ 
          id: newId,
          name: existingHotel.name,
          email: existingHotel.email,
          hotel_code: existingHotel.hotel_code
        })
        .select('id, name, email, hotel_code, created_at, updated_at')
        .single();

      if (createError || !newHotel) {
        console.error('Erreur création nouvel hôtel avec ID:', createError);
        return null;
      }

      // Supprimer l'ancien hôtel
      const { error: deleteError } = await supabase
        .from('hotels')
        .delete()
        .eq('id', oldId);

      if (deleteError) {
        console.error('Erreur suppression ancien hôtel:', deleteError);
        // Ne pas retourner null car le nouvel hôtel a été créé
      }

      return newHotel as Hotel;
    } catch (err) {
      console.error('Erreur updateHotelId:', err);
      return null;
    }
  }

  static async getHotelByCode(hotelCode: string): Promise<Hotel | null> {
    try {
      console.log('🏨 Recherche hôtel avec le code:', hotelCode);
      
      const { data, error } = await supabase
        .from('hotels')
        .select('id, name, email, hotel_code, created_at, updated_at')
        .eq('hotel_code', hotelCode)
        .maybeSingle();
      
      if (error) {
        console.error('❌ Erreur récupération hôtel par code:', error);
        return null;
      }
      
      if (!data) {
        console.log('❌ Aucun hôtel trouvé avec le code:', hotelCode);
        return null;
      }
      
      console.log('✅ Hôtel trouvé:', data);
      return data as Hotel;
    } catch (err) {
      console.error('❌ Erreur getHotelByCode:', err);
      return null;
    }
  }

  static async getHotels(): Promise<Hotel[]> {
    const { data, error } = await supabase
      .from('hotels')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erreur récupération hôtels:', error);
      return [];
    }
    return (data || []) as Hotel[];
  }

  // Gestion des femmes de chambre
  // Créer les femmes de chambre avec des codes d'accès individuels
  static async createHousekeepers(hotelId: string, names: string[]): Promise<Housekeeper[]> {
    const housekeepers = [];
    
    // Récupérer l'utilisateur actuel pour obtenir son ID
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('❌ Aucun utilisateur connecté');
      throw new Error('Utilisateur non connecté');
    }
    
    for (const name of names) {
      // Générer un code d'accès unique pour chaque femme de chambre (4 chiffres)
      const accessCode = Math.floor(1000 + Math.random() * 9000).toString();
      
      const { data, error } = await supabase
        .from('housekeepers')
        .upsert({
          name,
          hotel_id: hotelId,
          access_code: accessCode,
          is_active: true,
          user_id: user.id
        }, {
          onConflict: 'hotel_id,name'
        })
        .select()
        .single();
      
      if (error) {
        console.error(`❌ Erreur création/mise à jour femme de chambre ${name}:`, error);
        throw error;
      }
      
      console.log(`✅ Femme de chambre ${name} créée avec code:`, accessCode);
      housekeepers.push(data);
    }
    
    return housekeepers;
  }

  static async createHousekeeper(hotelId: string, name: string): Promise<Housekeeper | null> {
    try {
      console.log('🔧 Début création femme de chambre:', { hotelId, name });
      
      // Vérifier la session active d'abord
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('❌ Session expirée ou invalide:', sessionError);
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }

      // Récupérer l'utilisateur actuel
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('❌ Aucun utilisateur connecté');
        throw new Error('Utilisateur non connecté. Veuillez vous reconnecter.');
      }

      console.log('✅ Session valide pour user:', user.email);

      // Générer un code d'accès unique avec la nouvelle fonction simplifiée
      const { data: accessCode, error: codeError } = await supabase
        .rpc('generate_housekeeper_access_code_simple', {
          p_hotel_id: hotelId,
          p_housekeeper_name: name
        });

      if (codeError) {
        console.error('❌ Erreur génération code d\'accès:', codeError);
        if (codeError.message?.includes('introuvable') || codeError.message?.includes('non autorisé')) {
          throw new Error('Accès à l\'hôtel non autorisé. Vérifiez votre connexion.');
        }
        throw new Error(`Erreur génération code: ${codeError.message}`);
      }

      console.log('✅ Code d\'accès généré:', accessCode);

      const { data, error } = await supabase
        .from('housekeepers')
        .insert({ 
          hotel_id: hotelId, 
          name, 
          access_code: accessCode,
          user_id: user.id  // Assigner explicitement le user_id pour RLS
        })
        .select()
        .single();
      
      console.log('👩‍🏠 Résultat création femme de chambre:', { data, error });
      
      if (error) {
        console.error('❌ Erreur création femme de chambre:', error);
        return null;
      }
      
      console.log('✅ Femme de chambre créée avec succès:', data);
      return data as Housekeeper;
    } catch (err: any) {
      console.error('❌ Erreur createHousekeeper:', err);
      // Rethrow avec message explicite pour l'UI
      throw err;
    }
  }

  static async createOrUpdateHousekeeper(hotelId: string, name: string, accessCode: string): Promise<Housekeeper | null> {
    try {
      // Valider que le code d'accès appartient au bon hôtel
      const isValidCode = await supabase.rpc('validate_access_code_for_hotel', {
        access_code: accessCode,
        hotel_uuid: hotelId
      });

      if (!isValidCode) {
        console.error('Code d\'accès invalide pour cet hôtel');
        return null;
      }

      // Chercher si la femme de chambre existe déjà
      const { data: existingHousekeeper } = await supabase
        .from('housekeepers')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('name', name)
        .maybeSingle();

      let housekeeper: Housekeeper;

      if (existingHousekeeper) {
        // Mettre à jour le code d'accès
        const { data, error } = await supabase
          .from('housekeepers')
          .update({ access_code: accessCode, is_active: true })
          .eq('id', existingHousekeeper.id)
          .select()
          .single();
        
        if (error) {
          console.error('Erreur mise à jour femme de chambre:', error);
          return null;
        }
        housekeeper = data as Housekeeper;
      } else {
        // Récupérer l'utilisateur actuel pour obtenir son ID
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.error('❌ Aucun utilisateur connecté');
          return null;
        }

        // Créer une nouvelle femme de chambre
        const { data, error } = await supabase
          .from('housekeepers')
          .insert({ 
            hotel_id: hotelId, 
            name, 
            access_code: accessCode,
            user_id: user.id 
          })
          .select()
          .single();
        
        if (error) {
          console.error('Erreur création femme de chambre:', error);
          return null;
        }
        housekeeper = data as Housekeeper;
      }

      // Créer ou mettre à jour le code d'accès dans la table dédiée avec le bon housekeeper_id
      const { error: codeError } = await supabase
        .from('housekeeper_access_codes')
        .upsert({
          hotel_id: hotelId,
          housekeeper_id: housekeeper.id,
          access_code: accessCode,
          is_active: true,
          created_by: (await supabase.auth.getUser()).data.user?.id
        }, {
          onConflict: 'hotel_id,housekeeper_id'
        });

      if (codeError) {
        console.error('Erreur création/mise à jour code d\'accès:', codeError);
        // Ne pas retourner null car la femme de chambre est créée
      }

      return housekeeper;
      
    } catch (err) {
      console.error('Erreur createOrUpdateHousekeeper:', err);
      return null;
    }
  }

  static async authenticateHousekeeper(accessCode: string): Promise<Housekeeper | null> {
    console.log('🔐 Tentative d\'authentification avec code:', accessCode);
    
    try {
      // Nouvelle méthode: chercher dans housekeeper_access_codes d'abord
      const { data: accessCodeData, error: accessError } = await supabase
        .from('housekeeper_access_codes')
        .select(`
          *,
          housekeepers!inner(*, hotels!inner(id, hotel_code))
        `)
        .eq('access_code', accessCode)
        .eq('is_active', true)
        .maybeSingle();

      if (accessError) {
        console.error('❌ Erreur recherche code d\'accès:', accessError);
      }

      if (accessCodeData?.housekeepers) {
        console.log('✅ Code trouvé dans housekeeper_access_codes');
        
        // Marquer le code comme utilisé
        await supabase
          .from('housekeeper_access_codes')
          .update({ used_at: new Date().toISOString() })
          .eq('id', accessCodeData.id);
          
        console.log('✅ Authentification réussie pour:', accessCodeData.housekeepers.name);
        return accessCodeData.housekeepers as Housekeeper;
      }

      // Fallback: chercher directement dans la table housekeepers (ancien système)
      console.log('🔄 Fallback: recherche dans table housekeepers...');
      const { data: housekeeperData, error: housekeeperError } = await supabase
        .from('housekeepers')
        .select('*, hotels!inner(id, hotel_code)')
        .eq('access_code', accessCode)
        .eq('is_active', true)
        .maybeSingle();

      if (housekeeperError) {
        console.error('❌ Erreur authentification femme de chambre (fallback):', housekeeperError);
        return null;
      }

      if (!housekeeperData) {
        console.error('❌ Code d\'accès non trouvé ou inactif:', accessCode);
        return null;
      }

      // Valider que le code d'accès appartient au bon hôtel
      if (housekeeperData.hotel_id) {
        const isValidCode = await supabase.rpc('validate_access_code_for_hotel', {
          access_code: accessCode,
          hotel_uuid: housekeeperData.hotel_id
        });

        if (!isValidCode) {
          console.error('❌ Code d\'accès ne correspond pas à l\'hôtel');
          return null;
        }
      }
      
      console.log('✅ Authentification réussie pour:', housekeeperData.name);
      return housekeeperData as Housekeeper;
      
    } catch (error) {
      console.error('❌ Erreur dans authenticateHousekeeper:', error);
      return null;
    }
  }

  static async getHousekeepers(hotelId?: string): Promise<Housekeeper[]> {
    const housekeepers: Housekeeper[] = [];
    
    // 1. Récupérer les femmes de chambre temporaires (table housekeepers)
    let query = supabase
      .from('housekeepers')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (hotelId) {
      query = query.eq('hotel_id', hotelId);
    }
    
    const { data: tempHousekeepers, error: tempError } = await query;
    
    if (tempError) {
      console.error('Erreur récupération femmes de chambre temporaires:', tempError);
    } else if (tempHousekeepers) {
      housekeepers.push(...tempHousekeepers as Housekeeper[]);
    }
    
    // 2. Récupérer les femmes de chambre authentifiées avec des sessions actives
    if (hotelId) {
      const { data: activeSessions, error: sessionError } = await supabase
        .from('hotel_access_sessions')
        .select(`
          access_code,
          housekeeper_profile_id,
          housekeeper_profiles!inner(id, name, email)
        `)
        .eq('hotel_id', hotelId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString());
      
      if (sessionError) {
        console.error('Erreur récupération sessions actives:', sessionError);
      } else if (activeSessions && activeSessions.length > 0) {
        console.log(`✅ ${activeSessions.length} femme(s) de chambre authentifiée(s) trouvée(s)`);
        
        // Convertir les sessions en format Housekeeper
        for (const session of activeSessions) {
          const profile = session.housekeeper_profiles as any;
          if (profile) {
            housekeepers.push({
              id: profile.id,
              hotel_id: hotelId,
              name: profile.name,
              access_code: session.access_code,
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              user_id: profile.id
            } as Housekeeper);
          }
        }
      }
    }
    
    if (housekeepers.length === 0) {
      console.log('⚠️ Aucune femme de chambre trouvée pour l\'hôtel:', hotelId);
    }
    
    console.log(`✅ Total: ${housekeepers.length} femme(s) de chambre récupérée(s)`);
    return housekeepers;
  }

  static async deactivateHousekeeper(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('housekeepers')
      .update({ is_active: false })
      .eq('id', id);
    
    if (error) {
      console.error('Erreur désactivation femme de chambre:', error);
      return false;
    }
    return true;
  }

  static async activateHousekeeper(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('housekeepers')
      .update({ is_active: true })
      .eq('id', id);
    
    if (error) {
      console.error('Erreur réactivation femme de chambre:', error);
      return false;
    }
    return true;
  }

  static async cleanupAllHousekeepers(hotelId: string): Promise<{deleted_housekeepers: number, deleted_codes: number} | null> {
    try {
      const { data, error } = await supabase
        .rpc('cleanup_all_housekeepers_for_hotel', {
          p_hotel_id: hotelId
        });

      if (error) {
        console.error('❌ Erreur nettoyage femmes de chambre:', error);
        return null;
      }

      return data?.[0] || { deleted_housekeepers: 0, deleted_codes: 0 };
    } catch (error) {
      console.error('❌ Erreur nettoyage femmes de chambre:', error);
      return null;
    }
  }

  // Gestion des mises à jour de statut des chambres
  static async createRoomStatusUpdate(
    hotelId: string,
    housekeeperId: string,
    roomNumber: string,
    status: string,
    message?: string
  ): Promise<RoomStatusUpdate | null> {
    const { data, error } = await supabase
      .from('room_status_updates')
      .insert({
        hotel_id: hotelId,
        housekeeper_id: housekeeperId,
        room_number: roomNumber,
        status,
        message
      })
      .select()
      .single();
    
    if (error) {
      console.error('Erreur création mise à jour statut chambre:', error);
      return null;
    }
    return data as RoomStatusUpdate;
  }
}