# IP Governance Pilot Sim (Static Demo)

A sober, minimal governance workflow simulator for staged deal progression:
**Discovery → Qualification → NDA → Limited Data Room → (Gate) → IOI/LOI → Escrow → Settlement**

This is a **static demo** (no backend) meant to illustrate:
- stage-based gating,
- role-specific acknowledgements,
- jurisdiction-aware checks,
- hard-stop pause protocol,
- event logging for traceability.

## Live Demo
https://putmanmodel.github.io/ip-governance-sim/

## What this is (and isn’t)
✅ Shows governance logic and UI flow  
✅ Demonstrates “pause on hard-stop” behavior  
✅ Designed to be clear, non-flashy, and easy to audit

❌ Not legal advice  
❌ No real listings, funds, KYC, escrow, or payments  
❌ No real enforcement — this is process simulation only

## How to run locally
```bash
npm install
npm run dev
```

Security note: npm audit reports vulnerabilities in dev-only tooling (eslint dependency chain). Not executed in production runtime. Intentionally not forcing a breaking ESLint upgrade in this pilot.

## License
Creative Commons Attribution-NonCommercial 4.0 International (CC-BY-NC-4.0)