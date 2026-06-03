/**
 * FeatureTour
 * Tutoriel guidé affiché à la première connexion d'un compte.
 * Met en surbrillance (spotlight) chaque fonctionnalité réelle dans le menu,
 * pointe dessus avec une infobulle et explique précisément comment faire.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Layers, Bed, UserIcon, Key, AlertTriangle, FileText,
  Archive, ClipboardCheck, Package, Repeat, TicketCheck,
  Sparkles, ArrowRight, ArrowLeft, X, Check, Settings, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TabValue } from "@/components/layout";

const TOUR_FLAG_PREFIX = "feature_tour_done_";

export const isFeatureTourDone = (hotelId?: string | null) => {
  if (!hotelId) return true;
  return localStorage.getItem(TOUR_FLAG_PREFIX + hotelId) === "true";
};

export const markFeatureTourDone = (hotelId?: string | null) => {
  if (!hotelId) return;
  localStorage.setItem(TOUR_FLAG_PREFIX + hotelId, "true");
};

interface TourStep {
  tab?: TabValue;
  /** Sélecteur CSS de l'élément réel à mettre en surbrillance */
  target?: string;
  icon: React.ReactNode;
  badge?: { fr: string; en: string };
  title: { fr: string; en: string };
  /** Rôle de la fonctionnalité : à quoi elle sert, en une phrase */
  role?: { fr: string; en: string };
  desc: { fr: string; en: string };
  /** Étapes concrètes « comment faire » affichées en liste à puces */
  tips?: { fr: string[]; en: string[] };
  /** Action optionnelle : ouvre une autre page guidée */
  action?: { label: { fr: string; en: string }; to: string };
}

