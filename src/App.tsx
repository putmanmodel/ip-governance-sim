// src/App.tsx
import React, { useReducer } from "react";
import "./App.css";
import { makeInitialState, reducer } from "./engine/reducer";
import { currentStageTitle, requiredAcks, isPaused, advanceBlockedReason } from "./engine/selectors";
import { stageLabel, STAGES, requiresDepositBeforeDataRoom } from "./engine/rules";
import type { RedFlagKey, AcknowledgementKey, Role } from "./engine/types";

const FLAG_LABELS: Record<RedFlagKey, string> = {
  AML_PRICING_ANOMALY: "AML: pricing anomaly",
  AML_THIRD_PARTY_PAYER: "AML: third-party payer",
  FRAUD_OWNERSHIP_DOUBT: "Fraud: ownership doubt",
  BUYER_VALUATION_MINING: "Buyer: valuation mining",
  SELLER_SIGNAL_MINING: "Seller: signal mining",
  REGULATORY_CLASSIFICATION_QUESTION: "Regulatory: classification question",
};

const FLAG_HELP: Partial<Record<RedFlagKey, string>> = {
  AML_THIRD_PARTY_PAYER: "Third-party payment requests are a hard-stop in this simulation.",
  FRAUD_OWNERSHIP_DOUBT: "Ownership doubt triggers immediate pause.",
  REGULATORY_CLASSIFICATION_QUESTION:
    "If the transaction may be regulated (escrow/transfer structure), pause and review.",
};

const ACK_LABELS: Record<AcknowledgementKey, string> = {
  READ_REQUIRED_DISCLOSURES: "I have reviewed the required disclosures (simulation only).",
  ACCEPTED_NON_GOALS: "I understand the stated non-goals and exclusions.",
  ACCEPTED_NEUTRALITY_BOUNDARY:
    "I understand the platform neutrality boundary (no side-taking / no valuation).",
  ACCEPTED_CONFIDENTIALITY_TERMS: "I accept the confidentiality gate terms for controlled access.",
};

const ACK_HELP: Partial<Record<AcknowledgementKey, string>> = {
  READ_REQUIRED_DISCLOSURES: "This is a governance simulator. No real listings, funds, KYC, or escrow are handled here.",
  ACCEPTED_NON_GOALS: "This pilot does not provide legal advice, price guarantees, or public bidding mechanics.",
  ACCEPTED_NEUTRALITY_BOUNDARY: "The platform governs process integrity, not deal outcomes or participant claims.",
  ACCEPTED_CONFIDENTIALITY_TERMS: "Confidential access is staged. Deeper access occurs only after gates are satisfied.",
};

