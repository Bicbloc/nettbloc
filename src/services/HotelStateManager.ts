import { supabase } from '@/integrations/supabase/client';
import { LocalStorageManager } from '@/utils/localStorageManager';
import type { Room } from '@/services/pdfService';

export interface HotelData {
  id: string;
  name: string;
  hotel_code: string;
  access_code?: string;
  user_id?: string;
  email?: string;
  address?: string;
  created_at?: string;
  updated_at?: string;
}

export interface HotelState {
  hotel: HotelData | null;
  accessCode: string | null;
  isSetupComplete: boolean;
  loading: boolean;
  hasConfigurationIssues: boolean;
  rooms: Room[];
  housekeeperNames: string[];
  isDistributed: boolean;
}

type StateListener = (state: HotelState) => void;

export class HotelStateManager {
  private static instance: HotelStateManager | null = null;
  private state: HotelState = {
    hotel: null,
    accessCode: null,
    isSetupComplete: false,
    loading: false,
    hasConfigurationIssues: false,
    rooms: [],
    housekeeperNames: [],
    isDistributed: false
  };

  private listeners: Set<StateListener> = new Set();
  private setupInProgress = false;
  private lastSetupAttempt = 0;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): HotelStateManager {
    if (!HotelStateManager.instance) {
      HotelStateManager.instance = new HotelStateManager();
    }
    return HotelStateManager.instance;
  }

  // Subscribe to state changes
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    // Send current state immediately
    listener(this.state);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Notify all listeners of state changes
  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }

  // Update state and notify listeners
  private setState(updates: Partial<HotelState>) {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  // Get current state
  getState(): HotelState {
    return { ...this.state };
  }

  // Initialize hotel setup for authenticated user
  async setupHotel(userId: string, userEmail?: string): Promise<void> {
    // Prevent concurrent setup attempts
    const now = Date.now();
    if (this.setupInProgress || (now - this.lastSetupAttempt < 5000)) {
      console.log('🚫 Setup déjà en cours ou récent, ignore');
      return;
    }

    this.setupInProgress = true;
    this.lastSetupAttempt = now;
    this.setState({ loading: true, hasConfigurationIssues: false });

    try {
      console.log('🏨 HotelStateManager: Setup pour user:', userId, 'email:', userEmail);

      // 1. Ensure profile exists with retry
      console.log('👤 Étape 1: Vérification profil...');
      const profile = await this.ensureProfileExistsWithRetry(userId, userEmail);
      console.log('✅ Profil vérifié:', profile?.email);
      
      // 2. Find or create hotel with retry
      console.log('🏨 Étape 2: Recherche/création hôtel...');
      const hotel = await this.findOrCreateHotelWithRetry(userId, userEmail, profile?.company_name);
      console.log('✅ Hôtel configuré:', hotel.name, 'ID:', hotel.id);
      
      // 3. Get active access code with retry
      console.log('🔑 Étape 3: Récupération code d\'accès...');
      const accessCode = await this.getActiveAccessCodeWithRetry(hotel.id);
      console.log('✅ Code d\'accès:', accessCode ? 'trouvé' : 'aucun');
      
      // 4. Load distribution state
      console.log('📋 Étape 4: État distribution...');
      const isDistributed = this.loadDistributionState();
      console.log('✅ Distribution:', isDistributed);

      // 5. Update state
      this.setState({
        hotel,
        accessCode,
        isSetupComplete: true,
        loading: false,
        hasConfigurationIssues: false,
        isDistributed
      });

      // 6. Save to localStorage
      this.saveToLocalStorage(hotel);

      console.log('✅ HotelStateManager: Setup terminé avec succès pour', hotel.name);

    } catch (error) {
      console.error('❌ HotelStateManager: Erreur setup:', error);
      this.setState({
        loading: false,
        hasConfigurationIssues: true,
        isSetupComplete: false
      });
    } finally {
      this.setupInProgress = false;
    }
  }

  // Ensure user profile exists with retry logic
  private async ensureProfileExistsWithRetry(userId: string, userEmail?: string, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`👤 Tentative ${attempt}/${retries}: Vérification profil`);
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          console.warn(`❌ Erreur récupération profil (tentative ${attempt}):`, error);
          if (attempt === retries) throw error;
          await this.delay(1000 * attempt);
          continue;
        }

        if (!profile && userEmail) {
          console.log('📝 Création nouveau profil...');
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: userId,
              email: userEmail,
              company_name: null
            })
            .select()
            .single();

          if (createError) {
            console.warn(`❌ Erreur création profil (tentative ${attempt}):`, createError);
            if (attempt === retries) throw createError;
            await this.delay(1000 * attempt);
            continue;
          }
          return newProfile;
        }

        return profile;
      } catch (error) {
        if (attempt === retries) throw error;
        await this.delay(1000 * attempt);
      }
    }
  }

  // Find existing hotel or create new one with retry logic
  private async findOrCreateHotelWithRetry(userId: string, userEmail?: string, companyName?: string, retries = 3): Promise<HotelData> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`🏨 Tentative ${attempt}/${retries}: Recherche hôtel par user_id`);
        
        // First try by user_id
        let { data: hotels, error } = await supabase
          .from('hotels')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          console.warn(`❌ Erreur recherche par user_id (tentative ${attempt}):`, error);
          if (attempt === retries) throw error;
          await this.delay(1000 * attempt);
          continue;
        }

        // If not found by user_id, try by email
        if ((!hotels || hotels.length === 0) && userEmail) {
          console.log('📧 Recherche hôtel par email...');
          const { data: emailHotels, error: emailError } = await supabase
            .from('hotels')
            .select('*')
            .eq('email', userEmail)
            .order('created_at', { ascending: false })
            .limit(1);

          if (emailError) {
            console.warn(`❌ Erreur recherche par email (tentative ${attempt}):`, emailError);
            if (attempt === retries) throw emailError;
            await this.delay(1000 * attempt);
            continue;
          }

          if (emailHotels && emailHotels.length > 0) {
            console.log('🔗 Récupération hôtel existant...');
            // Claim the hotel by updating user_id
            const { data: updatedHotel, error: updateError } = await supabase
              .from('hotels')
              .update({ 
                user_id: userId,
                name: companyName || emailHotels[0].name
              })
              .eq('id', emailHotels[0].id)
              .select()
              .single();

            if (updateError) {
              console.warn(`❌ Erreur mise à jour hôtel (tentative ${attempt}):`, updateError);
              if (attempt === retries) throw updateError;
              await this.delay(1000 * attempt);
              continue;
            }
            return updatedHotel;
          }
        }

        // Use existing hotel or create new one
        if (hotels && hotels.length > 0) {
          console.log('✅ Hôtel existant trouvé:', hotels[0].name);
          return hotels[0];
        }

        // Create new hotel
        console.log('🆕 Création nouvel hôtel...');
        const hotelName = companyName || `Établissement de ${userEmail}`;
        const { data: newHotel, error: createError } = await supabase
          .from('hotels')
          .insert({
            name: hotelName,
            email: userEmail || '',
            user_id: userId
          })
          .select()
          .single();

        if (createError) {
          console.warn(`❌ Erreur création hôtel (tentative ${attempt}):`, createError);
          if (attempt === retries) throw createError;
          await this.delay(1000 * attempt);
          continue;
        }
        
        console.log('✅ Nouvel hôtel créé:', newHotel.name);
        return newHotel;
        
      } catch (error) {
        if (attempt === retries) throw error;
        await this.delay(1000 * attempt);
      }
    }
    throw new Error('Impossible de configurer l\'hôtel après plusieurs tentatives');
  }

  // Get active access code for hotel with retry logic
  private async getActiveAccessCodeWithRetry(hotelId: string, retries = 3): Promise<string | null> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`🔑 Tentative ${attempt}/${retries}: Récupération code accès`);
        
        const { data, error } = await supabase
          .from('housekeeper_access_codes')
          .select('access_code')
          .eq('hotel_id', hotelId)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (error) {
          console.warn(`❌ Erreur récupération code accès (tentative ${attempt}):`, error);
          if (attempt === retries) {
            console.log('⚠️ Aucun code d\'accès trouvé, mais on continue');
            return null;
          }
          await this.delay(500 * attempt);
          continue;
        }

        return data?.access_code || null;
      } catch (error) {
        if (attempt === retries) {
          console.warn('❌ Impossible de récupérer le code d\'accès, mais on continue');
          return null;
        }
        await this.delay(500 * attempt);
      }
    }
    return null;
  }

  // Helper method for delays
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Load distribution state from localStorage
  private loadDistributionState(): boolean {
    const distributed = localStorage.getItem('rooms-distributed') === 'true';
    const timestamp = localStorage.getItem('distribution-timestamp');
    
    if (distributed && timestamp) {
      const age = Date.now() - parseInt(timestamp);
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (age < maxAge) {
        return true;
      } else {
        // Expired, clean up
        localStorage.removeItem('rooms-distributed');
        localStorage.removeItem('distribution-timestamp');
      }
    }
    
    return false;
  }

  // Save hotel data to localStorage
  private saveToLocalStorage(hotel: HotelData) {
    LocalStorageManager.saveHotelData({
      id: hotel.id,
      code: hotel.hotel_code,
      name: hotel.name
    });
  }

  // Update distribution state
  setDistributed(distributed: boolean) {
    this.setState({ isDistributed: distributed });
    
    if (distributed) {
      localStorage.setItem('rooms-distributed', 'true');
      localStorage.setItem('distribution-timestamp', Date.now().toString());
    } else {
      localStorage.removeItem('rooms-distributed');
      localStorage.removeItem('distribution-timestamp');
    }
  }

  // Update rooms
  setRooms(rooms: Room[]) {
    this.setState({ rooms });
  }

  // Update housekeeper names
  setHousekeeperNames(names: string[]) {
    this.setState({ housekeeperNames: names });
  }

  // Generate new access code with enhanced validation
  async generateAccessCode(): Promise<string | null> {
    if (!this.state.hotel) {
      console.error('❌ Aucun hôtel configuré pour la génération de code');
      return null;
    }

    try {
      console.log('🔄 Génération code d\'accès pour hôtel:', this.state.hotel.id);
      
      // First try with RPC function
      const { data: codeData, error } = await supabase
        .rpc('generate_housekeeper_access_code', {
          p_hotel_id: this.state.hotel.id,
          p_housekeeper_id: null
        });

      if (error) {
        console.warn('❌ Erreur RPC génération code:', error);
        
        // Fallback: generate code manually
        const fallbackCode = await this.generateFallbackAccessCode();
        if (fallbackCode) {
          this.setState({ accessCode: fallbackCode });
          return fallbackCode;
        }
        throw error;
      }

      console.log('✅ Code généré via RPC:', codeData);
      this.setState({ accessCode: codeData });
      return codeData;
    } catch (error) {
      console.error('❌ Erreur génération code:', error);
      return null;
    }
  }

  // Fallback code generation method
  private async generateFallbackAccessCode(): Promise<string | null> {
    try {
      console.log('🔄 Génération code fallback...');
      
      const hotelCode = this.state.hotel?.hotel_code || 'HTL';
      const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const accessCode = `${hotelCode}-${randomSuffix}`;
      
      // Insert directly into access codes table
      const { error } = await supabase
        .from('housekeeper_access_codes')
        .insert({
          hotel_id: this.state.hotel!.id,
          access_code: accessCode,
          is_active: true,
          created_by: null
        });

      if (error) throw error;
      
      console.log('✅ Code fallback généré:', accessCode);
      return accessCode;
    } catch (error) {
      console.error('❌ Erreur génération fallback:', error);
      return null;
    }
  }

  // Force complete reset
  forceReset() {
    console.log('🔄 HotelStateManager: Force reset');
    
    // Reset state
    this.setState({
      hotel: null,
      accessCode: null,
      isSetupComplete: false,
      loading: false,
      hasConfigurationIssues: false,
      rooms: [],
      housekeeperNames: [],
      isDistributed: false
    });

    // Clear localStorage
    LocalStorageManager.resetHotelData();
    localStorage.removeItem('rooms-distributed');
    localStorage.removeItem('distribution-timestamp');
    
    // Reset flags
    this.setupInProgress = false;
    this.lastSetupAttempt = 0;

    console.log('✅ HotelStateManager: Reset terminé');
  }
}
