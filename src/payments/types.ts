/**
 * ORBSTR payments — provider-neutral payment interface (EXPERIMENTAL, mock-only).
 *
 * Local prototype: no network calls, no real wallets, no money.
 * Shared shapes for the policy layer, wallet adapters and providers.
 * Design notes: see README.md in this directory.
 */

export type PaymentMethod = "lightning" | "cashu";

export interface Money {
  value: number;
  unit: "sat";
}

export interface Quote {
  provider: string;
  capabilityId: string;
  amount: Money;
  method: PaymentMethod;
  paymentTarget: string;
  expiresAt: number;
}

export interface PaymentRequest {
  method: PaymentMethod;
  paymentHash: string;
  invoice: string;
  amount: Money;
  expiresAt: number;
}

export interface SpendPolicy {
  policyVersion: 1;
  maxPerTransaction: Money;
  dailyLimit: Money;
  totalLimit: Money;
  allowedMethods: PaymentMethod[];
  allowedProviders: string[];
  allowedCategories: string[];
  approvalThreshold: Money;
  expiresAt: number;
  revoked: boolean;
}

export type PolicyDecision =
  | { kind: "allow" }
  | { kind: "require_approval"; reason: string }
  | { kind: "reject"; reason: string };

export interface PaymentResult {
  paymentHash: string;
  preimage: string;
  feesPaid: Money;
  settledAt: number;
}

export interface Receipt {
  paymentHash: string;
  preimage: string;
  providerPubkey: string;
  capabilityId: string;
  amount: Money;
  createdAt: number;
}

export interface Verification {
  ok: boolean;
  reason?: string;
}

export type PaymentErrorCode =
  | "discovery_failed"
  | "policy_rejected"
  | "approval_declined"
  | "quote_expired"
  | "invoice_expired"
  | "amount_mismatch"
  | "duplicate_payment"
  | "insufficient_funds"
  | "wallet_unreachable"
  | "receipt_invalid"
  | "provider_no_delivery";

export interface PaymentError {
  code: PaymentErrorCode;
  message: string;
  detail?: Record<string, unknown>;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: PaymentError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T>(code: PaymentErrorCode, message: string, detail?: Record<string, unknown>): Result<T> {
  return { ok: false, error: { code, message, detail } };
}

export function sat(value: number): Money {
  return { value, unit: "sat" };
}

/** Wallet side of the payment interface. Providers and policy live elsewhere. */
export interface PaymentAdapter {
  getBalance(): Money;
  executePayment(request: PaymentRequest, now: number): Result<PaymentResult>;
  verifyPayment(result: PaymentResult, request: PaymentRequest): Verification;
}
