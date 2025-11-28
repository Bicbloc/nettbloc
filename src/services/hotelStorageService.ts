export interface HotelSession {
  id: string;
  name: string;
  code: string;
  timestamp: number;
}

export class HotelStorageService {
  private static readonly KEY = 'hotel_session';
  private static readonly EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

  static save(hotel: { id: string; name: string; code: string }): void {
    try {
      const session: HotelSession = {
        ...hotel,
        timestamp: Date.now(),
      };
      // Save to new key
      localStorage.setItem(this.KEY, JSON.stringify(session));
      
      // Also save to legacy keys for retrocompatibility
      localStorage.setItem('selectedHotelId', hotel.id);
      localStorage.setItem('selectedHotelCode', hotel.code);
      localStorage.setItem('selectedHotelName', hotel.name);
      localStorage.setItem('currentHotelId', hotel.id);
    } catch (error) {
      console.error('Failed to save hotel session:', error);
    }
  }

  static get(): HotelSession | null {
    try {
      // Try new format first
      const stored = localStorage.getItem(this.KEY);
      if (stored) {
        const session: HotelSession = JSON.parse(stored);
        
        // Check if expired
        if (Date.now() - session.timestamp > this.EXPIRY_MS) {
          this.clear();
          return null;
        }
        
        return session;
      }

      // Fallback to legacy keys
      const id = localStorage.getItem('selectedHotelId');
      if (id) {
        return {
          id,
          name: localStorage.getItem('selectedHotelName') || '',
          code: localStorage.getItem('selectedHotelCode') || '',
          timestamp: Date.now()
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to retrieve hotel session:', error);
      this.clear();
      return null;
    }
  }

  static clear(): void {
    try {
      localStorage.removeItem(this.KEY);
      // Also clear legacy keys for migration
      localStorage.removeItem('selectedHotelId');
      localStorage.removeItem('currentHotelId');
      localStorage.removeItem('hotelId');
    } catch (error) {
      console.error('Failed to clear hotel session:', error);
    }
  }

  static getId(): string | null {
    const session = this.get();
    return session?.id || null;
  }
}
