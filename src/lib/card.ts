// Shape of the card the customer pages render, whether it comes from the
// database or from the dev-only mock data.

export type CouponStatus = "valid" | "used" | "expired";

export interface Coupon {
  code: string;
  issuedAt: string; // ISO
  expiresAt: string; // ISO
  usedAt?: string; // ISO, when status is "used"
  status: CouponStatus;
}

export interface Card {
  customerName: string | null;
  cardNumber: string;
  stamps: number;
  /** Stamps needed for a free coffee (the cafe's stamps_required). */
  goal: number;
  /** The most recent stamp was added by the tap that opened the page. */
  justStamped: boolean;
  coupon: Coupon | null;
}

/** A valid coupon past its expiry date is shown as expired. */
export function effectiveStatus(status: CouponStatus, expiresAt: string, now = Date.now()): CouponStatus {
  return status === "valid" && new Date(expiresAt).getTime() <= now ? "expired" : status;
}