function isAckRelevantForRole(ack: AcknowledgementKey, role: Role): boolean {
  if (role === "platform") return true;
  if (role === "buyer") return ack !== "ACCEPTED_NON_GOALS";
  if (role === "seller") return ack !== "ACCEPTED_NEUTRALITY_BOUNDARY";
  return true;
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, makeInitialState);
  const [pendingDealSize, setPendingDealSize] = React.useState(state.dealSize);

  const reqAcks = requiredAcks(state);
  const blockedReason = advanceBlockedReason(state);

  const tierRequiresGate = requiresDepositBeforeDataRoom(state.jurisdictionTier, state.config);
  const isBuyer = state.role === "buyer";
  const isSeller = state.role === "seller";

  const gateTitle = isBuyer ? "Diligence Deposit (simulation)" : "Verification Gate (simulation)";

  // FIXED wording: buyer posts/sends deposit; platform confirms; seller does not "deposit".
  const gateHelp = isBuyer
    ? "If a tier requires a diligence deposit, the buyer posts it before IOI/LOI (seriousness / access gate)."
    : "No seller deposit in this pilot. This stage represents platform-side verification / escrow readiness checks before IOI/LOI.";

  // FIXED label: buyer is not receiving anything.
  const gateToggleLabel = isBuyer ? "Mark deposit posted" : "Mark verification complete";

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: 16 }}>
      <h1 style={{ marginBottom: 4 }}>Pilot Simulation</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Static demo. No real listings, funds, KYC, or escrow. Illustrates staged access controls,
        pause protocol, and jurisdiction-aware gating.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16 }}>
        {/* Controls */}
        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Controls</h2>

          <label style={{ display: "block", marginBottom: 8 }}>
            Role
            <select
              value={state.role}
              onChange={(e) => dispatch({ type: "SET_ROLE", role: e.target.value as any })}
              style={{ width: "100%", marginTop: 4 }}
            >
              <option value="platform">Platform (view only)</option>
              <option value="seller">Seller</option>
              <option value="buyer">Buyer</option>
            </select>
          </label>

          <label style={{ display: "block", marginBottom: 8 }}>
            Jurisdiction Tier
            <select
              value={state.jurisdictionTier}
              onChange={(e) => dispatch({ type: "SET_JURISDICTION", tier: e.target.value as any })}
              style={{ width: "100%", marginTop: 4 }}
            >
              <option value="A">Tier A (Pilot: U.S.)</option>
              <option value="B">Tier B (Moderate enforcement)</option>
              <option value="C">Tier C (Weak enforcement)</option>
            </select>
          </label>

          <label style={{ display: "block", marginBottom: 12 }}>
            Deal Size (pilot band)
            <input
              type="range"
              min={state.config.minDealSize}
              max={state.config.maxDealSize}
              step={5000}
              value={pendingDealSize}
              onChange={(e) => setPendingDealSize(Number(e.target.value))}
              onMouseUp={() => dispatch({ type: "SET_DEAL_SIZE", dealSize: pendingDealSize })}
              onTouchEnd={() => dispatch({ type: "SET_DEAL_SIZE", dealSize: pendingDealSize })}
              style={{ width: "100%" }}
            />
            <div style={{ fontVariantNumeric: "tabular-nums", marginTop: 4 }}>
              ${pendingDealSize.toLocaleString()}
            </div>
          </label>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Flags (hard-stops pause; warnings block data-room entry)</div>
            Hard-stops trigger PAUSE. Warning flags block entry to Limited Data Room (NDA → LDR).
            {Object.entries(FLAG_LABELS).map(([k, label]) => {
              const key = k as RedFlagKey;
              const help = FLAG_HELP[key];
              return (
                <div key={key} style={{ marginBottom: 6 }}>
                  <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={state.redFlags[key]}
                      onChange={() => dispatch({ type: "TOGGLE_FLAG", flag: key })}
                    />
                    <span>{label}</span>
                  </label>
                  {help ? <div style={{ marginLeft: 22, fontSize: 12, opacity: 0.75 }}>{help}</div> : null}
                </div>
              );
            })}
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Acknowledgements (required per stage)</div>

            {(Object.keys(state.acknowledgements) as AcknowledgementKey[])
              .filter((k) => isAckRelevantForRole(k, state.role))
              .map((k) => {
                const v = state.acknowledgements[k];
                const required = reqAcks.includes(k);
                const label = ACK_LABELS[k];
                const help = ACK_HELP[k];

                return (
                  <div key={k} style={{ marginBottom: 8 }}>
                    <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={v}
                        onChange={(e) => dispatch({ type: "ACK", ack: k, value: e.target.checked })}
                      />
                      <span style={{ fontWeight: required ? 700 : 400 }}>
                        {label} {required ? "(required)" : ""}
                      </span>
                    </label>
                    {help ? <div style={{ marginLeft: 22, fontSize: 12, opacity: 0.75 }}>{help}</div> : null}
                  </div>
                );
              })}
          </div>

          {/* Gate toggle only shown when user is AT the stage and the tier requires it */}
          {state.stage === "DEPOSIT_REQUIRED" && tierRequiresGate && (
            <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{gateTitle}</div>
              <div style={{ opacity: 0.8, marginBottom: 8 }}>{gateHelp}</div>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={state.depositSatisfied}
                  onChange={(e) => dispatch({ type: "SET_DEPOSIT_SATISFIED", value: e.target.checked })}
                />
                <span>{gateToggleLabel}</span>
              </label>

              {!isBuyer && isSeller && (
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                  Seller path: this is non-monetary verification in the simulator.
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => dispatch({ type: "REQUEST_ADVANCE" })}
              style={{ flex: 1 }}
              disabled={!!blockedReason}
              title={blockedReason ?? "Advance to next stage"}
            >
              Advance
            </button>
            <button onClick={() => dispatch({ type: "PAUSE", note: "Manual pause triggered." })}>Pause</button>
            <button onClick={() => dispatch({ type: "RESUME" })} disabled={!isPaused(state)}>
              Resume
            </button>
          </div>

          {blockedReason ? (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>Advance blocked: {blockedReason}</div>
          ) : (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>Advance permitted.</div>
          )}

          <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between" }}>
            <button onClick={() => dispatch({ type: "RESET" })}>Reset</button>
            <span style={{ opacity: 0.7 }}>{isPaused(state) ? "PAUSED" : "ACTIVE"}</span>
          </div>
        </section>

        {/* Main Panel */}
        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>
            Current Stage: {currentStageTitle(state)}{" "}
            <span style={{ fontSize: 12, opacity: 0.6 }}>({state.stage})</span>
          </h2>

          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>State ID: {state.stateId}</div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {STAGES.map((s) => {
              const active = state.stage === s;
              return (
                <span
                  key={s}
                  style={{
                    padding: "6px 10px",
                    border: "1px solid #ccc",
                    borderRadius: 999,
                    fontWeight: active ? 700 : 400,
                    opacity: active ? 1 : 0.7,
                  }}
                >
                  {stageLabel(s, state.role)}
                </span>
              );
            })}

            <span
              style={{
                padding: "6px 10px",
                border: "1px solid #ccc",
                borderRadius: 999,
                fontWeight: state.stage === "PAUSED" ? 700 : 400,
                opacity: state.stage === "PAUSED" ? 1 : 0.5,
              }}
            >
              Paused
            </span>
          </div>

          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Stage Requirements</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>At this stage</div>
                {reqAcks.length === 0 ? (
                  <div style={{ opacity: 0.75 }}>No required acknowledgements at this stage.</div>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {reqAcks.map((k) => (
                      <li key={k} style={{ marginBottom: 4 }}>
                        <span style={{ fontWeight: state.acknowledgements[k] ? 700 : 400 }}>
                          {ACK_LABELS[k]}
                        </span>{" "}
                        <span style={{ opacity: 0.75 }}>
                          — {state.acknowledgements[k] ? "accepted" : "pending"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Blocked / Next</div>
                {blockedReason ? (
                  <div style={{ opacity: 0.85 }}>{blockedReason}</div>
                ) : (
                  <div style={{ opacity: 0.85 }}>
                    Advance is permitted (no hard-stop flags and required acknowledgements satisfied).
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Hard-stop conditions</div>
                <div style={{ opacity: 0.8 }}>
                  Certain red flags automatically trigger a pause, forcing review before progression.
                </div>
              </div>
            </div>
          </div>

          {state.stage === "PAUSED" && (
            <div style={{ border: "1px solid #f0c", borderRadius: 8, padding: 10, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Pause Protocol Active</div>
              <div style={{ opacity: 0.85, marginBottom: 6 }}>
                Reason: {state.pauseReason.kind}
                {state.pauseReason.kind === "RED_FLAG" ? ` (${state.pauseReason.flags.join(", ")})` : ""}
                {state.pauseReason.kind === "MANUAL" && state.pauseReason.note
                  ? ` — ${state.pauseReason.note}`
                  : ""}
              </div>
              <div style={{ opacity: 0.8 }}>
                For safety, resume resets the simulation to Discovery once hard-stop flags are cleared.
              </div>
            </div>
          )}

          <h3 style={{ fontSize: 14, marginBottom: 6 }}>Event Log</h3>
          <div style={{ maxHeight: 360, overflow: "auto", border: "1px solid #eee", borderRadius: 8 }}>
            {state.events.length === 0 ? (
              <div style={{ padding: 10, opacity: 0.7 }}>No events yet.</div>
            ) : (
              [...state.events]
                .reverse()
                .slice(-80)
                .map((e) => (
                  <div key={e.id} style={{ padding: 10, borderBottom: "1px solid #f3f3f3" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <strong style={{ fontSize: 12 }}>{e.type}</strong>
                      <span style={{ fontSize: 12, opacity: 0.7 }}>{new Date(e.ts).toLocaleTimeString()}</span>
                    </div>
                    <div style={{ marginTop: 4 }}>{e.message}</div>
                  </div>
                ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}