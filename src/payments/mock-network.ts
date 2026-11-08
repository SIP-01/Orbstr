/**
 * In-memory stand-in for a Lightning network (mock-only).
 *
 * Providers register invoices (payment hash = sha256(preimage)); the network
 * reveals the preimage to the payer on settlement — mirroring how a real
 * Lightning payment proves itself. Invoices are single-use and expiring.
 */

import { createHash } from "node:crypto";
import type { Result } from "./types.ts";
import { err, ok } from "./types.ts";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

interface MockInvoice {
  preimage: string;
  amount: number;
  expiresAt: number;
  settled: boolean;
}

export class MockLightningNetwork {
  private readonly invoices = new Map<string, MockInvoice>();

  registerInvoice(preimage: string, amount: number, expiresAt: number): string {
    const paymentHash = sha256Hex(preimage);
    this.invoices.set(paymentHash, { preimage, amount, expiresAt, settled: false });
    return paymentHash;
  }

  settle(paymentHash: string, now: number): Result<{ preimage: string }> {
    const invoice = this.invoices.get(paymentHash);
    if (!invoice) return err("invoice_expired", "unknown invoice");
    if (now >= invoice.expiresAt) return err("invoice_expired", "invoice expired");
    if (invoice.settled) return err("duplicate_payment", "invoice already settled");
    invoice.settled = true;
    return ok({ preimage: invoice.preimage });
  }
}
