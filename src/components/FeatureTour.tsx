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
  desc: { fr: string; en: string };
  /** Action optionnelle : ouvre une autre page guidée */
  action?: { label: { fr: string; en: string }; to: string };
}

const STEPS: TourStep[] = [
  {
    icon: <Sparkles className="h-6 w-6" />,
    title: { fr: "Bienvenue sur Nettobloc 👋", en: "Welcome to Nettobloc 👋" },
    desc: {
      fr: "On vous montre, étape par étape, comment prendre l'application en main. Une flèche pointera la fonctionnalité concernée. Vous pouvez passer à tout moment.",
      en: "We'll show you, step by step, how to get started. An arrow will point at each feature. You can skip anytime.",
    },
  },
  {
    tab: "access-codes",
    target: '[data-tour="nav-access-codes"]',
    icon: <Key className="h-6 w-6" />,
    badge: { fr: "1re chose à faire", en: "Do this first" },
    title: { fr: "Invitez vos employés", en: "Invite your staff" },
    desc: {
      fr: "Commencez ici. Générez un code d'accès par rôle (femme de chambre, gouvernante, technicien) et transmettez-le à votre équipe : elles se connectent à l'application terrain avec ce code, sans créer de compte.",
      en: "Start here. Generate one access code per role (housekeeper, governess, technician) and share it with your team: they log into the field app with that code, no account needed.",
    },
  },
  {
    tab: "rooms",
    target: '[data-tour="nav-rooms"]',
    icon: <Bed className="h-6 w-6" />,
    badge: { fr: "Configuration", en: "Setup" },
    title: { fr: "Entraîner l'import PDF", en: "Train the PDF import" },
    desc: {
      fr: "Pourquoi ? Pour que Nettobloc lise automatiquement le rapport PDF de votre PMS et crée les chambres avec le bon statut (départ, recouche…). Comment ? Ouvrez Gestion des chambres › Config avancée › Entraîner le PDF, importez un exemple et corrigez une fois : le modèle s'applique ensuite à tous vos PDF identiques.",
      en: "Why? So Nettobloc reads your PMS PDF report automatically and creates rooms with the right status (check-out, stayover…). How? Open Room management › Advanced config › Train PDF, import a sample and correct it once: the model then applies to all identical PDFs.",
    },
  },
  {
    tab: "assignment",
    target: '[data-tour="nav-assignment"]',
    icon: <UserIcon className="h-6 w-6" />,
    title: { fr: "Faire les affectations", en: "Assign rooms" },
    desc: {
      fr: "Répartissez les chambres entre vos femmes de chambre. Mode automatique : cliquez sur « Distribuer » et l'app équilibre la charge selon le nombre de chambres et le type de ménage. Mode manuel : glissez/sélectionnez les chambres à attribuer à chaque personne.",
      en: "Distribute rooms among housekeepers. Automatic: click \"Distribute\" and the app balances the load by room count and cleaning type. Manual: drag/select rooms to assign to each person.",
    },
  },
  {
    tab: "incidents",
    target: '[data-tour="nav-incidents"]',
    icon: <AlertTriangle className="h-6 w-6" />,
    title: { fr: "Signaler un incident", en: "Report an incident" },
    desc: {
      fr: "Pour signaler un problème dans une chambre (équipement cassé, dégât…), ouvrez Incidents › « Nouvel incident », choisissez la chambre, décrivez le problème et ajoutez une photo. Vous suivez ensuite sa résolution depuis cette liste.",
      en: "To report a problem in a room (broken equipment, damage…), open Incidents › \"New incident\", pick the room, describe the issue and add a photo. Track its resolution from this list.",
    },
  },
  {
    tab: "reports",
    target: '[data-tour="nav-reports"]',
    icon: <FileText className="h-6 w-6" />,
    title: { fr: "Trouver / imprimer les rapports", en: "Find / print reports" },
    desc: {
      fr: "Vos rapports d'activité PDF sont ici. Choisissez la date, générez le rapport, puis Télécharger pour l'imprimer ou Envoyer par e-mail. Les journées passées restent disponibles dans Archives.",
      en: "Your PDF activity reports are here. Pick the date, generate the report, then Download to print or Send by email. Past days stay available in Archives.",
    },
  },
  {
    tab: "linen",
    target: '[data-tour="nav-linen"]',
    icon: <span className="text-2xl">🧺</span>,
    title: { fr: "Inventaire du linge", en: "Linen inventory" },
    desc: {
      fr: "Comptez le linge avec l'IA : prenez une photo de la pile, l'app reconnaît et compte les articles, puis vous validez. Le stock se met à jour automatiquement pour suivre vos quantités et anticiper les commandes.",
      en: "Count linen with AI: take a photo of the stack, the app recognizes and counts items, then you confirm. Stock updates automatically to track quantities and anticipate orders.",
    },
  },
  {
    tab: "lost-found",
    target: '[data-tour="nav-lost-found"]',
    icon: <Package className="h-6 w-6" />,
    title: { fr: "Objets trouvés", en: "Lost & found" },
    desc: {
      fr: "Enregistrez les objets oubliés par les clients : photo, chambre, description. L'IA aide à identifier l'objet. Vous gardez l'historique pour les retrouver et les restituer facilement.",
      en: "Record items left behind by guests: photo, room, description. AI helps identify the item. Keep the history to find and return them easily.",
    },
  },
  {
    tab: "tickets",
    target: '[data-tour="nav-tickets"]',
    icon: <TicketCheck className="h-6 w-6" />,
    title: { fr: "Tickets & tâches", en: "Tickets & tasks" },
    desc: {
      fr: "Créez des tâches ponctuelles pour votre équipe et suivez leur avancement (à faire, en cours, terminé).",
      en: "Create one-off tasks for your team and track their progress (to do, in progress, done).",
    },
  },
  {
    tab: "inspections",
    target: '[data-tour="nav-inspections"]',
    icon: <ClipboardCheck className="h-6 w-6" />,
    title: { fr: "Inspections", en: "Inspections" },
    desc: {
      fr: "La gouvernante contrôle la qualité du nettoyage chambre par chambre et valide ou renvoie pour correction.",
      en: "The governess checks cleaning quality room by room and validates or sends back for correction.",
    },
  },
  {
    tab: "templates",
    target: '[data-tour="nav-templates"]',
    icon: <Repeat className="h-6 w-6" />,
    title: { fr: "Templates", en: "Templates" },
    desc: {
      fr: "Créez des modèles d'instructions et de tâches récurrentes à appliquer chaque jour automatiquement.",
      en: "Create recurring instruction and task templates applied automatically each day.",
    },
  },
  {
    tab: "overview",
    target: '[data-tour="nav-overview"]',
    icon: <Layers className="h-6 w-6" />,
    title: { fr: "Vue d'ensemble", en: "Overview" },
    desc: {
      fr: "Votre tableau de bord quotidien : importez le PDF du jour, visualisez l'état des chambres en temps réel et lancez la distribution du travail.",
      en: "Your daily dashboard: import today's PDF, view room status in real time and start distributing the work.",
    },
  },
  {
    tab: "archives",
    target: '[data-tour="nav-archives"]',
    icon: <Archive className="h-6 w-6" />,
    title: { fr: "Archives", en: "Archives" },
    desc: {
      fr: "Consultez l'historique de vos journées et retrouvez tous vos rapports passés.",
      en: "Browse the history of your past days and find all your previous reports.",
    },
  },
  {
    target: '[data-tour="user-menu"]',
    icon: <Settings className="h-6 w-6" />,
    title: { fr: "Où trouver les Paramètres", en: "Where to find Settings" },
    desc: {
      fr: "Cliquez sur votre avatar en haut à droite : le menu s'ouvre. « Paramètres » vous permet de modifier le nom de l'établissement, la langue, les options du compte et les préférences de l'hôtel.",
      en: "Click your avatar at the top right: the menu opens. \"Settings\" lets you change the establishment name, language, account options and hotel preferences.",
    },
  },
  {
    target: '[data-tour="user-menu"]',
    icon: <Building2 className="h-6 w-6" />,
    title: { fr: "Le Registre des chambres", en: "The Room registry" },
    desc: {
      fr: "Toujours depuis votre avatar en haut à droite › « Registre des chambres ». C'est la liste permanente de toutes vos chambres. Pour le remplir : cliquez sur « Ajouter », saisissez le numéro, l'étage et le type (lit simple/double, twin, RDC…), puis enregistrez. Vous pouvez aussi modifier, désactiver ou importer en masse. Ce registre sert de référence à toutes les affectations et imports PDF.",
      en: "Also from your avatar top right › \"Room registry\". It's the permanent list of all your rooms. To fill it: click \"Add\", enter the number, floor and type (single/double, twin, ground floor…), then save. You can also edit, disable or bulk import. This registry is the reference for all assignments and PDF imports.",
    },
  },
  {
    icon: <Check className="h-6 w-6" />,
    title: { fr: "Vous êtes prêt ! 🎉", en: "You're all set! 🎉" },
    desc: {
      fr: "Récapitulatif : 1) invitez vos employés, 2) entraînez le PDF, 3) importez et affectez les chambres. Le reste se gère au quotidien. Bon travail avec Nettobloc !",
      en: "Recap: 1) invite your staff, 2) train the PDF, 3) import and assign rooms. The rest is daily work. Enjoy Nettobloc!",
    },
  },
];

interface FeatureTourProps {
  isOpen: boolean;
  onTabChange: (tab: TabValue) => void;
  onClose: () => void;
}

interface Rect { top: number; left: number; width: number; height: number; }

export function FeatureTour({ isOpen, onTabChange, onClose }: FeatureTourProps) {
  const { language } = useLanguage();
  const lang = language === "fr" ? "fr" : "en";
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

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
    if (!rect) {
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
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
    return { top, left, width: CARD_W, maxWidth: "calc(100vw - 24px)" };
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
          className="absolute rounded-2xl border bg-card text-card-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
          style={tooltipStyle}
        >
          {/* Barre de progression en haut */}
          <div className="h-1.5 w-full overflow-hidden rounded-t-2xl bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>

          <div className="flex items-start justify-between gap-3 p-4 border-b">
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

          <div className="p-4">
            <p className="text-sm text-muted-foreground leading-relaxed">{step.desc[lang]}</p>

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

          <div className="flex items-center justify-between gap-2 p-4 border-t">
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
