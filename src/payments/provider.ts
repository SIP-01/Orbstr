/**
 * Simulated service provider (mock-only).
 *
 * Serves quotes, issues invoices through the mock network, delivers a fake
 * result and issues a receipt. `behavior` injects the failure modes the flow
 * must survive: overcharge (invoice ≠ quote), expired_invoice, no_delivery.
 */

import type { Money, PaymentRequest, PaymentResult, Quote, Receipt, Result } from "./types.ts";
import { err, ok } from "./types.ts";
import { sha256Hex } from "./mock-network.ts";
import type { MockLightningNetwork } from "./mock-network.ts";

export type ProviderBehavior = "ok" | "no_delivery" | "overcharge" | "expired_invoice";

export interface SimulatedProviderOptions {
  pubkey: string;
  capabilityId: string;
  price: Money;
  network: MockLightningNetwork;
  quoteTtlSeconds?: number;
  invoiceTtlSeconds?: number;
  behavior?: ProviderBehavior;
}

export class SimulatedProvider {
  private readonly pubkey: string;
  private readonly capabilityId: string;
  private readonly price: Money;
  private readonly network: MockLightningNetwork;
  private readonly quoteTtl: number;
  private readonly invoiceTtl: number;
  private readonly behavior: ProviderBehavior;
  private invoiceSeq = 0;

  constructor(options: SimulatedProviderOptions) {
    this.pubkey = options.pubkey;
    this.capabilityId = options.capabilityId;
    this.price = { ...options.price };
    this.network = options.network;
    this.quoteTtl = options.quoteTtlSeconds ?? 60;
    this.invoiceTtl = options.invoiceTtlSeconds ?? 60;
    this.behavior = options.behavior ?? "ok";
  }

  getQuote(now: number): Quote {
    return {
      provider: this.pubkey,
      capabilityId: this.capabilityId,
      amount: { ...this.price },
      method: "lightning",
      paymentTarget: `nostr+walletconnect://mock?capability=${this.capabilityId}`,
      expiresAt: now + this.quoteTtl,
    };
  }

  createPaymentRequest(quote: Quote, now: number): Result<PaymentRequest> {
    const amount: Money =
      this.behavior === "overcharge" ? { value: quote.amount.value * 10, unit: "sat" } : { ...quote.amount };
    const expiresAt = this.behavior === "expired_invoice" ? now - 1 : now + this.invoiceTtl;
    const preimage = sha256Hex(`${this.pubkey}|${this.capabilityId}|${quote.expiresAt}|${this.invoiceSeq++}`);
    const paymentHash = this.network.registerInvoice(preimage, amount.value, expiresAt);
    return ok({
      method: quote.method,
      paymentHash,
      invoice: `lnbc${amount.value}n1mock${paymentHash.slice(0, 16)}`,
      amount,
      expiresAt,
    });
  }

  deliver(payment: PaymentResult): Result<{ output: string }> {
    if (this.behavior === "no_delivery") {
      return err("provider_no_delivery", "provider accepted payment but returned no result");
    }
    return ok({ output: `mock search result for ${payment.paymentHash.slice(0, 8)}` });
  }

  issueReceipt(payment: PaymentResult, quote: Quote, now: number): Receipt {
    return {
      paymentHash: payment.paymentHash,
      preimage: payment.preimage,
      providerPubkey: this.pubkey,
      capabilityId: quote.capabilityId,
      amount: { ...quote.amount },
      createdAt: now,
    };
  }
}
