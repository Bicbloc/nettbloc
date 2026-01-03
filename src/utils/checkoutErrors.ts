export function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as any).message);
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export type CheckoutErrorKind = "stripe_live_charges_disabled" | "plan_disabled" | null;

export function detectCheckoutErrorKind(message: string): CheckoutErrorKind {
  if (
    message.includes("stripe_live_charges_disabled") ||
    message.includes("Your account cannot currently make live charges")
  ) {
    return "stripe_live_charges_disabled";
  }

  if (message.includes("plan_disabled") || message.includes("PLAN_DISABLED")) {
    return "plan_disabled";
  }

  return null;
}

export function checkoutErrorDescription(kind: CheckoutErrorKind): string | null {
  switch (kind) {
    case "stripe_live_charges_disabled":
      return "Stripe n'est pas encore activé pour les paiements en mode live. Activez votre compte Stripe (paiements live) ou utilisez une clé de test (sk_test_...) pendant le développement.";
    case "plan_disabled":
      return "Ce plan est temporairement indisponible. Contactez votre administrateur ou choisissez un autre plan.";
    default:
      return null;
  }
}
