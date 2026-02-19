export type Role = "seller" | "buyer" | "platform";
export type JurisdictionTier = "A" | "B" | "C";

export type Stage =
  | "DISCOVERY"
  | "QUALIFICATION"
  | "NDA"
  | "LIMITED_DATA_ROOM"
  | "DEPOSIT_REQUIRED"
  | "IOI_LOI"
  | "ESCROW"
  | "SETTLEMENT"
  | "PAUSED";

export type RedFlagKey =
  | "AML_PRICING_ANOMALY"
  | "AML_THIRD_PARTY_PAYER"
  | "FRAUD_OWNERSHIP_DOUBT"
  | "BUYER_VALUATION_MINING"
  | "SELLER_SIGNAL_MINING"
  | "REGULATORY_CLASSIFICATION_QUESTION";

export type RedFlags = Record<RedFlagKey, boolean>;

export type PauseReason =
  | { kind: "NONE" }
  | { kind: "RED_FLAG"; flags: RedFlagKey[]; note?: string }
  | { kind: "MANUAL"; note?: string };

export type EventType =
  | "INIT"
  | "SET_ROLE"
  | "SET_JURISDICTION"
  | "SET_DEAL_SIZE"
  | "TOGGLE_FLAG"
  | "ACK"
  | "SET_DEPOSIT_SATISFIED"
  | "REQUEST_ADVANCE"
  | "PAUSE"
  | "RESUME"
  | "RESET";

export type EventLogEntry = {
  id: string;
  ts: number;
  type: EventType;
  message: string;
};

export type AcknowledgementKey =
  | "READ_REQUIRED_DISCLOSURES"
  | "ACCEPTED_NON_GOALS"
  | "ACCEPTED_NEUTRALITY_BOUNDARY"
  | "ACCEPTED_CONFIDENTIALITY_TERMS";

export type Acknowledgements = Record<AcknowledgementKey, boolean>;

export type SimConfig = {
  minDealSize: number;
  maxDealSize: number;
  // Simplified: which tiers require a diligence deposit before deeper access
  depositRequiredTiers: JurisdictionTier[];
  // Which flags are "hard stop" and force PAUSE
  hardStopFlags: RedFlagKey[];
};

export type SimState = {
  stage: Stage;
  role: Role;
  jurisdictionTier: JurisdictionTier;
  dealSize: number;
  depositSatisfied: boolean;

  redFlags: RedFlags;
  acknowledgements: Acknowledgements;
  pauseReason: PauseReason;
  events: EventLogEntry[];
  config: SimConfig;
  stateId: string;
};