const STEPS: TourStep[] = [
  {
    icon: <Sparkles className="h-6 w-6" />,
    title: { fr: "Bienvenue sur Nettobloc 👋", en: "Welcome to Nettobloc 👋" },
    desc: {
      fr: "Nettobloc pilote tout le ménage de votre établissement : import du planning, affectation des chambres, suivi en temps réel, incidents, linge et rapports. Ce tutoriel détaillé vous explique le rôle de chaque fonctionnalité et comment l'utiliser, étape par étape. Une flèche pointe l'élément concerné dans le menu. Vous pouvez passer ou revenir en arrière à tout moment.",
      en: "Nettobloc runs all housekeeping for your property: schedule import, room assignment, real-time tracking, incidents, linen and reports. This detailed tutorial explains the role of each feature and how to use it, step by step. An arrow points at the relevant menu item. You can skip or go back anytime.",
    },
  },
  {
    tab: "access-codes",
    target: '[data-tour="nav-access-codes"]',
    icon: <Key className="h-6 w-6" />,
    badge: { fr: "1re chose à faire", en: "Do this first" },
    title: { fr: "Codes d'accès — Invitez vos employés", en: "Access codes — Invite your staff" },
    role: {
      fr: "Permet à votre équipe terrain de se connecter sans créer de compte ni mot de passe.",
      en: "Lets your field team log in without creating an account or password.",
    },
    desc: {
      fr: "C'est le point de départ : sans employés connectés, vous ne pouvez pas affecter de chambres. Chaque rôle (femme de chambre, gouvernante, technicien) a sa propre couleur et ses propres droits. Le code reste valable et peut être régénéré si besoin.",
      en: "This is the starting point: without connected staff you can't assign rooms. Each role (housekeeper, governess, technician) has its own color and permissions. The code stays valid and can be regenerated if needed.",
    },
    tips: {
      fr: [
        "Cliquez sur « Générer un code » pour le rôle voulu.",
        "Transmettez le code à la personne (SMS, papier, oral).",
        "Elle ouvre l'app terrain et saisit le code pour se connecter.",
        "Régénérez un code à tout moment pour révoquer un accès.",
      ],
      en: [
        "Click \"Generate a code\" for the desired role.",
        "Share the code with the person (SMS, paper, verbally).",
        "They open the field app and enter the code to log in.",
        "Regenerate a code anytime to revoke access.",
      ],
    },
  },
  {
    tab: "rooms",
    target: '[data-tour="nav-rooms"]',
    icon: <Bed className="h-6 w-6" />,
    badge: { fr: "Configuration", en: "Setup" },
    title: { fr: "Gestion des chambres — Entraîner l'import PDF", en: "Room management — Train the PDF import" },
    role: {
      fr: "Apprend à Nettobloc à lire le rapport PDF de votre PMS pour créer les chambres automatiquement.",
      en: "Teaches Nettobloc to read your PMS PDF report and create rooms automatically.",
    },
    desc: {
      fr: "Au lieu de saisir les chambres à la main chaque matin, vous importez le PDF de votre PMS et Nettobloc en extrait le numéro, l'étage et le statut (À blanc/départ, Recouche/stayover…). L'entraînement ne se fait qu'une seule fois par type de rapport : ensuite tous les PDF identiques sont lus automatiquement.",
      en: "Instead of typing rooms by hand every morning, you import your PMS PDF and Nettobloc extracts the number, floor and status (check-out, stayover…). Training is done only once per report type: afterwards all identical PDFs are read automatically.",
    },
    tips: {
      fr: [
        "Ouvrez Gestion des chambres › Config avancée › Entraîner le PDF.",
        "Importez un exemple de rapport de votre PMS.",
        "Vérifiez et corrigez une fois les colonnes détectées.",
        "Enregistrez : le modèle s'applique à tous vos futurs PDF.",
      ],
      en: [
        "Open Room management › Advanced config › Train PDF.",
        "Import a sample report from your PMS.",
        "Check and correct the detected columns once.",
        "Save: the model applies to all your future PDFs.",
      ],
    },
  },
  {
    tab: "assignment",
    target: '[data-tour="nav-assignment"]',
    icon: <UserIcon className="h-6 w-6" />,
    title: { fr: "Affectations — Répartir le travail", en: "Assignments — Distribute the work" },
    role: {
      fr: "Attribue les chambres du jour aux femmes de chambre, automatiquement ou manuellement.",
      en: "Assigns the day's rooms to housekeepers, automatically or manually.",
    },
    desc: {
      fr: "Une fois les chambres importées, vous décidez qui nettoie quoi. Le mode automatique équilibre la charge selon le nombre de chambres et le type de ménage (les recouches sont plus rapides qu'un départ). Le mode manuel vous laisse le contrôle total, utile pour les étages ou les habitudes de chacune.",
      en: "Once rooms are imported, you decide who cleans what. Automatic mode balances the load by room count and cleaning type (stayovers are faster than check-outs). Manual mode gives you full control, handy for floors or each person's habits.",
    },
    tips: {
      fr: [
        "Automatique : cliquez sur « Distribuer », l'app répartit équitablement.",
        "Manuel : sélectionnez des chambres et attribuez-les à une personne.",
        "Réajustez en glissant une chambre vers une autre employée.",
        "Les affectations sont visibles instantanément côté terrain.",
      ],
      en: [
        "Automatic: click \"Distribute\", the app splits fairly.",
        "Manual: select rooms and assign them to a person.",
        "Readjust by moving a room to another staff member.",
        "Assignments appear instantly on the field side.",
      ],
    },
  },
  {
    tab: "incidents",
    target: '[data-tour="nav-incidents"]',
    icon: <AlertTriangle className="h-6 w-6" />,
    title: { fr: "Incidents — Signaler un problème", en: "Incidents — Report a problem" },
    role: {
      fr: "Centralise les problèmes constatés dans les chambres et suit leur résolution.",
      en: "Centralizes problems found in rooms and tracks their resolution.",
    },
    desc: {
      fr: "Équipement cassé, dégât, anomalie : chaque incident est tracé avec une photo, la chambre concernée et une description. Cela évite les oublis, permet d'alerter le technicien et garde un historique pour la maintenance et les litiges clients.",
      en: "Broken equipment, damage, anomaly: each incident is logged with a photo, the room and a description. This avoids forgetting, lets you alert the technician and keeps a history for maintenance and guest disputes.",
    },
    tips: {
      fr: [
        "Ouvrez Incidents › « Nouvel incident ».",
        "Choisissez la chambre et décrivez le problème.",
        "Ajoutez une photo pour documenter.",
        "Suivez le statut jusqu'à la résolution.",
      ],
      en: [
        "Open Incidents › \"New incident\".",
        "Pick the room and describe the problem.",
        "Add a photo to document it.",
        "Track the status until it's resolved.",
      ],
    },
  },
  {
    tab: "reports",
    target: '[data-tour="nav-reports"]',
    icon: <FileText className="h-6 w-6" />,
    title: { fr: "Rapports — Suivre et imprimer l'activité", en: "Reports — Track and print activity" },
    role: {
      fr: "Génère un récapitulatif PDF de la journée : chambres faites, temps, incidents.",
      en: "Generates a PDF summary of the day: rooms done, time, incidents.",
    },
    desc: {
      fr: "Le rapport synthétise le travail accompli pour la direction ou l'archivage. Vous pouvez le télécharger pour l'imprimer ou l'envoyer par e-mail. Les journées passées restent accessibles dans Archives.",
      en: "The report summarizes the work done for management or archiving. You can download it to print or send by email. Past days stay available in Archives.",
    },
    tips: {
      fr: [
        "Choisissez la date du rapport.",
        "Cliquez sur « Générer » pour créer le PDF.",
        "« Télécharger » pour imprimer, ou « Envoyer par e-mail ».",
      ],
      en: [
        "Pick the report date.",
        "Click \"Generate\" to build the PDF.",
        "\"Download\" to print, or \"Send by email\".",
      ],
    },
  },
  {
    tab: "linen",
    target: '[data-tour="nav-linen"]',
    icon: <span className="text-2xl">🧺</span>,
    title: { fr: "Linge — Inventaire assisté par IA", en: "Linen — AI-assisted inventory" },
    role: {
      fr: "Compte et suit votre stock de linge pour anticiper les commandes.",
      en: "Counts and tracks your linen stock to anticipate orders.",
    },
    desc: {
      fr: "Plus besoin de compter draps et serviettes un par un : photographiez la pile, l'IA reconnaît et compte les articles, puis vous validez. Le stock se met à jour automatiquement, ce qui vous aide à savoir quand recommander.",
      en: "No more counting sheets and towels one by one: photograph the stack, the AI recognizes and counts items, then you confirm. Stock updates automatically, helping you know when to reorder.",
    },
    tips: {
      fr: [
        "Prenez une photo de la pile de linge.",
        "Vérifiez le comptage proposé par l'IA et ajustez si besoin.",
        "Validez : le stock est mis à jour automatiquement.",
      ],
      en: [
        "Take a photo of the linen stack.",
        "Check the AI count and adjust if needed.",
        "Confirm: stock is updated automatically.",
      ],
    },
  },
  {
    tab: "lost-found",
    target: '[data-tour="nav-lost-found"]',
    icon: <Package className="h-6 w-6" />,
    title: { fr: "Objets trouvés — Suivre les oublis clients", en: "Lost & found — Track guest items" },
    role: {
      fr: "Garde la trace des objets oubliés pour les restituer aux clients.",
      en: "Keeps track of forgotten items to return them to guests.",
    },
    desc: {
      fr: "Quand un objet est trouvé dans une chambre, enregistrez-le avec une photo, la chambre et une description ; l'IA aide à l'identifier. L'historique complet facilite la restitution quand un client réclame son bien.",
      en: "When an item is found in a room, log it with a photo, the room and a description; the AI helps identify it. The full history makes returning items easy when a guest claims them.",
    },
    tips: {
      fr: [
        "Cliquez sur « Nouvel objet trouvé ».",
        "Ajoutez photo, chambre et description.",
        "Recherchez dans l'historique pour retrouver un objet.",
      ],
      en: [
        "Click \"New found item\".",
        "Add photo, room and description.",
        "Search the history to find an item.",
      ],
    },
  },
  {
    tab: "tickets",
    target: '[data-tour="nav-tickets"]',
    icon: <TicketCheck className="h-6 w-6" />,
    title: { fr: "Tickets & tâches — Le travail ponctuel", en: "Tickets & tasks — One-off work" },
    role: {
      fr: "Crée des tâches ponctuelles hors ménage courant et suit leur avancement.",
      en: "Creates one-off tasks outside daily cleaning and tracks progress.",
    },
    desc: {
      fr: "Pour tout ce qui n'est pas une chambre à nettoyer (réassort, demande spéciale, vérification) : créez un ticket, assignez-le et suivez son statut (à faire, en cours, terminé) pour que rien ne se perde.",
      en: "For anything that isn't a room to clean (restock, special request, check): create a ticket, assign it and track its status (to do, in progress, done) so nothing slips through.",
    },
    tips: {
      fr: [
        "Créez un ticket et décrivez la tâche.",
        "Assignez-le à un membre de l'équipe.",
        "Suivez l'avancement jusqu'à « Terminé ».",
      ],
      en: [
        "Create a ticket and describe the task.",
        "Assign it to a team member.",
        "Track progress until \"Done\".",
      ],
    },
  },
  {
    tab: "inspections",
    target: '[data-tour="nav-inspections"]',
    icon: <ClipboardCheck className="h-6 w-6" />,
    title: { fr: "Inspections — Contrôle qualité", en: "Inspections — Quality control" },
    role: {
      fr: "Permet à la gouvernante de valider la qualité du nettoyage chambre par chambre.",
      en: "Lets the governess validate cleaning quality room by room.",
    },
    desc: {
      fr: "Après le ménage, la gouvernante contrôle chaque chambre et la valide, ou la renvoie pour correction avec un commentaire. C'est le garant de la qualité avant de remettre la chambre en vente.",
      en: "After cleaning, the governess checks each room and validates it, or sends it back for correction with a comment. It's the quality gate before putting the room back on sale.",
    },
    tips: {
      fr: [
        "La gouvernante ouvre la chambre nettoyée.",
        "Elle valide, ou renvoie avec un commentaire.",
        "Le statut de la chambre est mis à jour en temps réel.",
      ],
      en: [
        "The governess opens the cleaned room.",
        "She validates, or sends it back with a comment.",
        "The room status updates in real time.",
      ],
    },
  },
  {
    tab: "templates",
    target: '[data-tour="nav-templates"]',
    icon: <Repeat className="h-6 w-6" />,
    title: { fr: "Templates — Consignes récurrentes", en: "Templates — Recurring instructions" },
    role: {
      fr: "Automatise les consignes et tâches qui reviennent chaque jour.",
      en: "Automates instructions and tasks that recur every day.",
    },
    desc: {
      fr: "Plutôt que de retaper les mêmes consignes chaque matin (ex. « vérifier le minibar le lundi »), créez un modèle : il s'applique automatiquement aux jours choisis et apparaît côté terrain sans intervention.",
      en: "Rather than retyping the same instructions every morning (e.g. \"check the minibar on Mondays\"), create a template: it applies automatically on the chosen days and appears on the field side with no action needed.",
    },
    tips: {
      fr: [
        "Créez un modèle d'instruction ou de tâche.",
        "Choisissez les jours d'application.",
        "Il se déclenche automatiquement chaque jour concerné.",
      ],
      en: [
        "Create an instruction or task template.",
        "Choose the days it applies to.",
        "It triggers automatically on each relevant day.",
      ],
    },
  },
  {
    tab: "overview",
    target: '[data-tour="nav-overview"]',
    icon: <Layers className="h-6 w-6" />,
    title: { fr: "Vue d'ensemble — Votre tableau de bord", en: "Overview — Your dashboard" },
    role: {
      fr: "Le centre de pilotage quotidien : import, état des chambres et distribution.",
      en: "The daily control center: import, room status and distribution.",
    },
    desc: {
      fr: "C'est l'écran que vous ouvrez chaque matin : importez le PDF du jour, visualisez l'état de toutes les chambres en temps réel (à faire, en cours, terminé, inspecté) et lancez la distribution du travail d'un seul endroit.",
      en: "This is the screen you open each morning: import today's PDF, see all room statuses in real time (to do, in progress, done, inspected) and launch work distribution from one place.",
    },
    tips: {
      fr: [
        "Importez le rapport PDF du jour.",
        "Suivez l'état des chambres en direct.",
        "Lancez la distribution depuis cet écran.",
      ],
      en: [
        "Import today's PDF report.",
        "Track room status live.",
        "Launch distribution from this screen.",
      ],
    },
  },
  {
    tab: "archives",
    target: '[data-tour="nav-archives"]',
    icon: <Archive className="h-6 w-6" />,
    title: { fr: "Archives — L'historique", en: "Archives — The history" },
    role: {
      fr: "Conserve toutes vos journées et rapports passés.",
      en: "Keeps all your past days and reports.",
    },
    desc: {
      fr: "Chaque journée clôturée est archivée : vous pouvez la rouvrir pour consulter les chambres, les temps et les rapports d'une date précise. Utile pour le suivi sur la durée et les justificatifs.",
      en: "Each closed day is archived: you can reopen it to review rooms, times and reports for a specific date. Useful for long-term tracking and records.",
    },
    tips: {
      fr: [
        "Choisissez une date passée.",
        "Consultez les chambres et rapports de ce jour.",
      ],
      en: [
        "Pick a past date.",
        "Review that day's rooms and reports.",
      ],
    },
  },
  {
    target: '[data-tour="user-menu"]',
    icon: <Settings className="h-6 w-6" />,
    title: { fr: "Paramètres — Configurer votre compte", en: "Settings — Configure your account" },
    role: {
      fr: "Centralise les réglages de l'établissement et du compte.",
      en: "Centralizes establishment and account settings.",
    },
    desc: {
      fr: "Cliquez sur votre avatar en haut à droite pour ouvrir le menu. « Paramètres » vous permet de modifier le nom de l'établissement, la langue de l'interface, les options du compte et les préférences de l'hôtel.",
      en: "Click your avatar at the top right to open the menu. \"Settings\" lets you change the establishment name, interface language, account options and hotel preferences.",
    },
    tips: {
      fr: [
        "Ouvrez l'avatar en haut à droite.",
        "Cliquez sur « Paramètres ».",
        "Ajustez nom, langue et préférences.",
      ],
      en: [
        "Open the avatar at the top right.",
        "Click \"Settings\".",
        "Adjust name, language and preferences.",
      ],
    },
  },
  {
    target: '[data-tour="user-menu"]',
    icon: <Building2 className="h-6 w-6" />,
    title: { fr: "Registre des chambres — La base de référence", en: "Room registry — The reference base" },
    role: {
      fr: "La liste permanente de toutes vos chambres et espaces.",
      en: "The permanent list of all your rooms and spaces.",
    },
    desc: {
      fr: "Accessible depuis votre avatar › « Registre des chambres », c'est le référentiel qui sert aux affectations et aux imports PDF. Vous y ajoutez vos chambres/espaces, les organisez par étage et catégorie, et créez un plan visuel de l'établissement.",
      en: "Accessible from your avatar › \"Room registry\", it's the reference that feeds assignments and PDF imports. You add your rooms/spaces, organize them by floor and category, and build a visual plan of the property.",
    },
    action: {
      label: { fr: "Ouvrir le registre & voir comment faire", en: "Open registry & show me how" },
      to: "/room-registry?tour=1",
    },
  },
  {
    icon: <Check className="h-6 w-6" />,
    title: { fr: "Vous êtes prêt ! 🎉", en: "You're all set! 🎉" },
    desc: {
      fr: "Récapitulatif des 3 étapes essentielles pour démarrer : 1) invitez vos employés (codes d'accès), 2) entraînez l'import PDF, 3) importez puis affectez les chambres. Le reste (incidents, linge, rapports…) se gère au quotidien. Vous pouvez rejouer ce tutoriel à tout moment depuis le menu. Bon travail avec Nettobloc !",
      en: "Recap of the 3 essential steps to start: 1) invite your staff (access codes), 2) train the PDF import, 3) import then assign rooms. The rest (incidents, linen, reports…) is daily work. You can replay this tutorial anytime from the menu. Enjoy Nettobloc!",
    },
  },
];

