import { describe, it, expect } from 'vitest';
import { MewsAdapter } from './MewsAdapter';

describe('MewsAdapter - stayover without times', () => {
  it('should return recouche when arrival+departure dates exist but no times (even for Night X/X)', () => {
    const adapter = new MewsAdapter();

    const text = [
      'Statut des espaces - 01/01/2026',
      // pas d’horaire (HH:MM), mais 2 dates + Nuit 4/4
      '101 DBL-C SAL 01/01/2026 05/01/2026 Nuit 4/4 2 × Adultes DUPONT Jean',
    ].join('\n');

    const rooms = adapter.extractRooms(text);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].roomNumber).toBe('101');
    expect(rooms[0].cleaningType).toBe('recouche');
    expect(rooms[0].status).toBe('stayover');
  });

  it('should return a_blanc when a departure time is present', () => {
    const adapter = new MewsAdapter();

    const text = [
      'Statut des espaces - 01/01/2026',
      // horaire à droite → départ
      '101 DBL-C SAL 01/01/2026 05/01/2026 Nuit 4/4 2 × Adultes DUPONT Jean 11:00',
    ].join('\n');

    const rooms = adapter.extractRooms(text);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].roomNumber).toBe('101');
    expect(rooms[0].cleaningType).toBe('a_blanc');
    expect(rooms[0].status).toBe('checkout');
  });
});
