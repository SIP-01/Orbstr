/**
 * Spending policy engine — the trusted layer that runs OUTSIDE the model.
 *
 * Pure and deterministic: no network, no clock of its own (caller passes `now`).
 * Enforces, in order: revocation, expiry, method/provider/category allowlists,
 * per-transaction limit, daily limit, total limit, approval threshold.
 */

import type { Money, PaymentMethod, PolicyDecision, SpendPolicy } from "./types.ts";

export interface SpendContext {
  method: PaymentMethod;
  provider: string;
  category?: string;
}

export function validatePolicy(policy: SpendPolicy): string[] {
  const problems: string[] = [];
  const amounts: Array<[string, Money]> = [
    ["maxPerTransaction", policy.maxPerTransaction],
    ["dailyLimit", policy.dailyLimit],
    ["totalLimit", policy.totalLimit],
    ["approvalThreshold", policy.approvalThreshold],
  ];
  for (const [name, money] of amounts) {
    if (money.unit !== "sat" || !Number.isInteger(money.value) || money.value < 0) {
      problems.push(`${name} must be a non-negative integer amount in sat`);
    }
  }
  if (policy.allowedMethods.length === 0) problems.push("allowedMethods must not be empty");
  return problems;
}

const DAY_SECONDS = 86400;

function dayStartOf(now: number): number {
  return Math.floor(now / DAY_SECONDS) * DAY_SECONDS;
}

export class PolicyEngine {
  readonly policy: SpendPolicy;
  private spentToday = 0;
  private spentTotal = 0;
  private dayStart: number;

  constructor(policy: SpendPolicy, now: number) {
    const problems = validatePolicy(policy);
    if (problems.length > 0) throw new Error(`invalid spend policy: ${problems.join("; ")}`);
    this.policy = policy;
    this.dayStart = dayStartOf(now);
  }

  check(amount: Money, context: SpendContext, now: number): PolicyDecision {
    const policy = this.policy;
    if (policy.revoked) return { kind: "reject", reason: "policy revoked" };
    if (now >= policy.expiresAt) return { kind: "reject", reason: "policy expired" };
    if (!policy.allowedMethods.includes(context.method)) {
      return { kind: "reject", reason: `method ${context.method} not allowed` };
    }
    if (policy.allowedProviders.length > 0 && !policy.allowedProviders.includes(context.provider)) {
      return { kind: "reject", reason: "provider not in allowlist" };
    }
    if (
      policy.allowedCategories.length > 0 &&
      (context.category === undefined || !policy.allowedCategories.includes(context.category))
    ) {
      return { kind: "reject", reason: "category not allowed" };
    }
    if (amount.value > policy.maxPerTransaction.value) {
      return { kind: "reject", reason: "over per-transaction limit" };
    }
    this.rollDay(now);
    if (this.spentToday + amount.value > policy.dailyLimit.value) {
      return { kind: "reject", reason: "over daily limit" };
    }
    if (this.spentTotal + amount.value > policy.totalLimit.value) {
      return { kind: "reject", reason: "over total limit" };
    }
    if (amount.value > policy.approvalThreshold.value) {
      return { kind: "require_approval", reason: "above approval threshold" };
    }
    return { kind: "allow" };
  }

  /** Record a settled payment. Call only after the payment verified. */
  record(amount: Money, now: number): void {
    this.rollDay(now);
    this.spentToday += amount.value;
    this.spentTotal += amount.value;
  }

  spent(): { today: number; total: number } {
    return { today: this.spentToday, total: this.spentTotal };
  }

  private rollDay(now: number): void {
    const start = dayStartOf(now);
    if (start !== this.dayStart) {
      this.dayStart = start;
      this.spentToday = 0;
    }
  }
}
