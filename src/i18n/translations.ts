// Type-safe translation structure
type TranslationSchema = {
  common: {
    loading: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    add: string;
    search: string;
    back: string;
    next: string;
    confirm: string;
    close: string;
    yes: string;
    no: string;
    or: string;
    email: string;
    password: string;
    name: string;
    phone: string;
    verification: string;
    loadingEstablishment: string;
  };
  auth: {
    login: string;
    logout: string;
    signup: string;
    forgotPassword: string;
    resetPassword: string;
    noAccount: string;
    hasAccount: string;
    signIn: string;
    signUp: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    namePlaceholder: string;
    confirmPassword: string;
    loginSuccess: string;
    loginError: string;
    signupSuccess: string;
    signupError: string;
    invalidCredentials: string;
    passwordMismatch: string;
    passwordTooShort: string;
    requiredFields: string;
  };
  guestMode: {
    title: string;
    subtitle: string;
    hotelManager: string;
    hotelManagerDesc: string;
    housekeeper: string;
    housekeeperDesc: string;
    quickAccess: string;
    accessCode: string;
    enterAccessCode: string;
  };
  housekeeper: {
    title: string;
    login: string;
    signup: string;
    accessCodeLogin: string;
    enterCode: string;
    myRooms: string;
    noRoomsAssigned: string;
    roomsCompleted: string;
    roomsRemaining: string;
    startCleaning: string;
    finishCleaning: string;
    reportIncident: string;
    profile: string;
    hotels: string;
    requestAccess: string;
    hotelCode: string;
    pendingRequests: string;
    staffArea: string;
  };
  rooms: {
    room: string;
    rooms: string;
    roomNumber: string;
    status: string;
    cleaningType: string;
    cleaningTypeLabel: string;
    fullClean: string;
    fullCleanShort: string;
    quickClean: string;
    quickCleanShort: string;
    noClean: string;
    dirty: string;
    clean: string;
    inspected: string;
    occupied: string;
    vacant: string;
    departure: string;
    arrival: string;
    stayover: string;
    assignedTo: string;
    unassigned: string;
    notes: string;
    addNote: string;
    inProgress: string;
    completed: string;
    remark: string;
    housekeeperComment: string;
    remarkReported: string;
    priority: string;
    priorityHigh: string;
    priorityMedium: string;
    priorityLow: string;
    notUrgent: string;
    linkedRooms: string;
    incidents: string;
    viewIncidents: string;
    link: string;
    linkWithRooms: string;
    deleteRoom: string;
    delete: string;
    addRoom: string;
    editRoom: string;
    floor: string;
    twinRoom: string;
    urgent: string;
    noCleaning: string;
    notesPlaceholder: string;
    selectStatus: string;
    selectPriority: string;
    roomExists: string;
    roomAdded: string;
    roomModified: string;
    modifyRoom: string;
    createRoom: string;
    saveChanges: string;
    addComment: string;
    comment: string;
    markAsClean: string;
    readyToClean: string;
    guestOut: string;
    unassign: string;
    reassignTo: string;
    reassignmentOptions: string;
  };
  dashboard: {
    title: string;
    overview: string;
    rooms: string;
    housekeepers: string;
    reports: string;
    settings: string;
    incidents: string;
    linen: string;
    archives: string;
    todayStats: string;
    totalRooms: string;
    roomsCleaned: string;
    roomsPending: string;
    activeHousekeepers: string;
    assignment: string;
    accessCodes: string;
    training: string;
    invitations: string;
    inspections: string;
    guestMode: string;
    realtimeActive: string;
    disconnected: string;
    linenInventory: string;
    aiTraining: string;
  };
  stats: {
    totalRooms: string;
    toClean: string;
    cleaned: string;
    activeStaff: string;
  };
  hero: {
    welcome: string;
    subtitle: string;
    realtime: string;
    completeSolution: string;
  };
  plans: {
    title: string;
    subtitle: string;
    monthly: string;
    yearly: string;
    perMonth: string;
    perYear: string;
    selectPlan: string;
    currentPlan: string;
    features: string;
    maxRooms: string;
    unlimitedRooms: string;
    basicSupport: string;
    prioritySupport: string;
    firstPaymentOn: string;
    subscribeNow: string;
  };
  notifications: {
    title: string;
    noNotifications: string;
    markAsRead: string;
    markAllAsRead: string;
    roomCompleted: string;
    incidentReported: string;
    accessRequested: string;
  };
  errors: {
    generic: string;
    networkError: string;
    notFound: string;
    unauthorized: string;
    forbidden: string;
    serverError: string;
  };
  toasts: {
    roomCleaned: string;
    roomCleanedDesc: string;
    redistributionDone: string;
    hotelSelected: string;
    reportSent: string;
    reportsCreated: string;
    missingData: string;
    missingInfo: string;
  };
};

