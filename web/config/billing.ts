/**
 * Master switch for paid-plan / "Upgrade to Pro" UI.
 *
 * Self-hosting default: OFF — no upgrade prompts, pricing cards, rate-limit
 * upgrade buttons, the onboarding "choose a plan" step, or promo modals.
 *
 * NEXT_PUBLIC_ vars are inlined into the client bundle at BUILD time, so to
 * enable the SaaS billing UI you must set NEXT_PUBLIC_BILLING_ENABLED=true in
 * web/.env (or pass it as the docker build arg) BEFORE building the web image.
 */
export const isBillingEnabled =
  process.env.NEXT_PUBLIC_BILLING_ENABLED === 'true'
