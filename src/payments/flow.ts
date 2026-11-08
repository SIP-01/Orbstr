/**
 * Payment flow orchestrator + local ledger (mock-only).
 *
 * discover (real 39698 parser) → quote → policy → duplicate check → invoice →
 * pay → verify → ledger → deliver → receipt. Every failure is a typed result,
 * never a thrown exception. The ledger is keyed by payment hash and is the
 * dispute evidence when a provider takes payment but delivers nothing.
 */

import type { Capability } from "../capability.ts";
import { parseCapabilityEvent } from "../capability.ts";
import type { PaymentError, PaymentResult, Quote, Receipt } from "./types.ts";
import type { PolicyEngine } from "./policy.ts";
import type { MockWalletAdapter } from "./mock-wallet.ts";
import type { SimulatedProvider } from "./provider.ts";

export interface LedgerEntry {
  paymentHash: string;
  provider: string;
  capabilityId: string;
  amountSat: number;
  status: "settled" | "failed";
  at: number;
}

export class Ledger {
  private readonly entries = new Map<string, LedgerEntry>();

  record(entry: LedgerEntry): void {
    this.entries.set(entry.paymentHash, entry);
  }

  get(paymentHash: string): LedgerEntry | undefined {
    return this.entries.get(paymentHash);
  }

  all(): LedgerEntry[] {
    return [...this.entries.values()];
  }

  findRecent(
    provider: string,
    capabilityId: string,
    amountSat: number,
    windowSeconds: number,
    now: number,
  ): LedgerEntry | undefined {
    for (const entry of this.entries.values()) {
      if (entry.status !== "settled") continue;
      if (entry.provider !== provider || entry.capabilityId !== capabilityId) continue;
      if (entry.amountSat !== amountSat) continue;
      if (now - entry.at <= windowSeconds) return entry;
    }
    return undefined;
  }
}

export type FlowStage = "discover" | "quote" | "policy" | "invoice" | "payment" | "verify" | "delivery";

export interface FlowSuccess {
  ok: true;
  capability: Capability;
  quote: Quote;
  payment: PaymentResult;
  receipt: Receipt;
  output: string;
}

export interface FlowFailure {
  ok: false;
  stage: FlowStage;
  error: PaymentError;
}

export type FlowOutcome = FlowSuccess | FlowFailure;

export interface FlowDeps {
  wallet: MockWalletAdapter;
  policy: PolicyEngine;
  provider: SimulatedProvider;
  ledger: Ledger;
  now: () => number;
  /** Owner approval hook. Absent = approval always declined. */
  approve?: (quote: Quote) => boolean;
  duplicateWindowSeconds?: number;
}

export interface CapabilityEvent {
  kind: number;
  content: string;
  tags: string[][];
  created_at: number;
  pubkey: string;
}

export function runPaymentFlow(deps: FlowDeps, event: CapabilityEvent): FlowOutcome {
  const now = deps.now();

  const capability = parseCapabilityEvent(event, "local");
  if (!capability) {
    return {
      ok: false,
      stage: "discover",
      error: { code: "discovery_failed", message: "event is not a valid capability announcement" },
    };
  }

  const quote = deps.provider.getQuote(now);
  if (now >= quote.expiresAt) {
    return { ok: false, stage: "quote", error: { code: "quote_expired", message: "quote expired before use" } };
  }

  const decision = deps.policy.check(
    quote.amount,
    { method: quote.method, provider: quote.provider, category: capability.capabilities[0] },
    now,
  );
  if (decision.kind === "reject") {
    return { ok: false, stage: "policy", error: { code: "policy_rejected", message: decision.reason } };
  }
  if (decision.kind === "require_approval") {
    const approved = deps.approve ? deps.approve(quote) : false;
    if (!approved) {
      return {
        ok: false,
        stage: "policy",
        error: { code: "approval_declined", message: "owner approval required and not granted" },
      };
    }
  }

  const window = deps.duplicateWindowSeconds ?? 300;
  const duplicate = deps.ledger.findRecent(quote.provider, quote.capabilityId, quote.amount.value, window, now);
  if (duplicate) {
    return {
      ok: false,
      stage: "policy",
      error: {
        code: "duplicate_payment",
        message: "same provider, capability and amount settled recently",
        detail: { paymentHash: duplicate.paymentHash },
      },
    };
  }

  const request = deps.provider.createPaymentRequest(quote, now);
  if (!request.ok) return { ok: false, stage: "invoice", error: request.error };
  if (request.value.amount.value !== quote.amount.value) {
    return {
      ok: false,
      stage: "invoice",
      error: {
        code: "amount_mismatch",
        message: `invoice ${request.value.amount.value} sat does not match quote ${quote.amount.value} sat`,
      },
    };
  }
  if (now >= request.value.expiresAt) {
    return { ok: false, stage: "invoice", error: { code: "invoice_expired", message: "invoice expired before payment" } };
  }

  const payment = deps.wallet.executePayment(request.value, now);
  if (!payment.ok) return { ok: false, stage: "payment", error: payment.error };

  const verification = deps.wallet.verifyPayment(payment.value, request.value);
  if (!verification.ok) {
    return {
      ok: false,
      stage: "verify",
      error: { code: "receipt_invalid", message: verification.reason ?? "payment verification failed" },
    };
  }

  deps.ledger.record({
    paymentHash: payment.value.paymentHash,
    provider: quote.provider,
    capabilityId: quote.capabilityId,
    amountSat: quote.amount.value,
    status: "settled",
    at: now,
  });
  deps.policy.record(quote.amount, now);

  const delivery = deps.provider.deliver(payment.value);
  if (!delivery.ok) return { ok: false, stage: "delivery", error: delivery.error };

  const receipt = deps.provider.issueReceipt(payment.value, quote, now);
  return { ok: true, capability, quote, payment: payment.value, receipt, output: delivery.value.output };
}
