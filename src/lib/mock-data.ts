/**
 * MOCK DATA for previewing every card state without a database.
 *
 * Only used when the dev server runs with MOCK_DATA=1 (see src/lib/env.ts).
 * Change ACTIVE_SCENARIO to preview a state, or add `?state=<name>` to any
 * URL (e.g. /coupon?state=used).
 */

import type { Card } from "./card";

export type Scenario = "progress" | "almost" | "complete" | "used" | "expired" | "new";

export const ACTIVE_SCENARIO: Scenario = "progress";

const STAMP_GOAL = 10;

const DAY = 24 * 60 * 60 * 1000;
const fromNow = (days: number) => new Date(Date.now() + days * DAY).toISOString();

const base = { customerName: "Μαρία", cardNumber: "0427", goal: STAMP_GOAL };

const scenarios: Record<Scenario, Card> = {
  new: { ...base, stamps: 0, justStamped: false, coupon: null },
  progress: { ...base, stamps: 4, justStamped: true, coupon: null },
  almost: { ...base, stamps: 9, justStamped: true, coupon: null },
  complete: {
    ...base,
    stamps: 10,
    justStamped: true,
    coupon: { code: "CP-7K4Q-29XM-HD3P-WR8N", issuedAt: fromNow(0), expiresAt: fromNow(30), status: "valid" },
  },
  // After redeeming, the customer starts a fresh card.
  used: {
    ...base,
    stamps: 1,
    justStamped: false,
    coupon: {
      code: "CP-3HRT-81QD-K6VA-ZM4E",
      issuedAt: fromNow(-12),
      expiresAt: fromNow(18),
      usedAt: fromNow(-2),
      status: "used",
    },
  },
  expired: {
    ...base,
    stamps: 2,
    justStamped: false,
    coupon: { code: "CP-9WNB-40LE-T2YC-QP7H", issuedAt: fromNow(-40), expiresAt: fromNow(-10), status: "expired" },
  },
};

export const scenarioNames = Object.keys(scenarios) as Scenario[];

function isScenario(value: unknown): value is Scenario {
  return typeof value === "string" && value in scenarios;
}

export function getCard(override?: string | string[]): Card {
  const requested = Array.isArray(override) ? override[0] : override;
  return scenarios[isScenario(requested) ? requested : ACTIVE_SCENARIO];
}

export function getScenarioName(override?: string | string[]): Scenario {
  const requested = Array.isArray(override) ? override[0] : override;
  return isScenario(requested) ? requested : ACTIVE_SCENARIO;
}
