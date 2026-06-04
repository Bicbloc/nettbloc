export function formatFloorLabel(floor: number | null | undefined): string {
  if (floor === null || floor === undefined) return '-';
  if (floor < -1) return `SS ${floor}`;
  if (floor === -1) return 'SS -1';
  if (floor === 0) return 'RDC';
  if (floor === 1) return '1er';
  return `${floor}e`;
}

/**
 * Déduit l'étage à partir d'un numéro de chambre.
 * Exemples: "101" -> 1, "0 12"/"012" -> 0 (RDC), "1203" -> 12,
 * "RDC 5" -> 0, "B-204" -> 2, "23" -> 2, "5" -> 0.
 * Retourne null si aucun chiffre exploitable n'est trouvé.
 */
export function deduceFloorFromRoomNumber(roomNumber: string | null | undefined): number | null {
  if (!roomNumber) return null;

  const raw = roomNumber.toString().trim().toLowerCase();

  // Mentions explicites de rez-de-chaussée / sous-sol
  if (/\b(rdc|rez|ground|gf)\b/.test(raw)) return 0;
  const ssMatch = raw.match(/(?:ss|sous[\s-]?sol|s)\s*-?\s*(\d+)/);
  if (ssMatch) return -Math.abs(parseInt(ssMatch[1], 10));

  // On isole le premier groupe de chiffres rencontré (ignore les préfixes type "B-")
  const digitsMatch = raw.match(/\d+/);
  if (!digitsMatch) return null;

  const digits = digitsMatch[0];

  // 1 ou 2 chiffres -> RDC par convention (ex: "5", "12" = chambres du RDC)
  if (digits.length <= 2) return 0;
  // 3 chiffres -> premier chiffre = étage (ex: "203" -> 2)
  if (digits.length === 3) return parseInt(digits[0], 10);
  // 4 chiffres et + -> deux premiers chiffres = étage (ex: "1203" -> 12)
  return parseInt(digits.slice(0, 2), 10);
}

export const FLOOR_OPTIONS = [
  { value: '-3', label: 'Sous-sol -3' },
  { value: '-2', label: 'Sous-sol -2' },
  { value: '-1', label: 'Sous-sol -1' },
  { value: '0', label: 'RDC' },
  { value: '1', label: '1er étage' },
  { value: '2', label: '2e étage' },
  { value: '3', label: '3e étage' },
  { value: '4', label: '4e étage' },
  { value: '5', label: '5e étage' },
  { value: '6', label: '6e étage' },
  { value: '7', label: '7e étage' },
  { value: '8', label: '8e étage' },
  { value: '9', label: '9e étage' },
  { value: '10', label: '10e étage' },
  { value: '11', label: '11e étage' },
  { value: '12', label: '12e étage' },
  { value: '15', label: '15e étage' },
  { value: '20', label: '20e étage' },
];

export const SPACE_TYPES = [
  'Couloir',
  'Office',
  'Chaufferie',
  'Buanderie',
  'Lobby',
  'Ascenseur',
  'Escalier',
  'SSI',
  'Local technique',
  'Parking',
  'Terrasse',
  'Piscine',
  'Salle de réunion',
  'Restaurant',
  'Spa',
  'Salle de sport',
  'Réception',
  'Back office',
];
