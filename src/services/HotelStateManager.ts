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
    if (this.setupInProgress || (now - this.lastSetupAttempt < 10000)) {
      console.log('🚫 Setup déjà en cours ou récent, ignore');
      return;
    }

    this.setupInProgress = true;
    this.lastSetupAttempt = now;
    this.setState({ loading: true, hasConfigurationIssues: false });

    try {
      console.log('🏨 HotelStateManager: Setup pour user:', userId);

      // 1. Ensure profile exists
      const profile = await this.ensureProfileExists(userId, userEmail);
      
      // 2. Find or create hotel
      const hotel = await this.findOrCreateHotel(userId, userEmail, profile?.company_name);
      
      // 3. Get active access code
      const accessCode = await this.getActiveAccessCode(hotel.id);
      
      // 4. Load distribution state
      const isDistributed = this.loadDistributionState();

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

      console.log('✅ HotelStateManager: Setup terminé avec succès');

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

  // Ensure user profile exists
  private async ensureProfileExists(userId: string, userEmail?: string) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;

    if (!profile && userEmail) {
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: userEmail,
          company_name: null
        })
        .select()
        .single();

      if (createError) throw createError;
      return newProfile;
    }

    return profile;
  }

  // Find existing hotel or create new one
  private async findOrCreateHotel(userId: string, userEmail?: string, companyName?: string): Promise<HotelData> {
    // First try by user_id
    let { data: hotels, error } = await supabase
      .from('hotels')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    // If not found by user_id, try by email
    if ((!hotels || hotels.length === 0) && userEmail) {
      const { data: emailHotels, error: emailError } = await supabase
        .from('hotels')
        .select('*')
        .eq('email', userEmail)
        .order('created_at', { ascending: false })
        .limit(1);

      if (emailError) throw emailError;

      if (emailHotels && emailHotels.length > 0) {
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

        if (updateError) throw updateError;
        return updatedHotel;
      }
    }

    // Use existing hotel or create new one
    if (hotels && hotels.length > 0) {
      return hotels[0];
    }

    // Create new hotel
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

    if (createError) throw createError;
    return newHotel;
  }

  // Get active access code for hotel
  private async getActiveAccessCode(hotelId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('housekeeper_access_codes')
      .select('access_code')
      .eq('hotel_id', hotelId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Erreur récupération code accès:', error);
      return null;
    }

    return data?.access_code || null;
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

  // Generate new access code
  async generateAccessCode(): Promise<string | null> {
    if (!this.state.hotel) return null;

    try {
      const { data: codeData, error } = await supabase
        .rpc('generate_housekeeper_access_code', {
          p_hotel_id: this.state.hotel.id,
          p_housekeeper_id: null
        });

      if (error) throw error;

      this.setState({ accessCode: codeData });
      return codeData;
    } catch (error) {
      console.error('Erreur génération code:', error);
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
