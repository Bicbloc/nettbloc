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

export type CheckoutErrorKind = "gocardless_error" | "plan_disabled" | null;

export function detectCheckoutErrorKind(message: string): CheckoutErrorKind {
  if (message.includes("plan_disabled") || message.includes("PLAN_DISABLED")) {
    return "plan_disabled";
  }

  if (message.includes("GoCardless") || message.includes("gocardless")) {
    return "gocardless_error";
  }

  return null;
}

export function checkoutErrorDescription(kind: CheckoutErrorKind): string | null {
  switch (kind) {
    case "gocardless_error":
      return "Une erreur s'est produite avec le service de paiement GoCardless. Veuillez réessayer ou contacter le support.";
    case "plan_disabled":
      return "Ce plan est temporairement indisponible. Contactez votre administrateur ou choisissez un autre plan.";
    default:
      return null;
  }
}