interface FeatureTourProps {
  isOpen: boolean;
  onTabChange: (tab: TabValue) => void;
  onClose: () => void;
  /** Étape de départ (permet de revoir directement une fonctionnalité) */
  initialStep?: number;
}

interface Rect { top: number; left: number; width: number; height: number; }

/** Liste des sujets sélectionnables pour le menu « revoir une fonctionnalité » */
export const TOUR_TOPICS = STEPS.map((s, i) => ({
  index: i,
  title: s.title,
  icon: s.icon,
}));

export function FeatureTour({ isOpen, onTabChange, onClose, initialStep = 0 }: FeatureTourProps) {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const lang = language === "fr" ? "fr" : "en";
  const [index, setIndex] = useState(initialStep);
  const [rect, setRect] = useState<Rect | null>(null);

  // Se positionner sur l'étape demandée à chaque ouverture
  useEffect(() => {
    if (isOpen) setIndex(initialStep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialStep]);

  const step = STEPS[index];
  const total = STEPS.length;
  const isLast = index === total - 1;

  // Changer d'onglet à chaque étape
  useEffect(() => {
    if (isOpen && step?.tab) {
      onTabChange(step.tab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, isOpen]);

  // Localiser et suivre l'élément cible (avec quelques tentatives le temps du rendu)
  const measure = useCallback(() => {
    if (!step?.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.target) as HTMLElement | null;
    if (el) {
      const r = el.getBoundingClientRect();
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    } else {
      setRect(null);
    }
  }, [step]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    let tries = 0;
    measure();
    const id = window.setInterval(() => {
      tries += 1;
      measure();
      if (tries > 6) window.clearInterval(id);
    }, 120);
    return () => window.clearInterval(id);
  }, [isOpen, index, measure]);

  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [isOpen, measure]);

  const finish = () => onClose();
  const next = () => { if (isLast) finish(); else setIndex((i) => i + 1); };
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  // Position de l'infobulle par rapport à la cible
  const tooltipStyle = useMemo<React.CSSProperties>(() => {
    const CARD_W = 380;
    const GAP = 16;
    const MAX_H = "calc(100vh - 24px)";
    if (!rect) {
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: CARD_W, maxWidth: "calc(100vw - 24px)", maxHeight: MAX_H };
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Privilégier le côté droit (menu à gauche), sinon à gauche
    let left = rect.left + rect.width + GAP;
    if (left + CARD_W > vw - 12) {
      left = Math.max(12, rect.left - CARD_W - GAP);
    }
    let top = rect.top;
    top = Math.min(top, vh - 320);
    top = Math.max(12, top);
    return { top, left, width: CARD_W, maxWidth: "calc(100vw - 24px)", maxHeight: MAX_H };
  }, [rect]);

  const content = useMemo(() => {
    if (!isOpen || !step) return null;

    const pad = 8;
    const spotlight = rect
      ? {
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
        }
      : null;

    return (
      <div className="fixed inset-0 z-[200] pointer-events-none">
        {/* Voile très léger (pas de flou) — la page reste lisible */}
        <div
          className="absolute inset-0 transition-all duration-300 pointer-events-auto"
          style={{
            background: "hsl(var(--foreground) / 0.12)",
            ...(spotlight
              ? {
                  clipPath: `polygon(
                    0 0, 100% 0, 100% 100%, 0 100%, 0 0,
                    ${spotlight.left}px ${spotlight.top}px,
                    ${spotlight.left}px ${spotlight.top + spotlight.height}px,
                    ${spotlight.left + spotlight.width}px ${spotlight.top + spotlight.height}px,
                    ${spotlight.left + spotlight.width}px ${spotlight.top}px,
                    ${spotlight.left}px ${spotlight.top}px
                  )`,
                }
              : {}),
          }}
          onClick={finish}
        />

        {/* Anneau de surbrillance autour de la cible */}
        {spotlight && (
          <div
            className="absolute rounded-xl ring-4 ring-primary ring-offset-2 ring-offset-transparent transition-all duration-300 animate-pulse pointer-events-none"
            style={{
              top: spotlight.top,
              left: spotlight.left,
              width: spotlight.width,
              height: spotlight.height,
              boxShadow: "0 0 0 9999px transparent",
            }}
          />
        )}

        {/* Infobulle / carte d'explication */}
        <div
          className="absolute flex flex-col rounded-2xl border bg-card text-card-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-200 pointer-events-auto overflow-hidden"
          style={tooltipStyle}
        >
          {/* Barre de progression en haut */}
          <div className="h-1.5 w-full overflow-hidden rounded-t-2xl bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>

          <div className="flex items-start justify-between gap-3 p-4 border-b shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {step.icon}
              </div>
              <div className="min-w-0">
                {step.badge && (
                  <span className="inline-block mb-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5 uppercase tracking-wide">
                    {step.badge[lang]}
                  </span>
                )}
                <h3 className="text-base font-semibold leading-tight truncate">{step.title[lang]}</h3>
                <span className="text-xs font-medium text-muted-foreground">
                  {lang === "fr" ? "Étape" : "Step"} {index + 1} / {total} ·{" "}
                  {Math.round(((index + 1) / total) * 100)}%
                </span>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={finish}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-4 flex-1 min-h-0 overflow-y-auto">
            {step.role && (
              <div className="mb-3 flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 p-2.5">
                <span className="mt-0.5 shrink-0 rounded-md bg-primary/10 text-primary text-[10px] font-semibold px-1.5 py-0.5 uppercase tracking-wide">
                  {lang === "fr" ? "Rôle" : "Role"}
                </span>
                <p className="text-xs font-medium text-foreground leading-relaxed">{step.role[lang]}</p>
              </div>
            )}

            <p className="text-sm text-muted-foreground leading-relaxed">{step.desc[lang]}</p>

            {step.tips && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-foreground mb-1.5">
                  {lang === "fr" ? "Comment faire" : "How to"}
                </p>
                <ul className="space-y-1.5">
                  {step.tips[lang].map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[9px] font-semibold">
                        {i + 1}
                      </span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {step.action && (
              <Button
                size="sm"
                className="mt-3 w-full"
                onClick={() => { onClose(); navigate(step.action!.to); }}
              >
                {step.action.label[lang]}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}



            {/* Indicateurs cliquables étape par étape */}
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {STEPS.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  title={s.title[lang]}
                  aria-label={s.title[lang]}
                  className={
                    "h-2 rounded-full transition-all " +
                    (i === index
                      ? "w-6 bg-primary"
                      : i < index
                        ? "w-2 bg-primary/50"
                        : "w-2 bg-muted hover:bg-muted-foreground/40")
                  }
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 p-4 border-t shrink-0">
            <Button variant="ghost" size="sm" onClick={finish}>
              {lang === "fr" ? "Passer" : "Skip"}
            </Button>
            <div className="flex items-center gap-2">
              {index > 0 && (
                <Button variant="outline" size="sm" onClick={prev}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  {lang === "fr" ? "Précédent" : "Back"}
                </Button>
              )}
              <Button size="sm" onClick={next}>
                {isLast
                  ? lang === "fr" ? "Terminer" : "Finish"
                  : lang === "fr" ? "Suivant" : "Next"}
                {!isLast && <ArrowRight className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }, [isOpen, step, index, lang, isLast, rect, tooltipStyle, total]);

  if (!isOpen) return null;
  return createPortal(content, document.body);
}
