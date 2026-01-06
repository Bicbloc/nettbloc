// Report-specific translations that work outside of React components
export type ReportLanguage = 'fr' | 'en';

export interface ReportTranslations {
  cleaningType: string;
  fullClean: string;
  fullCleanShort: string;
  quickClean: string;
  quickCleanShort: string;
  numberOfRooms: string;
  total: string;
  estimatedTime: string;
  minutes: string;
  room: string;
  type: string;
  twin: string;
  priority: string;
  notes: string;
  remarks: string;
  floor: string;
  groundFloor: string;
  yes: string;
  no: string;
  high: string;
  normal: string;
  timeTracking: string;
  startTime: string;
  endTime: string;
  instructions: string;
  toDo: string;
  toKnow: string;
  linenInventory: string;
  linenType: string;
  quantity: string;
  verified: string;
  report: string;
  signature: string;
  reportGenerated: string;
  reportDownloaded: string;
  errorGenerating: string;
  errorMessage: string;
}

export const reportTranslations: Record<ReportLanguage, ReportTranslations> = {
  fr: {
    cleaningType: "Type de nettoyage",
    fullClean: "À Blanc",
    fullCleanShort: "CO",
    quickClean: "Recouche",
    quickCleanShort: "SO",
    numberOfRooms: "Nombre de chambres",
    total: "Total",
    estimatedTime: "Temps estimé",
    minutes: "minutes",
    room: "Chambre",
    type: "Type",
    twin: "Twin",
    priority: "Priorité",
    notes: "Notes",
    remarks: "Remarques",
    floor: "Étage",
    groundFloor: "RDC",
    yes: "Oui",
    no: "Non",
    high: "Haute",
    normal: "Normale",
    timeTracking: "Pointage",
    startTime: "Heure de début",
    endTime: "Heure de fin",
    instructions: "Instructions",
    toDo: "À faire",
    toKnow: "À savoir",
    linenInventory: "Inventaire Linge",
    linenType: "Type de linge",
    quantity: "Quantité",
    verified: "Vérifié ✓",
    report: "Rapport",
    signature: "Signature",
    reportGenerated: "Rapport généré",
    reportDownloaded: "Le rapport a été téléchargé.",
    errorGenerating: "Erreur de génération",
    errorMessage: "Une erreur est survenue lors de la génération du rapport.",
  },
  en: {
    cleaningType: "Cleaning type",
    fullClean: "Check-out cleaning",
    fullCleanShort: "CO",
    quickClean: "Stayover cleaning",
    quickCleanShort: "SO",
    numberOfRooms: "Number of rooms",
    total: "Total",
    estimatedTime: "Estimated time",
    minutes: "minutes",
    room: "Room",
    type: "Type",
    twin: "Twin",
    priority: "Priority",
    notes: "Notes",
    remarks: "Remarks",
    floor: "Floor",
    groundFloor: "GF",
    yes: "Yes",
    no: "No",
    high: "High",
    normal: "Normal",
    timeTracking: "Time tracking",
    startTime: "Start time",
    endTime: "End time",
    instructions: "Instructions",
    toDo: "To do",
    toKnow: "To know",
    linenInventory: "Linen Inventory",
    linenType: "Linen type",
    quantity: "Quantity",
    verified: "Verified ✓",
    report: "Report",
    signature: "Signature",
    reportGenerated: "Report generated",
    reportDownloaded: "The report has been downloaded.",
    errorGenerating: "Generation error",
    errorMessage: "An error occurred while generating the report.",
  }
};

export function getReportTranslations(lang: ReportLanguage): ReportTranslations {
  return reportTranslations[lang];
}

// Helper to get current language from localStorage
export function getCurrentReportLanguage(): ReportLanguage {
  const stored = localStorage.getItem('preferred_language');
  if (stored === 'en' || stored === 'fr') {
    return stored;
  }
  return 'fr';
}
