import {
  DEFAULT_CONFIG,
  mustPauseForFlags,
  nextStage,
  requiresDepositBeforeDataRoom,
} from "./rules";
import type {
  Acknowledgements,
  EventLogEntry,
  RedFlags,
  SimState,
  Stage,
  RedFlagKey,
  Role,
  JurisdictionTier,
  PauseReason,
  AcknowledgementKey,
} from "./types";

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
}

function log(state: SimState, type: EventLogEntry["type"], message: string): SimState {
  const entry: EventLogEntry = { id: uid(), ts: Date.now(), type, message };
  return { ...state, events: [entry, ...state.events] };
}

export function makeInitialState(): SimState {
  const redFlags: RedFlags = {
    AML_PRICING_ANOMALY: false,
    AML_THIRD_PARTY_PAYER: false,
    FRAUD_OWNERSHIP_DOUBT: false,
    BUYER_VALUATION_MINING: false,
    SELLER_SIGNAL_MINING: false,
    REGULATORY_CLASSIFICATION_QUESTION: false,
  };

  const acknowledgements: Acknowledgements = {
    READ_REQUIRED_DISCLOSURES: false,
    ACCEPTED_NON_GOALS: false,
    ACCEPTED_NEUTRALITY_BOUNDARY: false,
    ACCEPTED_CONFIDENTIALITY_TERMS: false,
  };

  const s: SimState = {
    stage: "DISCOVERY",
    role: "platform",
    jurisdictionTier: "A",
    dealSize: 200_000,
    depositSatisfied: false,

    redFlags,
    acknowledgements,
    pauseReason: { kind: "NONE" },
    events: [],
    config: DEFAULT_CONFIG,
    stateId: uid(),
  };

  return log(s, "INIT", "Simulation initialized.");
}

export type Action =
  | { type: "SET_ROLE"; role: Role }
  | { type: "SET_JURISDICTION"; tier: JurisdictionTier }
  | { type: "SET_DEAL_SIZE"; dealSize: number }
  | { type: "TOGGLE_FLAG"; flag: RedFlagKey }
  | { type: "ACK"; ack: AcknowledgementKey; value: boolean }
  | { type: "SET_DEPOSIT_SATISFIED"; value: boolean }
  | { type: "REQUEST_ADVANCE" }
  | { type: "PAUSE"; note?: string }
  | { type: "RESUME" }
  | { type: "RESET" };

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function setStage(state: SimState, stage: Stage, reason?: string): SimState {
  const s2: SimState = { ...state, stage, pauseReason: { kind: "NONE" } };
  return log(s2, "REQUEST_ADVANCE", reason ?? `Moved to ${stage}.`);
}

function setPause(state: SimState, pauseReason: PauseReason, message: string): SimState {
  const s2: SimState = { ...state, stage: "PAUSED", pauseReason };
  return log(s2, "PAUSE", message);
}

/**
 * Signal-only flags (NOT auto-pause).
 * We treat these as "access-control warnings" that block only at specific gates.
 */
const SIGNAL_FLAGS: RedFlagKey[] = [
  "AML_PRICING_ANOMALY",
  "BUYER_VALUATION_MINING",
  "SELLER_SIGNAL_MINING",
];

function activeSignalFlags(state: SimState): RedFlagKey[] {
  return SIGNAL_FLAGS.filter((k) => state.redFlags[k]);
}

// Role-aware acknowledgement requirements.
// MUST match selectors.ts to avoid UI/engine mismatch.
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

function canAdvance(state: SimState): { ok: true } | { ok: false; why: string } {
  // 1) Hard-stops -> PAUSE layer handles those.
  const hard = mustPauseForFlags(state.redFlags, state.config);
  if (hard.length > 0) {
    return { ok: false, why: `Hard stop flag(s) active: ${hard.join(", ")}` };
  }

  // 2) Required acknowledgements for *current stage*.
  const required = requiredAcksForStage(state.stage, state.role);
  const missing = required.filter((k) => !state.acknowledgements[k]);
  if (missing.length > 0) {
    return { ok: false, why: `Missing required acknowledgement(s): ${missing.join(", ")}` };
  }

  // 3) Option A: Signal-only flags block "enter Limited Data Room".
  // This makes valuation/signal-mining flags meaningful without becoming hard-stops.
  if (state.role !== "platform" && state.stage === "NDA") {
    const active = activeSignalFlags(state);
    if (active.length > 0) {
      return {
        ok: false,
        why: `Access-control warning(s) active: ${active.join(
          ", "
        )}. Clear before Limited Data Room.`,
      };
    }
  }

  // 4) Deposit gate:
  // - Only enforced if the selected jurisdiction tier requires it.
  // - Only enforced for buyers (diligence deposit / seriousness filter).
  if (
    state.stage === "DEPOSIT_REQUIRED" &&
    state.role === "buyer" &&
    requiresDepositBeforeDataRoom(state.jurisdictionTier, state.config) &&
    !state.depositSatisfied
  ) {
    return { ok: false, why: "Buyer diligence deposit not satisfied." };
  }

  return { ok: true };
}

