// src/engine/rules.ts
import type { AcknowledgementKey, JurisdictionTier, RedFlagKey, Role, SimConfig, Stage } from "./types";

export const STAGES: Stage[] = [
  "DISCOVERY",
  "QUALIFICATION",
  "NDA",
  "LIMITED_DATA_ROOM",
  "DEPOSIT_REQUIRED",
  "IOI_LOI",
  "ESCROW",
  "SETTLEMENT",
];

export function stageLabel(stage: Stage, role?: Role): string {
  switch (stage) {
    case "DISCOVERY":
      return "Discovery";
    case "QUALIFICATION":
      return "Qualification";
    case "NDA":
      return "NDA Gate";
    case "LIMITED_DATA_ROOM":
      return "Limited Data Room";
    case "DEPOSIT_REQUIRED":
      return role === "buyer" ? "Diligence Deposit" : "Verification Gate";
    case "IOI_LOI":
      return "IOI / LOI";
    case "ESCROW":
      return "Escrow";
    case "SETTLEMENT":
      return "Settlement";
    case "PAUSED":
      return "Paused";
    default:
      return stage;
  }
}

export function nextStage(current: Stage): Stage | null {
  if (current === "PAUSED") return null;
  const idx = STAGES.indexOf(current);
  if (idx < 0) return null;
  return idx === STAGES.length - 1 ? null : STAGES[idx + 1];
}

export function mustPauseForFlags(redFlags: Record<RedFlagKey, boolean>, config: SimConfig): RedFlagKey[] {
  return config.hardStopFlags.filter((k) => !!redFlags[k]);
}

export function requiresDepositBeforeDataRoom(tier: JurisdictionTier, config: SimConfig): boolean {
  return config.depositRequiredTiers.includes(tier);
}

/**
 * Role-aware acknowledgement requirements.
 * This MUST match the reducer gating logic to avoid UI/engine mismatch.
 */
export function requiredAcksForStage(stage: Stage, role: Role): AcknowledgementKey[] {
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

export const DEFAULT_CONFIG: SimConfig = {
  minDealSize: 50_000,
  maxDealSize: 500_000,
  // In this pilot, "B" and "C" tiers require the gate.
  // The gate is a "diligence deposit" for buyers, but just a "verification gate" for sellers.
  depositRequiredTiers: ["B", "C"],
  hardStopFlags: ["AML_THIRD_PARTY_PAYER", "FRAUD_OWNERSHIP_DOUBT", "REGULATORY_CLASSIFICATION_QUESTION"],
};