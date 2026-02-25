export function formatFloorLabel(floor: number | null | undefined): string {
  if (floor === null || floor === undefined) return '-';
  if (floor < -1) return `SS ${floor}`;
  if (floor === -1) return 'SS -1';
  if (floor === 0) return 'RDC';
  if (floor === 1) return '1er';
  return `${floor}e`;
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
