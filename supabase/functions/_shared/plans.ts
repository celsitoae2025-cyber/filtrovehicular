// ============================================================
// _shared/plans.ts — Catálogo único de planes (edge functions)
// FUENTE DE VERDAD compartida por crear-preferencia y webhook-mercadopago.
// El frontend (js/shared/plans-data.js) DEBE mantenerse alineado a estos
// valores. Existe el script `tools/sync-plans.js` que regenera el JS del
// frontend a partir de este archivo (npm run sync:plans).
// ============================================================

export type CreditPlan = {
  id: string;
  title: string;
  tier: "profesional" | "business";
  price: number;
  credits: number;     // créditos base
  bonus: number;       // bonus extra (display)
  active: boolean;
  type: "recarga";
};

export type SubscriptionPlan = {
  id: string;
  title: string;
  tier: "profesional" | "profesional_plus" | "business";
  price: number;
  days: number;
  active: boolean;
  type: "suscripcion";
};

export type AnyPlan = CreditPlan | SubscriptionPlan;

// Helper para que el "credits efectivos" (usado al acreditar) sea
// siempre `credits + bonus`. Mantiene retrocompatibilidad con la tabla
// hardcodeada anterior donde un plan era "200 créditos" = 150 + 50.
export function effectiveCredits(p: CreditPlan): number {
  return (p.credits || 0) + (p.bonus || 0);
}

export const CREDIT_PLANS: CreditPlan[] = [
  { id: "cp-test",   title: "TEST — 200 créditos S/2 (admin)", tier: "profesional", price: 2,   credits: 200,  bonus: 0,   active: false, type: "recarga" },
  { id: "cp-prof-1", title: "200 créditos (Profesional)",      tier: "profesional", price: 15,  credits: 150,  bonus: 50,  active: true, type: "recarga" },
  { id: "cp-prof-2", title: "420 créditos (Profesional)",      tier: "profesional", price: 25,  credits: 350,  bonus: 70,  active: true, type: "recarga" },
  { id: "cp-prof-3", title: "700 créditos (Profesional)",      tier: "profesional", price: 45,  credits: 550,  bonus: 150, active: true, type: "recarga" },
  { id: "cp-biz-1",  title: "1800 créditos (Business)",         tier: "business",    price: 90,  credits: 1500, bonus: 300, active: true, type: "recarga" },
  { id: "cp-biz-2",  title: "4000 créditos (Business)",         tier: "business",    price: 150, credits: 3500, bonus: 500, active: true, type: "recarga" },
  { id: "cp-biz-3",  title: "9000 créditos (Business)",         tier: "business",    price: 300, credits: 8500, bonus: 500, active: true, type: "recarga" },
];

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  { id: "sp-prof-7",  title: "7 días Profesional",       tier: "profesional",      price: 30,  days: 7,  active: true, type: "suscripcion" },
  { id: "sp-prof-15", title: "15 días Profesional",      tier: "profesional",      price: 50,  days: 15, active: true, type: "suscripcion" },
  { id: "sp-pp-30",   title: "30 días Profesional Plus", tier: "profesional_plus", price: 100, days: 30, active: true, type: "suscripcion" },
  { id: "sp-pp-60",   title: "60 días Profesional Plus", tier: "profesional_plus", price: 150, days: 60, active: true, type: "suscripcion" },
  { id: "sp-biz-90",  title: "90 días Business",         tier: "business",         price: 250, days: 90, active: true, type: "suscripcion" },
];

export const TIER_LABELS: Record<string, string> = {
  profesional: "Profesional",
  profesional_plus: "Profesional Plus",
  business: "Business",
};

export function findPlan(planId: string): AnyPlan | null {
  return (
    CREDIT_PLANS.find((p) => p.id === planId) ||
    SUBSCRIPTION_PLANS.find((p) => p.id === planId) ||
    null
  );
}

// Devuelve los créditos a acreditar al usuario al pagar este plan.
// Para suscripciones es 0 (el beneficio es la vigencia, no créditos).
export function planCreditsToGrant(plan: AnyPlan): number {
  if (plan.type === "recarga") return effectiveCredits(plan);
  return 0;
}
