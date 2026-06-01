/**
 * Suivi local des femmes de chambre récemment approuvées
 * afin de les mettre en avant (tag "Nouveau") dans l'affectation.
 */

const STORAGE_KEY = 'recently_approved_housekeepers';
// Durée pendant laquelle une femme de chambre est considérée "nouvelle" (72h)
const NEW_DURATION_MS = 72 * 60 * 60 * 1000;

type NewEntry = { name: string; at: number };

function readEntries(): NewEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as NewEntry[];
    const now = Date.now();
    return parsed.filter((e) => now - e.at < NEW_DURATION_MS);
  } catch {
    return [];
  }
}

function writeEntries(entries: NewEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

/** Marque une femme de chambre comme nouvellement approuvée. */
export function markHousekeeperAsNew(name: string) {
  if (!name) return;
  const entries = readEntries().filter(
    (e) => e.name.toLowerCase() !== name.toLowerCase()
  );
  entries.push({ name, at: Date.now() });
  writeEntries(entries);
}

/** Indique si une femme de chambre est récemment approuvée. */
export function isHousekeeperNew(name: string): boolean {
  if (!name) return false;
  return readEntries().some(
    (e) => e.name.toLowerCase() === name.toLowerCase()
  );
}

/** Retourne l'ensemble des noms récemment approuvés. */
export function getNewHousekeeperNames(): string[] {
  return readEntries().map((e) => e.name);
}