export function reducer(state: SimState, action: Action): SimState {
  switch (action.type) {
    case "SET_ROLE": {
      const s2 = { ...state, role: action.role };
      return log(s2, "SET_ROLE", `Role set to ${action.role}.`);
    }

    case "SET_JURISDICTION": {
      const s2 = { ...state, jurisdictionTier: action.tier };
      return log(s2, "SET_JURISDICTION", `Jurisdiction tier set to ${action.tier}.`);
    }

    case "SET_DEAL_SIZE": {
      const dealSize = clamp(action.dealSize, state.config.minDealSize, state.config.maxDealSize);
      const s2 = { ...state, dealSize };
      return log(s2, "SET_DEAL_SIZE", `Deal size set to $${dealSize.toLocaleString()}.`);
    }

    case "TOGGLE_FLAG": {
      const next = { ...state.redFlags, [action.flag]: !state.redFlags[action.flag] };

      // If a hard-stop flag is turned on, auto-pause immediately.
      const hard = mustPauseForFlags(next, state.config);
      if (hard.length > 0) {
        return setPause(
          { ...state, redFlags: next },
          { kind: "RED_FLAG", flags: hard },
          `Pause triggered by hard-stop flag(s): ${hard.join(", ")}.`
        );
      }

      const s2 = { ...state, redFlags: next };
      return log(s2, "TOGGLE_FLAG", `Toggled flag ${action.flag} to ${next[action.flag]}.`);
    }

    case "ACK": {
      const acknowledgements = { ...state.acknowledgements, [action.ack]: action.value };
      const s2 = { ...state, acknowledgements };
      return log(s2, "ACK", `Acknowledgement ${action.ack} set to ${action.value}.`);
    }

    case "SET_DEPOSIT_SATISFIED": {
      const s2 = { ...state, depositSatisfied: action.value };
      return log(s2, "SET_DEPOSIT_SATISFIED", `Deposit satisfied set to ${action.value}.`);
    }

    case "REQUEST_ADVANCE": {
      if (state.stage === "PAUSED") {
        return log(state, "REQUEST_ADVANCE", "Cannot advance while paused.");
      }

      const gate = canAdvance(state);
      if (!gate.ok) {
        if (gate.why.startsWith("Hard stop")) {
          const hard = mustPauseForFlags(state.redFlags, state.config);
          return setPause(state, { kind: "RED_FLAG", flags: hard }, `Pause triggered: ${gate.why}.`);
        }
        return log(state, "REQUEST_ADVANCE", `Advance blocked: ${gate.why}.`);
      }

      let ns = nextStage(state.stage);
      if (!ns) return log(state, "REQUEST_ADVANCE", "Already at final stage.");

      // Skip deposit stage if this tier does not require it.
      if (ns === "DEPOSIT_REQUIRED" && !requiresDepositBeforeDataRoom(state.jurisdictionTier, state.config)) {
        ns = "IOI_LOI";
      }

      // If we are entering DEPOSIT_REQUIRED, reset the depositSatisfied flag (fresh gate each run).
      if (ns === "DEPOSIT_REQUIRED") {
        const s2 = { ...state, depositSatisfied: false };
        return setStage(s2, ns, `Advanced from ${state.stage} to ${ns}.`);
      }

      return setStage(state, ns, `Advanced from ${state.stage} to ${ns}.`);
    }

    case "PAUSE": {
      return setPause(state, { kind: "MANUAL", note: action.note }, action.note ?? "Manual pause.");
    }

    case "RESUME": {
      const hard = mustPauseForFlags(state.redFlags, state.config);
      if (hard.length > 0) {
        return log(state, "RESUME", `Cannot resume: hard-stop flag(s) still active: ${hard.join(", ")}.`);
      }
      const s2: SimState = { ...state, stage: "DISCOVERY", pauseReason: { kind: "NONE" } };
      return log(s2, "RESUME", "Resumed (reset to Discovery for safety).");
    }

    case "RESET": {
      return makeInitialState();
    }

    default:
      return state;
  }
}