# orbstr-payments (experimental prototype)

Local, no-network prototype of the ORBSTR wallet-first payment architecture:
the user owns the wallet; the agent host enforces a spending policy; providers
issue invoices; payments settle over a mock Lightning network.

**Status: experimental.** Mock-only. No real wallets, no real money, no
network calls. Not a published standard. Design rationale: ORBSTR audit
deliverables D (architecture) and G (threat model), 2026-11-08.

## What works

- `PolicyEngine` — per-transaction, daily and total limits, method/provider/
  category allowlists, approval threshold, expiry, revocation. Pure and
  testable; runs outside the model.
- `MockWalletAdapter` — in-memory balance, wallet-side limit as a second gate,
  idempotent `executePayment` keyed by payment hash, preimage verification.
- `SimulatedProvider` — quote → invoice → deliver → receipt, with misbehaviour
  modes (`overcharge`, `expired_invoice`, `no_delivery`) for failure tests.
- `runPaymentFlow` — discover (real 39698 parser) → quote → policy →
  duplicate check → invoice → pay → verify → ledger → deliver → receipt.
- `Ledger` — local, keyed by payment hash; dispute evidence when delivery fails.

## Run

    npm test        # node --test, zero dependencies

Zero runtime dependencies. Editor/typecheck tooling (`@types/node`) is not
installed yet — the test suite is the verification.

## Not implemented (by design)

Real Lightning/Cashu adapters, refunds, owner-approval UX (NIP-17), policy
persistence, provider reputation. Those are Phase 4+ (audit deliverable H).
