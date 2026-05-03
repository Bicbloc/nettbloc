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
  // Daily closure report
  closureReport: string;
  totalRoomsLabel: string;
  cleanRoomsLabel: string;
  inProgressRoomsLabel: string;
  toCleanLabel: string;
  staffLabel: string;
  dailyInstructionsTitle: string;
  instructionsLabel: string;
  toKnowLabel: string;
  toDoLabel: string;
  dailyTasksTitle: string;
  taskLabel: string;
  assignedToLabel: string;
  statusLabel: string;
  allStaffLabel: string;
  doneLabel: string;
  pendingLabel: string;
  actionsLogTitle: string;
  timeLabel: string;
  actorLabel: string;
  actionLabel: string;
  roomsCountLabel: string;
  statusCompleted: string;
  statusInProgress: string;
  statusPending: string;
  startLabel: string;
  endLabel: string;
  generatedFooter: string;
  locale: string;
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
    closureReport: "Rapport de Clôture",
    totalRoomsLabel: "Total chambres",
    cleanRoomsLabel: "Propres",
    inProgressRoomsLabel: "En cours",
    toCleanLabel: "À nettoyer",
    staffLabel: "Personnel",
    dailyInstructionsTitle: "Consignes du jour",
    instructionsLabel: "Instructions",
    toKnowLabel: "À savoir",
    toDoLabel: "À faire",
    dailyTasksTitle: "Tâches du jour",
    taskLabel: "Tâche",
    assignedToLabel: "Assignée à",
    statusLabel: "Statut",
    allStaffLabel: "Tout le personnel",
    doneLabel: "Fait",
    pendingLabel: "En attente",
    actionsLogTitle: "Journal des Actions",
    timeLabel: "Heure",
    actorLabel: "Acteur",
    actionLabel: "Action",
    roomsCountLabel: "chambres",
    statusCompleted: "Terminé",
    statusInProgress: "En cours",
    statusPending: "En attente",
    startLabel: "Début",
    endLabel: "Fin",
    generatedFooter: "Généré automatiquement lors de la clôture de journée",
    locale: "fr-FR",
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
    closureReport: "Daily Closure Report",
    totalRoomsLabel: "Total rooms",
    cleanRoomsLabel: "Clean",
    inProgressRoomsLabel: "In progress",
    toCleanLabel: "To clean",
    staffLabel: "Staff",
    dailyInstructionsTitle: "Daily instructions",
    instructionsLabel: "Instructions",
    toKnowLabel: "To know",
    toDoLabel: "To do",
    dailyTasksTitle: "Daily tasks",
    taskLabel: "Task",
    assignedToLabel: "Assigned to",
    statusLabel: "Status",
    allStaffLabel: "All staff",
    doneLabel: "Done",
    pendingLabel: "Pending",
    actionsLogTitle: "Actions Log",
    timeLabel: "Time",
    actorLabel: "Actor",
    actionLabel: "Action",
    roomsCountLabel: "rooms",
    statusCompleted: "Completed",
    statusInProgress: "In progress",
    statusPending: "Pending",
    startLabel: "Start",
    endLabel: "End",
    generatedFooter: "Generated automatically at end-of-day closure",
    locale: "en-US",
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
