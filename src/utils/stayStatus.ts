/**
 * Libellés et couleurs harmonisés pour le statut de séjour d'une chambre,
 * basés sur les statuts remontés par le PMS (Mews/Apaleo).
 * Utilisé par l'interface Cafetière et les déclarations d'incident.
 */
export interface StayLabel {
  label: string;
  className: string;
}

export function stayLabel(status: string | null | undefined, occupied?: boolean): StayLabel {
  const s = (status || '').toLowerCase();
  if (s.includes('depart') || s.includes('checkout') || s.includes('check-out') || s === 'departure') {
    return { label: 'Check-out', className: 'text-rose-600' };
  }
  if (s.includes('arriv') || s === 'arrival' || s.includes('reserved')) {
    return { label: 'Arrivée', className: 'text-blue-600' };
  }
  if (occupied || s.length > 0) {
    return { label: 'En cours', className: 'text-emerald-600' };
  }
  return { label: '', className: 'text-muted-foreground' };
}