export const translations: Record<'fr' | 'en', TranslationSchema> = {
  fr: {
    // Common
    common: {
      loading: "Chargement...",
      save: "Enregistrer",
      cancel: "Annuler",
      delete: "Supprimer",
      edit: "Modifier",
      add: "Ajouter",
      search: "Rechercher",
      back: "Retour",
      next: "Suivant",
      confirm: "Confirmer",
      close: "Fermer",
      yes: "Oui",
      no: "Non",
      or: "ou",
      email: "Email",
      password: "Mot de passe",
      name: "Nom",
      phone: "Téléphone",
      verification: "Vérification...",
      loadingEstablishment: "Chargement de votre établissement...",
    },
    
    // Auth
    auth: {
      login: "Connexion",
      logout: "Déconnexion",
      signup: "Créer un compte",
      forgotPassword: "Mot de passe oublié ?",
      resetPassword: "Réinitialiser le mot de passe",
      noAccount: "Pas encore de compte ?",
      hasAccount: "Déjà un compte ?",
      signIn: "Se connecter",
      signUp: "S'inscrire",
      emailPlaceholder: "votre@email.com",
      passwordPlaceholder: "Votre mot de passe",
      namePlaceholder: "Votre nom",
      confirmPassword: "Confirmer le mot de passe",
      loginSuccess: "Connexion réussie",
      loginError: "Erreur de connexion",
      signupSuccess: "Compte créé avec succès",
      signupError: "Erreur lors de la création du compte",
      invalidCredentials: "Email ou mot de passe incorrect",
      passwordMismatch: "Les mots de passe ne correspondent pas",
      passwordTooShort: "Le mot de passe doit contenir au moins 6 caractères",
      requiredFields: "Veuillez remplir tous les champs obligatoires",
    },
    
    // Guest Mode
    guestMode: {
      title: "Bienvenue",
      subtitle: "Choisissez votre rôle pour continuer",
      hotelManager: "Gestionnaire d'hôtel",
      hotelManagerDesc: "Accédez à votre tableau de bord",
      housekeeper: "Femme de chambre",
      housekeeperDesc: "Consultez vos chambres assignées",
      quickAccess: "Accès rapide",
      accessCode: "Code d'accès",
      enterAccessCode: "Entrez votre code d'accès",
    },
    
    // Housekeeper
    housekeeper: {
      title: "Espace Femme de Chambre",
      login: "Connexion",
      signup: "Créer un compte",
      accessCodeLogin: "Connexion avec code d'accès",
      enterCode: "Entrez votre code",
      myRooms: "Mes chambres",
      noRoomsAssigned: "Aucune chambre assignée",
      roomsCompleted: "Chambres terminées",
      roomsRemaining: "Chambres restantes",
      startCleaning: "Commencer le nettoyage",
      finishCleaning: "Terminer le nettoyage",
      reportIncident: "Signaler un incident",
      profile: "Mon profil",
      hotels: "Mes hôtels",
      requestAccess: "Demander l'accès",
      hotelCode: "Code de l'hôtel",
      pendingRequests: "Demandes en attente",
      staffArea: "Espace Personnel",
    },
    
    // Rooms
    rooms: {
      room: "Chambre",
      rooms: "Chambres",
      roomNumber: "Numéro de chambre",
      status: "Statut",
      cleaningType: "Type de nettoyage",
      cleaningTypeLabel: "Type de nettoyage",
      fullClean: "À blanc",
      fullCleanShort: "B",
      quickClean: "Recouche",
      quickCleanShort: "R",
      noClean: "Aucun",
      dirty: "Sale",
      clean: "Propre",
      inspected: "Inspecté",
      occupied: "Occupé",
      vacant: "Vacant",
      departure: "Départ",
      arrival: "Arrivée",
      stayover: "Recouche",
      assignedTo: "Assignée à",
      unassigned: "Non assignée",
      notes: "Notes",
      addNote: "Ajouter une note",
      inProgress: "En cours",
      completed: "Terminée",
      remark: "Remarque",
      housekeeperComment: "Commentaire femme de chambre",
      remarkReported: "Remarque signalée",
      priority: "Prioritaire",
      priorityHigh: "Haute",
      priorityMedium: "Moyenne",
      priorityLow: "Basse",
      notUrgent: "Pas urgent",
      linkedRooms: "Chambres liées",
      incidents: "Incidents",
      viewIncidents: "Voir les incidents",
      link: "Lier",
      linkWithRooms: "Lier avec d'autres chambres",
      deleteRoom: "Supprimer la chambre",
      delete: "Supprimer",
      addRoom: "Ajouter une chambre",
      editRoom: "Modifier la chambre",
      floor: "Étage",
      twinRoom: "Chambre twin",
      urgent: "Urgent",
      noCleaning: "Aucun nettoyage",
      notesPlaceholder: "Remarques ou informations supplémentaires...",
      selectStatus: "Sélectionnez le statut",
      selectPriority: "Sélectionnez la priorité",
      roomExists: "Une chambre avec ce numéro existe déjà",
      roomAdded: "Chambre ajoutée avec succès",
      roomModified: "Chambre modifiée avec succès",
      modifyRoom: "Modifiez les détails de cette chambre",
      createRoom: "Créez une nouvelle chambre si les données PDF ne sont pas correctement récupérées",
      saveChanges: "Sauvegarder les modifications",
      addComment: "Ajouter un commentaire",
      comment: "Commentaire",
      markAsClean: "Marquer comme propre",
      readyToClean: "Prêt à nettoyer",
      guestOut: "Client sorti - Prêt à nettoyer",
      unassign: "Désassigner",
      reassignTo: "Réassigner à",
      reassignmentOptions: "Options de réassignation",
    },
    
    // Dashboard
    dashboard: {
      title: "Tableau de bord",
      overview: "Vue d'ensemble",
      rooms: "Chambres",
      housekeepers: "Femmes de chambre",
      reports: "Rapports",
      settings: "Paramètres",
      incidents: "Incidents",
      linen: "Linge",
      archives: "Archives",
      todayStats: "Statistiques du jour",
      totalRooms: "Total chambres",
      roomsCleaned: "Chambres nettoyées",
      roomsPending: "Chambres en attente",
      activeHousekeepers: "Femmes de chambre actives",
      assignment: "Affectation",
      accessCodes: "Codes d'accès",
      training: "Entraînement IA",
      invitations: "Invitations",
      inspections: "Inspections",
      guestMode: "Mode Invité",
      realtimeActive: "Temps réel actif",
      disconnected: "Déconnecté",
      linenInventory: "Inventaire Linge",
      aiTraining: "Entraînement IA",
    },
    
    // Stats
    stats: {
      totalRooms: "Chambres totales",
      toClean: "À nettoyer",
      cleaned: "Nettoyées",
      activeStaff: "Personnel actif",
    },
    
    // Hero
    hero: {
      welcome: "Bienvenue",
      subtitle: "Gérez votre établissement avec efficacité. Assignation automatique, suivi en temps réel, et rapports détaillés.",
      realtime: "Temps réel",
      completeSolution: "Solution complète",
    },
    
    // Plans
    plans: {
      title: "Choisissez votre plan",
      subtitle: "Sélectionnez le plan adapté à vos besoins",
      monthly: "Mensuel",
      yearly: "Annuel",
      perMonth: "/mois",
      perYear: "/an",
      selectPlan: "Sélectionner ce plan",
      currentPlan: "Plan actuel",
      features: "Fonctionnalités",
      maxRooms: "Jusqu'à {count} chambres",
      unlimitedRooms: "Chambres illimitées",
      basicSupport: "Support basique",
      prioritySupport: "Support prioritaire",
      firstPaymentOn: "Premier prélèvement le",
      subscribeNow: "S'abonner maintenant",
    },
    
    // Notifications
    notifications: {
      title: "Notifications",
      noNotifications: "Aucune notification",
      markAsRead: "Marquer comme lu",
      markAllAsRead: "Tout marquer comme lu",
      roomCompleted: "Chambre terminée",
      incidentReported: "Incident signalé",
      accessRequested: "Demande d'accès",
    },
    
    // Errors
    errors: {
      generic: "Une erreur s'est produite",
      networkError: "Erreur de connexion",
      notFound: "Page non trouvée",
      unauthorized: "Non autorisé",
      forbidden: "Accès interdit",
      serverError: "Erreur serveur",
    },
    
    // Toasts
    toasts: {
      roomCleaned: "Chambre nettoyée",
      roomCleanedDesc: "Chambre {room} marquée propre",
      redistributionDone: "Redistribution terminée",
      hotelSelected: "Hôtel sélectionné",
      reportSent: "Rapport envoyé",
      reportsCreated: "Rapports créés",
      missingData: "Données manquantes",
      missingInfo: "Informations manquantes",
    },
  },
  
  en: {
    // Common
    common: {
      loading: "Loading...",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      add: "Add",
      search: "Search",
      back: "Back",
      next: "Next",
      confirm: "Confirm",
      close: "Close",
      yes: "Yes",
      no: "No",
      or: "or",
      email: "Email",
      password: "Password",
      name: "Name",
      phone: "Phone",
      verification: "Verifying...",
      loadingEstablishment: "Loading your establishment...",
    },
    
    // Auth
    auth: {
      login: "Login",
      logout: "Logout",
      signup: "Create account",
      forgotPassword: "Forgot password?",
      resetPassword: "Reset password",
      noAccount: "Don't have an account?",
      hasAccount: "Already have an account?",
      signIn: "Sign in",
      signUp: "Sign up",
      emailPlaceholder: "your@email.com",
      passwordPlaceholder: "Your password",
      namePlaceholder: "Your name",
      confirmPassword: "Confirm password",
      loginSuccess: "Login successful",
      loginError: "Login error",
      signupSuccess: "Account created successfully",
      signupError: "Error creating account",
      invalidCredentials: "Invalid email or password",
      passwordMismatch: "Passwords do not match",
      passwordTooShort: "Password must be at least 6 characters",
      requiredFields: "Please fill in all required fields",
    },
    
    // Guest Mode
    guestMode: {
      title: "Welcome",
      subtitle: "Choose your role to continue",
      hotelManager: "Hotel Manager",
      hotelManagerDesc: "Access your dashboard",
      housekeeper: "Housekeeper",
      housekeeperDesc: "View your assigned rooms",
      quickAccess: "Quick access",
      accessCode: "Access code",
      enterAccessCode: "Enter your access code",
    },
    
    // Housekeeper
    housekeeper: {
      title: "Housekeeper Area",
      login: "Login",
      signup: "Create account",
      accessCodeLogin: "Login with access code",
      enterCode: "Enter your code",
      myRooms: "My rooms",
      noRoomsAssigned: "No rooms assigned",
      roomsCompleted: "Rooms completed",
      roomsRemaining: "Rooms remaining",
      startCleaning: "Start cleaning",
      finishCleaning: "Finish cleaning",
      reportIncident: "Report incident",
      profile: "My profile",
      hotels: "My hotels",
      requestAccess: "Request access",
      hotelCode: "Hotel code",
      pendingRequests: "Pending requests",
      staffArea: "Staff Area",
    },
    
    // Rooms
    rooms: {
      room: "Room",
      rooms: "Rooms",
      roomNumber: "Room number",
      status: "Status",
      cleaningType: "Cleaning type",
      cleaningTypeLabel: "Cleaning type",
      fullClean: "Check-out cleaning",
      fullCleanShort: "CO",
      quickClean: "Stayover cleaning",
      quickCleanShort: "SO",
      noClean: "None",
      dirty: "Dirty",
      clean: "Clean",
      inspected: "Inspected",
      occupied: "Occupied",
      vacant: "Vacant",
      departure: "Departure",
      arrival: "Arrival",
      stayover: "Stayover",
      assignedTo: "Assigned to",
      unassigned: "Unassigned",
      notes: "Notes",
      addNote: "Add note",
      inProgress: "In progress",
      completed: "Completed",
      remark: "Remark",
      housekeeperComment: "Housekeeper comment",
      remarkReported: "Reported remark",
      priority: "Priority",
      priorityHigh: "High",
      priorityMedium: "Medium",
      priorityLow: "Low",
      notUrgent: "Not urgent",
      linkedRooms: "Linked rooms",
      incidents: "Incidents",
      viewIncidents: "View incidents",
      link: "Link",
      linkWithRooms: "Link with other rooms",
      deleteRoom: "Delete room",
      delete: "Delete",
      addRoom: "Add a room",
      editRoom: "Edit room",
      floor: "Floor",
      twinRoom: "Twin room",
      urgent: "Urgent",
      noCleaning: "No cleaning",
      notesPlaceholder: "Remarks or additional information...",
      selectStatus: "Select status",
      selectPriority: "Select priority",
      roomExists: "A room with this number already exists",
      roomAdded: "Room added successfully",
      roomModified: "Room modified successfully",
      modifyRoom: "Modify room details",
      createRoom: "Create a new room if PDF data is not correctly retrieved",
      saveChanges: "Save changes",
      addComment: "Add a comment",
      comment: "Comment",
      markAsClean: "Mark as clean",
      readyToClean: "Ready to clean",
      guestOut: "Guest out - Ready to clean",
      unassign: "Unassign",
      reassignTo: "Reassign to",
      reassignmentOptions: "Reassignment options",
    },
    
    // Dashboard
    dashboard: {
      title: "Dashboard",
      overview: "Overview",
      rooms: "Rooms",
      housekeepers: "Housekeepers",
      reports: "Reports",
      settings: "Settings",
      incidents: "Incidents",
      linen: "Linen",
      archives: "Archives",
      todayStats: "Today's statistics",
      totalRooms: "Total rooms",
      roomsCleaned: "Rooms cleaned",
      roomsPending: "Rooms pending",
      activeHousekeepers: "Active housekeepers",
      assignment: "Assignment",
      accessCodes: "Access Codes",
      training: "AI Training",
      invitations: "Invitations",
      inspections: "Inspections",
      guestMode: "Guest Mode",
      realtimeActive: "Realtime active",
      disconnected: "Disconnected",
      linenInventory: "Linen Inventory",
      aiTraining: "AI Training",
    },
    
    // Stats
    stats: {
      totalRooms: "Total rooms",
      toClean: "To clean",
      cleaned: "Cleaned",
      activeStaff: "Active staff",
    },
    
    // Hero
    hero: {
      welcome: "Welcome",
      subtitle: "Manage your establishment efficiently. Automatic assignment, real-time tracking, and detailed reports.",
      realtime: "Real-time",
      completeSolution: "Complete solution",
    },
    
    // Plans
    plans: {
      title: "Choose your plan",
      subtitle: "Select the plan that suits your needs",
      monthly: "Monthly",
      yearly: "Yearly",
      perMonth: "/month",
      perYear: "/year",
      selectPlan: "Select this plan",
      currentPlan: "Current plan",
      features: "Features",
      maxRooms: "Up to {count} rooms",
      unlimitedRooms: "Unlimited rooms",
      basicSupport: "Basic support",
      prioritySupport: "Priority support",
      firstPaymentOn: "First payment on",
      subscribeNow: "Subscribe now",
    },
    
    // Notifications
    notifications: {
      title: "Notifications",
      noNotifications: "No notifications",
      markAsRead: "Mark as read",
      markAllAsRead: "Mark all as read",
      roomCompleted: "Room completed",
      incidentReported: "Incident reported",
      accessRequested: "Access requested",
    },
    
    // Errors
    errors: {
      generic: "An error occurred",
      networkError: "Connection error",
      notFound: "Page not found",
      unauthorized: "Unauthorized",
      forbidden: "Access forbidden",
      serverError: "Server error",
    },
    
    // Toasts
    toasts: {
      roomCleaned: "Room cleaned",
      roomCleanedDesc: "Room {room} marked clean",
      redistributionDone: "Redistribution complete",
      hotelSelected: "Hotel selected",
      reportSent: "Report sent",
      reportsCreated: "Reports created",
      missingData: "Missing data",
      missingInfo: "Missing information",
    },
  },
};

export type Language = keyof typeof translations;
export type TranslationKeys = TranslationSchema;
