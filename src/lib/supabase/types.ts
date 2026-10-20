// Database types for supabase-js, matching supabase/migrations.
// Regenerate with `npx supabase gen types typescript --linked` once the CLI is linked.

export type Role = "customer" | "staff" | "admin";
export type Language = "el" | "en";
export type CouponStatus = "valid" | "used" | "expired";
export type RedeemResult = "redeemed" | "already_used" | "expired" | "not_found" | "not_allowed";

export type AdminStats = {
  customers: number;
  stamps_total: number;
  stamps_today: number;
  stamps_7d: number;
  coupons_issued: number;
  coupons_redeemed: number;
  coupons_valid: number;
  daily: { day: string; stamps: number; redeemed: number }[];
};

type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      cafes: Table<{
        id: string;
        name: string;
        slug: string;
        stamps_required: number;
        coupon_valid_days: number;
        stamp_cooldown_seconds: number;
        created_at: string;
      }, "name" | "slug">;
      profiles: Table<{
        id: string;
        cafe_id: string | null;
        role: Role;
        display_name: string | null;
        preferred_language: Language;
        created_at: string;
      }, "id">;
      tags: Table<{
        id: string;
        cafe_id: string;
        label: string;
        tag_uid: string;
        staff_id: string | null;
        active: boolean;
        last_counter: number;
        last_tap_at: string | null;
        created_at: string;
      }, "cafe_id" | "label" | "tag_uid">;
      cards: Table<{
        id: string;
        cafe_id: string;
        customer_id: string;
        stamp_count: number;
        updated_at: string;
      }, "cafe_id" | "customer_id">;
      stamps: Table<{
        id: string;
        cafe_id: string;
        card_id: string;
        customer_id: string;
        tag_id: string | null;
        created_at: string;
      }, "cafe_id" | "card_id" | "customer_id">;
      coupons: Table<{
        id: string;
        cafe_id: string;
        customer_id: string;
        code: string;
        status: CouponStatus;
        issued_at: string;
        expires_at: string;
        redeemed_at: string | null;
        redeemed_by: string | null;
      }, "cafe_id" | "customer_id" | "expires_at">;
    };
    Views: Record<string, never>;
    Functions: {
      applied_migrations: {
        Args: Record<string, never>;
        Returns: string[];
      };
      consume_tag_tap: {
        Args: { p_uid: string; p_counter: number };
        Returns: { result: "ok" | "unknown_tag" | "inactive" | "replayed"; tag_id: string | null; cafe_id: string | null }[];
      };
      admin_customers: {
        Args: Record<string, never>;
        Returns: {
          customer_id: string;
          email: string;
          display_name: string | null;
          stamp_count: number;
          stamps_total: number;
          coupons_valid: number;
          coupons_used: number;
          last_stamp_at: string | null;
          joined_at: string;
        }[];
      };
      admin_stats: {
        Args: { p_days?: number; p_tz?: string };
        Returns: AdminStats | null;
      };
      admin_activity: {
        Args: { p_limit?: number };
        Returns: { kind: "stamp" | "coupon_issued" | "redeemed"; at: string; email: string; detail: string | null }[];
      };
      admin_stamp_log: {
        Args: { p_since?: string };
        Returns: { stamped_at: string; email: string; display_name: string | null; tag_label: string | null }[];
      };
      redeem_coupon: {
        Args: { p_code: string; p_staff_id: string };
        Returns: {
          result: RedeemResult;
          code: string | null;
          issued_at: string | null;
          expires_at: string | null;
          redeemed_at: string | null;
        }[];
      };
      record_stamp: {
        Args: { p_cafe_id: string; p_customer_id: string; p_tag_id?: string | null; p_tag_counter?: number | null };
        Returns: {
          result: "stamped" | "coupon_issued" | "cooldown" | "duplicate";
          stamp_count: number;
          stamps_required: number;
          coupon_code: string | null;
          retry_after_seconds: number | null;
        }[];
      };
      find_coupon_for_staff: {
        Args: { p_code: string };
        Returns: {
          id: string;
          code: string;
          status: CouponStatus;
          issued_at: string;
          expires_at: string;
          redeemed_at: string | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
