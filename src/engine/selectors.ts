import { mustPauseForFlags, stageLabel } from "./rules";
import type { AcknowledgementKey, RedFlagKey, Role, SimState, Stage } from "./types";

export function currentStageTitle(state: SimState): string {
  return stageLabel(state.stage);
}

export function isPaused(state: SimState): boolean {
  return state.stage === "PAUSED";
}

const SIGNAL_FLAGS: RedFlagKey[] = [
  "AML_PRICING_ANOMALY",
  "BUYER_VALUATION_MINING",
  "SELLER_SIGNAL_MINING",
];

function activeSignalFlags(state: SimState): RedFlagKey[] {
  return SIGNAL_FLAGS.filter((k) => state.redFlags[k]);
}

// MUST match reducer.ts
function requiredAcksForStage(stage: Stage, role: Role): AcknowledgementKey[] {
  const base: AcknowledgementKey[] = ["READ_REQUIRED_DISCLOSURES"];

  switch (stage) {
    case "DISCOVERY":
      return base;

    case "QUALIFICATION":
      if (role === "seller") return [...base, "ACCEPTED_NON_GOALS"];
      if (role === "buyer") return [...base, "ACCEPTED_NEUTRALITY_BOUNDARY"];
      return base;

    case "NDA":
      return ["ACCEPTED_CONFIDENTIALITY_TERMS"];

    default:
      return [];
  }
}

export function requiredAcks(state: SimState): AcknowledgementKey[] {
  return requiredAcksForStage(state.stage, state.role);
}

/**
 * Returns a human-readable reason why "Advance" is blocked, otherwise null.
 * Mirrors the same gating logic used by the reducer.
 */
export function advanceBlockedReason(state: SimState): string | null {
  if (state.stage === "PAUSED") return "Cannot advance while paused.";

  const hard = mustPauseForFlags(state.redFlags, state.config);
  if (hard.length > 0) {
    return `Hard-stop flag active: ${hard.join(", ")}.`;
  }

  const required = requiredAcksForStage(state.stage, state.role);
  const missing = required.filter((k) => !state.acknowledgements[k]);
  if (missing.length > 0) {
    return "Required acknowledgement(s) not yet accepted.";
  }

  // Option A: signal-only flags block entering Limited Data Room (NDA -> LDR)
  if (state.role !== "platform" && state.stage === "NDA") {
    const active = activeSignalFlags(state);
    if (active.length > 0) {
      return `Access-control warning(s) active: ${active.join(
        ", "
      )}. Clear before Limited Data Room.`;
    }
  }

  // Deposit gate: only for buyers, only in tiers that require it.
  if (
    state.stage === "DEPOSIT_REQUIRED" &&
    state.role === "buyer" &&
    state.config.depositRequiredTiers.includes(state.jurisdictionTier) &&
    !state.depositSatisfied
  ) {
    return "Buyer diligence deposit not satisfied.";
  }

  return null;
}