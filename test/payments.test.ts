/**
 * orbstr-payments test suite. Run: npm test (node --test).
 * No network, no secrets, no real money.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { PolicyEngine } from "../src/payments/policy.ts";
import { MockWalletAdapter } from "../src/payments/mock-wallet.ts";
import { MockLightningNetwork } from "../src/payments/mock-network.ts";
import { SimulatedProvider } from "../src/payments/provider.ts";
import { Ledger, runPaymentFlow } from "../src/payments/flow.ts";
import type { SpendPolicy } from "../src/payments/types.ts";
import type { ProviderBehavior } from "../src/payments/provider.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(readFileSync(join(HERE, "..", "fixtures", "capability-search.json"), "utf8"));

const NOW = 1794000000;

function policy(overrides: Partial<SpendPolicy> = {}): SpendPolicy {
  return {
    policyVersion: 1,
    maxPerTransaction: { value: 1000, unit: "sat" },
    dailyLimit: { value: 5000, unit: "sat" },
    totalLimit: { value: 15000, unit: "sat" },
    allowedMethods: ["lightning"],
    allowedProviders: [],
    allowedCategories: [],
    approvalThreshold: { value: 500, unit: "sat" },
    expiresAt: NOW + 3600,
    revoked: false,
    ...overrides,
  };
}

interface DepsOptions {
  price?: number;
  balance?: number;
  offline?: boolean;
  behavior?: ProviderBehavior;
  quoteTtlSeconds?: number;
  policyOverrides?: Partial<SpendPolicy>;
  approve?: () => boolean;
  now?: () => number;
}

function makeDeps(options: DepsOptions = {}) {
  const network = new MockLightningNetwork();
  const engine = new PolicyEngine(policy(options.policyOverrides), NOW);
  const wallet = new MockWalletAdapter({
    balance: { value: options.balance ?? 15000, unit: "sat" },
    policy: engine,
    network,
    offline: options.offline,
  });
  const provider = new SimulatedProvider({
    pubkey: FIXTURE.pubkey,
    capabilityId: "web-search",
    price: { value: options.price ?? 20, unit: "sat" },
    network,
    behavior: options.behavior,
    quoteTtlSeconds: options.quoteTtlSeconds,
  });
  const ledger = new Ledger();
  const deps = {
    wallet,
    policy: engine,
    provider,
    ledger,
    now: options.now ?? (() => NOW),
    approve: options.approve,
    duplicateWindowSeconds: 300,
  };
  return { deps, wallet, engine, provider, ledger, network };
}

test("happy path: 20 sat search within policy pays, verifies and returns a receipt", () => {
  const { deps, wallet, ledger } = makeDeps();
  const outcome = runPaymentFlow(deps, FIXTURE);
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.capability.id, "web-search");
  assert.equal(outcome.payment.preimage.length, 64);
  assert.equal(outcome.receipt.amount.value, 20);
  assert.equal(outcome.receipt.providerPubkey, FIXTURE.pubkey);
  assert.equal(wallet.getBalance().value, 15000 - 20 - 1);
  assert.equal(ledger.all().length, 1);
});

test("per-transaction limit rejects before the wallet is called", () => {
  const { deps, wallet } = makeDeps({ price: 2000 });
  const outcome = runPaymentFlow(deps, FIXTURE);
  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.error.code, "policy_rejected");
  assert.match(outcome.error.message, /per-transaction/);
  assert.equal(wallet.calls.executePayment, 0);
});

test("daily limit rejects the second payment", () => {
  const { deps } = makeDeps({
    policyOverrides: { maxPerTransaction: { value: 25, unit: "sat" }, dailyLimit: { value: 30, unit: "sat" } },
  });
  const first = runPaymentFlow(deps, FIXTURE);
  assert.equal(first.ok, true);
  const second = runPaymentFlow(deps, FIXTURE);
  assert.equal(second.ok, false);
  if (second.ok) return;
  assert.equal(second.error.code, "policy_rejected");
  assert.match(second.error.message, /daily/);
});

test("total limit rejects once cumulative spend would exceed it", () => {
  const { deps } = makeDeps({
    policyOverrides: { dailyLimit: { value: 5000, unit: "sat" }, totalLimit: { value: 25, unit: "sat" } },
  });
  const first = runPaymentFlow(deps, FIXTURE);
  assert.equal(first.ok, true);
  const second = runPaymentFlow(deps, FIXTURE);
  assert.equal(second.ok, false);
  if (second.ok) return;
  assert.equal(second.error.code, "policy_rejected");
  assert.match(second.error.message, /total/);
});

test("provider not in allowlist is rejected", () => {
  const { deps, wallet } = makeDeps({
    policyOverrides: { allowedProviders: ["deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"] },
  });
  const outcome = runPaymentFlow(deps, FIXTURE);
  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.error.code, "policy_rejected");
  assert.match(outcome.error.message, /allowlist/);
  assert.equal(wallet.calls.executePayment, 0);
});

test("expired policy is rejected", () => {
  const { deps } = makeDeps({ policyOverrides: { expiresAt: NOW - 1 } });
  const outcome = runPaymentFlow(deps, FIXTURE);
  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.error.code, "policy_rejected");
  assert.match(outcome.error.message, /expired/);
});

test("above approval threshold requires owner approval", () => {
  const declined = makeDeps({ price: 600 });
  const declinedOutcome = runPaymentFlow(declined.deps, FIXTURE);
  assert.equal(declinedOutcome.ok, false);
  if (!declinedOutcome.ok) assert.equal(declinedOutcome.error.code, "approval_declined");
  assert.equal(declined.wallet.calls.executePayment, 0);

  const approved = makeDeps({ price: 600, approve: () => true });
  const approvedOutcome = runPaymentFlow(approved.deps, FIXTURE);
  assert.equal(approvedOutcome.ok, true);
});

test("executePayment is idempotent per payment hash (no double debit)", () => {
  const { wallet, provider } = makeDeps();
  const quote = provider.getQuote(NOW);
  const request = provider.createPaymentRequest(quote, NOW);
  assert.equal(request.ok, true);
  if (!request.ok) return;
  const first = wallet.executePayment(request.value, NOW);
  const second = wallet.executePayment(request.value, NOW);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) return;
  assert.equal(first.value.preimage, second.value.preimage);
  assert.equal(wallet.getBalance().value, 15000 - 20 - 1);
});

test("verification rejects a tampered preimage", () => {
  const { wallet, provider } = makeDeps();
  const quote = provider.getQuote(NOW);
  const request = provider.createPaymentRequest(quote, NOW);
  assert.equal(request.ok, true);
  if (!request.ok) return;
  const payment = wallet.executePayment(request.value, NOW);
  assert.equal(payment.ok, true);
  if (!payment.ok) return;
  const tampered = { ...payment.value, preimage: "0".repeat(64) };
  const verification = wallet.verifyPayment(tampered, request.value);
  assert.equal(verification.ok, false);
  assert.match(verification.reason ?? "", /preimage/);
});

test("expired quote is rejected", () => {
  const { deps, wallet } = makeDeps({ quoteTtlSeconds: 0 });
  const outcome = runPaymentFlow(deps, FIXTURE);
  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.error.code, "quote_expired");
  assert.equal(wallet.calls.executePayment, 0);
});

test("invoice amount mismatch (overcharge) is rejected before payment", () => {
  const { deps, wallet } = makeDeps({ behavior: "overcharge" });
  const outcome = runPaymentFlow(deps, FIXTURE);
  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.error.code, "amount_mismatch");
  assert.equal(wallet.calls.executePayment, 0);
});

test("provider no-delivery surfaces as a typed error after payment", () => {
  const { deps, ledger } = makeDeps({ behavior: "no_delivery" });
  const outcome = runPaymentFlow(deps, FIXTURE);
  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.stage, "delivery");
  assert.equal(outcome.error.code, "provider_no_delivery");
  assert.equal(ledger.all().length, 1);
});

test("offline wallet fails closed", () => {
  const { deps, wallet } = makeDeps({ offline: true });
  const outcome = runPaymentFlow(deps, FIXTURE);
  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.error.code, "wallet_unreachable");
  assert.equal(wallet.getBalance().value, 15000);
});

test("duplicate purchase within the window is flagged", () => {
  const { deps } = makeDeps();
  const first = runPaymentFlow(deps, FIXTURE);
  assert.equal(first.ok, true);
  const second = runPaymentFlow(deps, FIXTURE);
  assert.equal(second.ok, false);
  if (second.ok) return;
  assert.equal(second.error.code, "duplicate_payment");
});

test("insufficient balance fails with a typed error", () => {
  const { deps, wallet } = makeDeps({ balance: 10 });
  const outcome = runPaymentFlow(deps, FIXTURE);
  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.error.code, "insufficient_funds");
  assert.equal(wallet.getBalance().value, 10);
});
