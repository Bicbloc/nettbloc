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
      localStorage.setItem(this.KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Failed to save hotel session:', error);
    }
  }

  static get(): HotelSession | null {
    try {
      const stored = localStorage.getItem(this.KEY);
      if (!stored) return null;

      const session: HotelSession = JSON.parse(stored);
      
      // Check if expired
      if (Date.now() - session.timestamp > this.EXPIRY_MS) {
        this.clear();
        return null;
      }

      return session;
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
