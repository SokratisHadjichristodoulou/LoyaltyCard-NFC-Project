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

export type WalletThemeRow = {
  id: string;
  cafe_id: string;
  name: string;
  background_color: string;
  /** A built-in banner name (e.g. "christmas") or an https address. */
  hero_image: string;
  message_el: string | null;
  message_en: string | null;
  starts_on: string; // YYYY-MM-DD
  ends_on: string; // YYYY-MM-DD
  repeats_yearly: boolean;
  notify: boolean;
  active: boolean;
  created_at: string;
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
        wallet_theme_key: string | null;
        apple_wallet_theme_key: string | null;
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
        simple_token: string | null;
        created_at: string;
      }, "cafe_id" | "label" | "tag_uid">;
      cards: Table<{
        id: string;
        cafe_id: string;
        customer_id: string;
        stamp_count: number;
        google_wallet_object_id: string | null;
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
      apple_wallet_passes: Table<{
        serial_number: string;
        cafe_id: string;
        card_id: string | null;
        auth_token: string;
        updated_at: string;
        version: number;
        created_at: string;
      }, "serial_number" | "cafe_id" | "auth_token">;
      apple_wallet_registrations: Table<{
        device_library_id: string;
        serial_number: string;
        push_token: string;
        pushed_version: number;
        pushed_at: string | null;
        created_at: string;
      }, "device_library_id" | "serial_number" | "push_token">;
      wallet_themes: Table<WalletThemeRow, "cafe_id" | "name" | "background_color" | "hero_image" | "starts_on" | "ends_on">;
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
      record_simple_stamp: {
        Args: { p_cafe_id: string; p_customer_id: string; p_tag_id: string };
        Returns: {
          result: "stamped" | "coupon_issued" | "cooldown" | "duplicate" | "daily_limit" | "unknown_tag" | "inactive";
          stamp_count: number | null;
          stamps_required: number | null;
          coupon_code: string | null;
          retry_after_seconds: number | null;
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
      wallet_pass_data: {
        Args: { p_cafe_id: string; p_customer_id: string };
        Returns: {
          card_id: string;
          object_id: string | null;
          stamp_count: number;
          stamps_required: number;
          display_name: string | null;
          coupon_code: string | null;
          coupon_expires_at: string | null;
        }[];
      };
      apple_wallet_register: {
        Args: { p_device: string; p_serial: string; p_push_token: string };
        Returns: "created" | "updated";
      };
      apple_wallet_updated_serials: {
        Args: { p_device: string; p_since: string | null };
        Returns: { serial_number: string; updated_at: string }[];
      };
      apple_wallet_touch: {
        Args: { p_cafe_id: string; p_customer_id: string };
        Returns: string | null;
      };
      apple_wallet_touch_all: {
        Args: { p_cafe_id: string };
        Returns: number;
      };
      apple_wallet_claim_pushes: {
        Args: { p_cafe_id: string; p_serial: string | null; p_limit: number };
        Returns: { device_library_id: string; serial_number: string; push_token: string }[];
      };
      apple_wallet_pass_count: {
        Args: { p_cafe_id: string };
        Returns: number;
      };
      wallet_expire_coupons: {
        Args: { p_cafe_id: string; p_limit: number };
        Returns: { customer_id: string; has_pass: boolean }[];
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
