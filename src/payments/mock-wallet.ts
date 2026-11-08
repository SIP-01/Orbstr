/**
 * Mock wallet adapter (mock-only).
 *
 * Holds an in-memory balance, enforces the policy as a second gate (defense in
 * depth — the flow checks first), and is idempotent per payment hash: a
 * repeated executePayment for the same invoice returns the cached result and
 * never debits twice.
 */

import type { Money, PaymentAdapter, PaymentRequest, PaymentResult, Result, Verification } from "./types.ts";
import { err, ok } from "./types.ts";
import type { PolicyEngine } from "./policy.ts";
import { sha256Hex } from "./mock-network.ts";
import type { MockLightningNetwork } from "./mock-network.ts";

export interface MockWalletOptions {
  balance: Money;
  policy: PolicyEngine;
  network: MockLightningNetwork;
  feePerPayment?: Money;
  offline?: boolean;
}

export interface WalletCallCounters {
  executePayment: number;
}

export class MockWalletAdapter implements PaymentAdapter {
  private balance: Money;
  private readonly policy: PolicyEngine;
  private readonly network: MockLightningNetwork;
  private readonly fee: Money;
  private readonly offline: boolean;
  private readonly settled = new Map<string, PaymentResult>();
  readonly calls: WalletCallCounters = { executePayment: 0 };

  constructor(options: MockWalletOptions) {
    this.balance = { ...options.balance };
    this.policy = options.policy;
    this.network = options.network;
    this.fee = options.feePerPayment ?? { value: 1, unit: "sat" };
    this.offline = options.offline ?? false;
  }

  getBalance(): Money {
    return { ...this.balance };
  }

  executePayment(request: PaymentRequest, now: number): Result<PaymentResult> {
    this.calls.executePayment += 1;
    const cached = this.settled.get(request.paymentHash);
    if (cached) return ok({ ...cached });
    if (this.offline) return err("wallet_unreachable", "wallet is offline");
    if (now >= request.expiresAt) return err("invoice_expired", "invoice expired");
    if (request.amount.value > this.policy.policy.maxPerTransaction.value) {
      return err("policy_rejected", "wallet-side per-transaction limit");
    }
    const total = request.amount.value + this.fee.value;
    if (total > this.balance.value) {
      return err("insufficient_funds", `need ${total} sat, have ${this.balance.value} sat`);
    }
    const settlement = this.network.settle(request.paymentHash, now);
    if (!settlement.ok) return settlement;
    this.balance = { value: this.balance.value - total, unit: "sat" };
    const result: PaymentResult = {
      paymentHash: request.paymentHash,
      preimage: settlement.value.preimage,
      feesPaid: { ...this.fee },
      settledAt: now,
    };
    this.settled.set(request.paymentHash, result);
    return ok({ ...result });
  }

  verifyPayment(result: PaymentResult, request: PaymentRequest): Verification {
    if (sha256Hex(result.preimage) !== request.paymentHash) {
      return { ok: false, reason: "preimage does not match payment hash" };
    }
    return { ok: true };
  }
}
